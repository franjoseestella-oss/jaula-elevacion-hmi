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
                
                db_fast_node = None
                db_slow_node = None
                async def find_dbs_recursive(node, depth=1, max_depth=3):
                    nonlocal db_fast_node, db_slow_node
                    if depth > max_depth:
                        return
                    if db_fast_node and db_slow_node:
                        return # Encontrados ambos
                        
                    try:
                        children = await node.get_children()
                        for child in children:
                            try:
                                bname = (await child.read_browse_name()).Name
                                if bname == self.config.db_name_fast and not db_fast_node:
                                    db_fast_node = child
                                elif bname == self.config.db_name_slow and not db_slow_node:
                                    db_slow_node = child
                                
                                # Seguimos buscando hacia abajo
                                await find_dbs_recursive(child, depth + 1, max_depth)
                            except Exception:
                                pass
                    except Exception:
                        pass

                await find_dbs_recursive(client.nodes.objects)

                # Explorar Fast DB
                if db_fast_node:
                    logger.info("[OPC UA] DB Rápido encontrado.")
                    await discover_vars_in_node(db_fast_node, fast_nodes, depth=0)
                else:
                    logger.warning("[OPC UA] DB Rápido NO encontrado: %s", self.config.db_name_fast)

                # Explorar Slow DB
                if db_slow_node:
                    logger.info("[OPC UA] DB Lento encontrado.")
                    await discover_vars_in_node(db_slow_node, slow_nodes, depth=0)
                else:
                    logger.warning("[OPC UA] DB Lento NO encontrado: %s", self.config.db_name_slow)

                logger.info("[OPC UA] Discovery finalizado: %d variables rápidas, %d variables lentas", len(fast_nodes), len(slow_nodes))
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

            # Unificamos para lectura en bloque único (evita saturar el PLC con peticiones concurrentes)
            all_names = f_names + s_names
            all_nodes = f_nodelist + s_nodelist

            last_vida_value = None
            last_heartbeat = time.time()
            last_app_heartbeat = time.time()
            app_heartbeat_state = False
            first_fail_time = 0.0

            last_slow_read_time = 0.0

            async def main_loop():
                nonlocal last_vida_value, last_heartbeat, last_app_heartbeat, app_heartbeat_state, first_fail_time
                
                while self.active:
                    cycle_start = time.time()
                    
                    # ── 1. Lectura UNIFICADA de TODO (máxima velocidad)
                    try:
                        if all_nodes:
                            values = await client.get_values(all_nodes)
                            for i, val in enumerate(values):
                                self.state[all_names[i]] = val if isinstance(val, (int, float, bool, str)) else str(val)
                            first_fail_time = 0.0
                    except Exception as e:
                        if first_fail_time == 0.0:
                            logger.warning("[OPC UA] Lectura unificada falló (%s).", e)
                            first_fail_time = time.time()
                        elif time.time() - first_fail_time > 5.0:
                            raise Exception("Conexión perdida: >5s sin lecturas exitosas.")
                        
                        # Fallback individual
                        for i, n in enumerate(all_nodes):
                            try:
                                val = await n.read_value()
                                self.state[all_names[i]] = val if isinstance(val, (int, float, bool, str)) else str(val)
                            except:
                                pass

                    # ── 2. Comprobar BIT VIDA PLC -> APP
                    try:
                        current_vida = self.state.get("Ob_Bit_VIDA_PLC_APP")
                        if current_vida != last_vida_value:
                            last_heartbeat = time.time()
                            last_vida_value = current_vida
                        elif time.time() - last_heartbeat > 10.0:
                            raise Exception("Conexión perdida (BIT VIDA PLC estancado por >10s)")
                    except Exception as e:
                        logger.error("[OPC UA] Error heartbeat lectura: %s", e)
                        if "Conexión perdida" in str(e):
                            raise e

                    # ── 3. Generar BIT VIDA APP -> PLC (Toggle 1s)
                    try:
                        if time.time() - last_app_heartbeat >= 1.0:
                            app_heartbeat_state = not app_heartbeat_state
                            last_app_heartbeat = time.time()
                            node_vida = slow_nodes.get("Ib_Bit_VIDA_APP_PLC") or fast_nodes.get("Ib_Bit_VIDA_APP_PLC")
                            if node_vida:
                                v = ua.DataValue(ua.Variant(app_heartbeat_state, ua.VariantType.Boolean))
                                await node_vida.write_value(v)
                    except Exception as e:
                        logger.warning("[OPC UA] Error escribiendo heartbeat: %s", e)

                    # ── 4. PROCESAR ESCRITURAS MANUALES
                    try:
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
                                    except Exception as write_err:
                                        logger.error("[OPC UA] Error escribiendo %s = %s: %s", k, v, write_err)
                            self._write_queue.task_done()
                    except Exception as e:
                        logger.warning("[OPC UA] Error procesando escrituras: %s", e)
                            
                    elapsed = time.time() - cycle_start
                    self.latency_ms = elapsed * 1000
                    # Sin límite artificial, leer tan rápido como el PLC y la red lo permitan
                    await asyncio.sleep(0.001)

            await main_loop()

        finally:
            # NO setear self.active = False aquí. self.active define la "intención" de estar conectado.
            # Si self.active se apaga, el bucle de autoreconexión muere.
            try:
                await client.disconnect()
            except Exception:
                pass
            self.connected = False
            logger.info("[OPC UA] Desconectado de %s", self.config.url)


# ── Instancia global (singleton) ───────────────────────────────────────────────
opcua_manager = OpcUaClientManager()
