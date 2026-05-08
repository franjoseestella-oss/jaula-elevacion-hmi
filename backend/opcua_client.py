"""
opcua_client.py
───────────────
Cliente OPC UA persistente para PLC Siemens S7-1200.

- Se instancia una sola vez (singleton).
- Cuando está activo (modo PLC real) lee todas las variables de forma
  cíclica y expone los datos en `opcua_client.state`.
- Cuando se escribe una salida, la envía directamente al PLC.
- Si el modo es simulación, queda en standby sin hacer nada.

Dependencia: pip install asyncua
"""

import asyncio
import threading
import time
import logging
from typing import Optional

logger = logging.getLogger("opcua_client")

# ──────────────────────────────────────────────────────────────────────────────
# Configuración (se actualiza desde la API REST)
# ──────────────────────────────────────────────────────────────────────────────
class OpcUaConfig:
    ip: str        = "192.168.0.1"
    port: str      = "4840"
    db_name: str   = "DB_App"
    namespace: str = "3"

    @property
    def url(self) -> str:
        return f"opc.tcp://{self.ip}:{self.port}"

    def node_id(self, var_name: str) -> str:
        return f'ns={self.namespace};s="{self.db_name}"."{var_name}"'


# ──────────────────────────────────────────────────────────────────────────────
# Variables expuestas por el PLC (las mismas que en plc_sim_state de main.py)
# ──────────────────────────────────────────────────────────────────────────────
PLC_READ_VARS = [
    "OR_Altura_Carretilla",
    "OW_Numero_Pallets",
    "Ob_Iniciar_Secuencia",
    "Ob_Poner_Pegatina",
    "Ob_Abortar_Secuencia",
    "Ob_Bit_VIDA_PLC_APP",
    # Mantenemos las de escritura aquí también para poder leer su estado
    "Ib_LUZ_VERDE",
    "Ib_LUZ_AZUL",
    "Ib_LUZ_ROJA",
    "Ib_LUZ_Pulsador_1",
    "Ib_LUZ_Pulsador_2",
    "Ib_Bit_VIDA_APP_PLC"
]

PLC_WRITE_VARS = [
    "Ib_LUZ_VERDE",
    "Ib_LUZ_AZUL",
    "Ib_LUZ_ROJA",
    "Ib_LUZ_Pulsador_1",
    "Ib_LUZ_Pulsador_2",
    "Ib_Bit_VIDA_APP_PLC"
]


