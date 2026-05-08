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
    # Entradas analógicas
    "R_Altura_Carretilla",
    "W_Numero_Pallets",
    # Entradas digitales (pulsadores / sensores)
    "b_Iniciar_Secuencia",
    "b_Poner_Pegatina",
    "b_Abortar_Secuencia",
    "b_LUZ_Pulsador_1",
    "b_LUZ_Pulsador_2",
    "b_HEAR_BIT",
    # Salidas (feedback del PLC)
    "b_LUZ_VERDE",
    "b_LUZ_AZUL",
    "b_LUZ_ROJA"
]

PLC_WRITE_VARS = [
    "b_LUZ_VERDE",
    "b_LUZ_AZUL",
    "b_LUZ_ROJA",
    "b_LUZ_Pulsador_1",
    "b_LUZ_Pulsador_2",
    "b_HEAR_BIT"
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
        self.state["OW_Altura_Elevacion"] = 0.0
        self.state["OW_Pallet"]           = 0.0

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
        await client.connect()
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
                        pass  # mantiene el último valor conocido

                # ── Procesar cola de escrituras ─────────────────────────────
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
