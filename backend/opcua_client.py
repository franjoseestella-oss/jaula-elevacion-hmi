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
    db_name_fast: str = "DB_Fast"
    db_name_slow: str = "DB_Slow"
    hz_fast: float = 100.0
    hz_slow: float = 10.0
    namespace: str = "3"

    @property
    def url(self) -> str:
        return f"opc.tcp://{self.ip}:{self.port}"

    def node_id_fast(self, var_name: str) -> str:
        return f'ns={self.namespace};s="{self.db_name_fast}"."{var_name}"'

    def node_id_slow(self, var_name: str) -> str:
        return f'ns={self.namespace};s="{self.db_name_slow}"."{var_name}"'


# ──────────────────────────────────────────────────────────────────────────────
# Variables expuestas por el PLC (las mismas que en plc_sim_state de main.py)
# ──────────────────────────────────────────────────────────────────────────────
# Nota: la lista de lectura es ahora dinámica (autodiscovery del DB completo).
# Solo se mantiene una lista fija para los nodos de ESCRITURA esenciales.
PLC_WRITE_VARS = [
    "Ib_LUZ_VERDE",
    "Ib_LUZ_AZUL",
    "Ib_LUZ_ROJA",
    "Ib_LUZ_Pulsador_1",
    "Ib_LUZ_Pulsador_2",
    "Ib_Bit_VIDA_APP_PLC",
    "Ob_Subir_Vallas",
    "Ob_Bajar_Vallas"
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
        self.state     = {}  # Se llena dinámicamente con autodiscovery

        self.connected      = False
        self.active         = False          # True = modo PLC real
        self.error_msg      = ""
        self.latency_ms     = 0.0            # Latency (cycle time) in milliseconds
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

    def update_config(self, ip: str, port: str, db_name_fast: str, db_name_slow: str, hz_fast: float, hz_slow: float, namespace: str):
        """Actualiza la configuración y reinicia la conexión."""
        self.config.ip        = ip
        self.config.port      = port
        self.config.db_name_fast = db_name_fast
        self.config.db_name_slow = db_name_slow
        self.config.hz_fast   = float(hz_fast)
        self.config.hz_slow   = float(hz_slow)
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
        client.session_timeout = 30_000          # 30 s
        client.secure_channel_timeout = 30_000

        logger.info("[OPC UA] Conectando a %s ...", self.config.url)
        try:
            await asyncio.wait_for(client.connect(), timeout=10.0)
        except asyncio.TimeoutError:
            raise Exception("Timeout conectando al PLC (Revisa IP o red)")
        self.connected = True
        self.error_msg = ""
        logger.info("[OPC UA] ✓ Conectado a %s", self.config.url)

        try:
            from asyncua import ua
            fast_nodes = {}
            slow_nodes = {}

            async def discover_vars_in_node(node, target_dict, depth=0):
                if depth > 4:
                    return
                try:
                    node_class = await node.read_node_class()
                    if node_class == ua.NodeClass.Variable:
                        bname = await node.read_browse_name()
                        target_dict[bname.Name] = node
                    elif node_class == ua.NodeClass.Object:
                        for child in await node.get_children():
                            await discover_vars_in_node(child, target_dict, depth + 1)
                except Exception:
                    pass

            try:
                logger.info("[OPC UA] Buscando DBs '%s' y '%s' en Objects...", self.config.db_name_fast, self.config.db_name_slow)
                all_objects = await client.nodes.objects.get_children()

                db_fast_node = None
                db_slow_node = None
                server_interfaces_node = None
                for child in all_objects:
                    try:
                        bname = (await child.read_browse_name()).Name
                        if bname == self.config.db_name_fast:
                            db_fast_node = child
                        elif bname == self.config.db_name_slow:
                            db_slow_node = child
                        elif bname == "ServerInterfaces":
                            server_interfaces_node = child
                    except Exception:
                        pass

                # Explorar Fast DB
                if db_fast_node:
                    logger.info("[OPC UA] DB Rápido encontrado.")
                    await discover_vars_in_node(db_fast_node, fast_nodes, depth=0)
                elif server_interfaces_node:
                    await discover_vars_in_node(server_interfaces_node, fast_nodes, depth=0) # Respaldo

                # Explorar Slow DB
                if db_slow_node:
                    logger.info("[OPC UA] DB Lento encontrado.")
                    await discover_vars_in_node(db_slow_node, slow_nodes, depth=0)
                elif server_interfaces_node:
                    await discover_vars_in_node(server_interfaces_node, slow_nodes, depth=0) # Respaldo

                logger.info("[OPC UA] Discovery: %d variables rápidas, %d variables lentas", len(fast_nodes), len(slow_nodes))
            except Exception as e:
                logger.warning("[OPC UA] Error en discovery: %s", e)

            if not fast_nodes and not slow_nodes:
                logger.warning("[OPC UA] Discovery falló, usando fallback directo.")
                for var in PLC_WRITE_VARS:
                    try:
                        n = client.get_node(self.config.node_id_slow(var))
                        await n.read_value()
                        slow_nodes[var] = n
                    except Exception:
                        pass

            # Generamos listas inmutables para el bucle
            f_names = list(fast_nodes.keys())
            f_nodelist = list(fast_nodes.values())
            
            s_names = list(slow_nodes.keys())
            s_nodelist = list(slow_nodes.values())

            last_vida_value = None
            last_heartbeat = time.time()
            last_app_heartbeat = time.time()
            app_heartbeat_state = False
            
            last_slow_read_time = 0.0

            # ── BUCLE PRINCIPAL (ÚNICO HILO, DUAL RATE) ──
            while self.active:
                cycle_start = time.time()
                
                # Calcular si toca leer el DB Lento
                time_since_slow_read = cycle_start - last_slow_read_time
                read_slow = time_since_slow_read >= (1.0 / max(0.1, self.config.hz_slow))
                
                nodes_to_read = []
                nodes_to_read.extend(f_nodelist)
                if read_slow:
                    nodes_to_read.extend(s_nodelist)
                
                if nodes_to_read:
                    try:
                        values = await client.get_values(nodes_to_read)
                        
                        num_fast = len(f_nodelist)
                        f_values = values[:num_fast]
                        
                        # Actualizar estado de variables rápidas
                        for i, val in enumerate(f_values):
                            self.state[f_names[i]] = val if isinstance(val, (int, float, bool, str)) else str(val)
                            
                        # Actualizar estado de variables lentas si tocaba
                        if read_slow:
                            s_values = values[num_fast:]
                            for i, val in enumerate(s_values):
                                self.state[s_names[i]] = val if isinstance(val, (int, float, bool, str)) else str(val)
                            last_slow_read_time = cycle_start
                            
                    except Exception as e:
                        logger.warning("[OPC UA] Error en lectura: %s", e)
                        
                # ── Comprobar BIT VIDA (Heartbeat) PLC -> APP ────────────
                if "Ob_Bit_VIDA_PLC_APP" in slow_nodes:
                    current_vida = self.state.get("Ob_Bit_VIDA_PLC_APP")
                    if current_vida != last_vida_value:
                        last_heartbeat = time.time()
                        last_vida_value = current_vida
                    elif time.time() - last_heartbeat > 15.0:
                        raise Exception("Conexión perdida (BIT VIDA PLC estancado por 15s)")

                # ── Generar BIT VIDA APP -> PLC (Toggle 1s) ──────────────
                if time.time() - last_app_heartbeat >= 1.0:
                    app_heartbeat_state = not app_heartbeat_state
                    last_app_heartbeat = time.time()
                    if "Ib_Bit_VIDA_APP_PLC" in slow_nodes:
                        try:
                            v = ua.DataValue(ua.Variant(app_heartbeat_state, ua.VariantType.Boolean))
                            await slow_nodes["Ib_Bit_VIDA_APP_PLC"].write_value(v)
                        except Exception as e:
                            logger.warning("[OPC UA] Error escribiendo Ib_Bit_VIDA_APP_PLC: %s", e)

                # ── PROCESAR ESCRITURAS MANUALES ─────────────────────────
                while not self._write_queue.empty():
                    payload = self._write_queue.get_nowait()
                    for k, v in payload.items():
                        if k == "is_force":
                            continue
                        node = slow_nodes.get(k) or fast_nodes.get(k)
                        if node:
                            try:
                                v_type = ua.VariantType.Boolean if isinstance(v, bool) else (ua.VariantType.Float if isinstance(v, float) else ua.VariantType.Int16)
                                await node.write_value(ua.DataValue(ua.Variant(v, v_type)))
                                logger.info("[OPC UA] Escrito %s = %s", k, v)
                            except Exception as e:
                                logger.error("[OPC UA] Error escribiendo %s: %s", k, e)
                        else:
                            logger.warning("[OPC UA] Intento de escritura en var no encontrada: %s", k)
                    self._write_queue.task_done()

                # ── SLEEP para mantener ciclo RÁPIDO ─────────────────────
                elapsed = time.time() - cycle_start
                self.latency_ms = elapsed * 1000
                sleep_time = max(0.001, (1.0 / max(0.1, self.config.hz_fast)) - elapsed)
                await asyncio.sleep(sleep_time)

        finally:
            self.active = False
            await client.disconnect()
            self.connected = False
            logger.info("[OPC UA] Desconectado de %s", self.config.url)


# ── Instancia global (singleton) ───────────────────────────────────────────────
opcua_manager = OpcUaClientManager()