# ──────────────────────────────────────────────────────────────────────────────
# Singleton del cliente
# ──────────────────────────────────────────────────────────────────────────────
class OpcUaClientManager:
    """
    Gestiona una conexión OPC UA persistente en un thread/loop propio.
    Expone `state` (dict) con los últimos valores leídos del PLC.
    """

    def __init__(self):
        self.config    = OpcUaConfig()
        self.state     = {v: False for v in PLC_READ_VARS}

        self.connected      = False
        self.active         = False          # True = modo PLC real
        self.error_msg      = ""
        self._write_queue: asyncio.Queue = None  # type: ignore
        self._loop: asyncio.AbstractEventLoop = None  # type: ignore
        self._thread: threading.Thread = None  # type: ignore

    # ── API pública ────────────────────────────────────────────────────────────

    def enable(self):
        """Activa el modo PLC real y arranca el loop de conexión."""
        if self.active and self._thread and self._thread.is_alive():
            return  # ya en marcha
        self.active = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="opcua-thread")
        self._thread.start()
        logger.info("[OPC UA] Cliente activado → %s", self.config.url)

    def disable(self):
        """Desactiva el modo PLC real y detiene el loop."""
        self.active    = False
        self.connected = False
        self.error_msg = "Modo simulación activo"
        logger.info("[OPC UA] Cliente desactivado (modo simulación)")

    def write(self, payload: dict):
        """Encola una escritura al PLC (seguro desde cualquier thread)."""
        if not self.active or not self._loop:
            return
        self._loop.call_soon_threadsafe(
            self._write_queue.put_nowait, payload
        )

    def update_config(self, ip: str, port: str, db_name: str, namespace: str):
        """Actualiza la configuración y reinicia la conexión."""
        self.config.ip        = ip
        self.config.port      = port
        self.config.db_name   = db_name
        self.config.namespace = namespace
        if self.active:
            # Reiniciar el loop con la nueva config
            self.disable()
            time.sleep(0.3)
            self.enable()

    # ── Loop asíncrono interno ─────────────────────────────────────────────────

    def _run_loop(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._write_queue = asyncio.Queue()
        try:
            self._loop.run_until_complete(self._connect_and_poll())
        except Exception as e:
            logger.error("[OPC UA] Loop terminado con error: %s", e)
        finally:
            self._loop.close()
            self.connected = False

    async def _connect_and_poll(self):
        """Bucle principal: conecta, lee, escribe, reconecta si falla."""
        while self.active:
            try:
                await self._session()
            except Exception as e:
                self.connected = False
                self.error_msg = str(e)
                logger.warning("[OPC UA] Reconectando en 3s... (%s)", e)
                await asyncio.sleep(3)

    async def _session(self):
        """Una sesión completa: conecta y lee/escribe hasta desconexión."""
        try:
            from asyncua import Client, ua
        except ImportError:
            self.error_msg = "asyncua no instalado. Ejecuta: pip install asyncua"
            logger.error(self.error_msg)
            self.active = False
            return

        client = Client(url=self.config.url)
        client.session_timeout = 10_000          # 10 s
        client.secure_channel_timeout = 10_000

        logger.info("[OPC UA] Conectando a %s ...", self.config.url)
        try:
            await asyncio.wait_for(client.connect(), timeout=4.0)
        except asyncio.TimeoutError:
            raise Exception("Timeout conectando al PLC (Revisa IP o red)")
        self.connected = True
        self.error_msg = ""
        logger.info("[OPC UA] ✓ Conectado a %s", self.config.url)

        try:
            from asyncua import ua
            nodes = {}

            # 1. Intentar descubrir dinámicamente desde ServerInterfaces
            async def discover_vars(node):
                try:
                    bname = await node.read_browse_name()
                    node_class = await node.read_node_class()
                    if node_class == ua.NodeClass.Variable:
                        if bname.Name not in {"Icon", "OW_Altura_Elevacion", "OW_Pallet"}:
                            nodes[bname.Name] = node
                    elif node_class == ua.NodeClass.Object:
                        for child in await node.get_children():
                            await discover_vars(child)
                except Exception:
                    pass

            try:
                server_interfaces = None
                for child in await client.nodes.objects.get_children():
                    if (await child.read_browse_name()).Name == "ServerInterfaces":
                        server_interfaces = child
                        break
                if server_interfaces:
                    logger.info("[OPC UA] Explorando ServerInterfaces...")
                    await discover_vars(server_interfaces)
            except Exception as e:
                logger.warning("[OPC UA] Error descubriendo nodos: %s", e)

            # 2. Añadir/Forzar estáticos si no se encontraron dinámicamente
            for var in PLC_READ_VARS:
                if var not in nodes:
                    try:
                        nodes[var] = client.get_node(self.config.node_id(var))
                    except Exception:
                        pass

            write_nodes = {
                var: nodes[var]
                for var in PLC_WRITE_VARS
                if var in nodes
            }
            logger.info("[OPC UA] Monitorizando %d variables.", len(nodes))

            import time
            last_heartbeat = time.time()
            last_app_heartbeat = time.time()
            app_heartbeat_state = False

            while self.active:
                # ── Leer todas las variables ────────────────────────────────
                for var, node in nodes.items():
                    try:
                        val = await node.read_value()
                        if isinstance(val, (int, float, bool, str)):
                            self.state[var] = val
                        else:
                            self.state[var] = str(val)
                    except Exception:
                        pass
                
                # ── Comprobar BIT VIDA (Heartbeat) PLC -> APP ───────────────
                if "Ob_Bit_VIDA_PLC_APP" in nodes:
                    if self.state.get("Ob_Bit_VIDA_PLC_APP") is True:
                        last_heartbeat = time.time()
                    elif time.time() - last_heartbeat > 3.0:
                        raise Exception("Conexión perdida (BIT VIDA PLC no recibido en 3s)")

                # ── Generar BIT VIDA APP -> PLC (Toggle 1s) ─────────────────
                if time.time() - last_app_heartbeat >= 1.0:
                    app_heartbeat_state = not app_heartbeat_state
                    last_app_heartbeat = time.time()
                    if "Ib_Bit_VIDA_APP_PLC" in write_nodes:
                        try:
                            from asyncua import ua
                            node_app = write_nodes["Ib_Bit_VIDA_APP_PLC"]
                            await node_app.write_value(ua.DataValue(ua.Variant(app_heartbeat_state, ua.VariantType.Boolean)))
                            self.state["Ib_Bit_VIDA_APP_PLC"] = app_heartbeat_state
                        except Exception as e:
                            logger.warning("[OPC UA] Error escribiendo Ib_Bit_VIDA_APP_PLC: %s", e)

                # ── Procesar cola de escrituras manuales ────────────────────
                while not self._write_queue.empty():
                    payload = await self._write_queue.get()
                    await self._do_write(client, write_nodes, payload)

                await asyncio.sleep(0.1)   # 10 Hz

        finally:
            await client.disconnect()
            self.connected = False
            logger.info("[OPC UA] Desconectado de %s", self.config.url)

    async def _do_write(self, client, write_nodes: dict, payload: dict):
        """Escribe los valores del payload en los nodos correspondientes."""
        from asyncua import ua
        for var, value in payload.items():
            if var not in write_nodes:
                continue
            try:
                if isinstance(value, bool):
                    dv = ua.DataValue(ua.Variant(value, ua.VariantType.Boolean))
                elif isinstance(value, float):
                    dv = ua.DataValue(ua.Variant(value, ua.VariantType.Float))
                elif isinstance(value, int):
                    dv = ua.DataValue(ua.Variant(value, ua.VariantType.Int32))
                else:
                    dv = ua.DataValue(ua.Variant(value))
                await write_nodes[var].write_value(dv)
                logger.debug("[OPC UA] ← %s = %s", var, value)
            except Exception as e:
                logger.warning("[OPC UA] Error escribiendo %s: %s", var, e)


# ── Instancia global (singleton) ───────────────────────────────────────────────
opcua_manager = OpcUaClientManager()
