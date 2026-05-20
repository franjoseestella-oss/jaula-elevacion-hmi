"""
opcua_client.py
───────────────
Cliente OPC UA persistente para PLC Siemens S7-1200.

Estrategia de comunicación robusta:
  - UNA sola sesión a la vez (el S7-1200 tiene límite muy bajo de sesiones).
  - Ciclo lento deliberado: NO más rápido de lo que el PLC puede responder.
  - Sin keepalive propio (asyncua lo gestiona internamente).
  - Sin lecturas previas a las escrituras (tipos cacheados en discovery).
  - Tolerancia a errores transitoria antes de forzar reconexión.
"""

import asyncio
import threading
import time
import logging
from typing import Optional, Dict

logger = logging.getLogger("opcua_client")

# ──────────────────────────────────────────────────────────────────────────────
# Configuración
# ──────────────────────────────────────────────────────────────────────────────
class OpcUaConfig:
    ip: str          = "192.168.0.1"
    port: str        = "4840"
    db_name: str     = "DB25_OPC_UA_SCAN_LENTO"
    db_name_fast: str = "DB25_OPC_UA_SCAN_LENTO"
    db_name_slow: str = "DB25_OPC_UA_SCAN_LENTO"
    frequency: float = 100.0
    hz_fast: float   = 100.0
    hz_slow: float   = 100.0
    namespace: str   = "3"

    @property
    def url(self) -> str:
        return f"opc.tcp://{self.ip}:{self.port}"

    def node_id_slow(self, var_name: str) -> str:
        return f'ns={self.namespace};s="{self.db_name}"."{var_name}"'


# ──────────────────────────────────────────────────────────────────────────────
# Variables
# ──────────────────────────────────────────────────────────────────────────────
PLC_WRITE_VARS = [
    "Ib_LUZ_VERDE", "Ib_LUZ_AZUL", "Ib_LUZ_ROJA",
    "Ib_LUZ_Pulsador_1", "Ib_LUZ_Pulsador_2",
    "Ib_Bit_VIDA_APP_PLC", "Ob_Subir_Vallas", "Ob_Bajar_Vallas"
]

# Variables críticas leídas en cada ciclo rápido
FAST_VARS_SET = {
    "OR_Altura_Carretilla", "IW_Altura_Relativa",
    "Ib_Restart_Temporizador", "Ob_Ready_Temporizador",
    "Ib_Start_Ascenso", "Ib_Start_Descenso",
    "Ob_Iniciar_Secuencia", "Ob_Abortar_Secuencia", "Ob_Poner_Pegatina"
}

# ──────────────────────────────────────────────────────────────────────────────
# Tiempos de ciclo reales del S7-1200 (medidos empíricamente)
# fast (~6 vars) ≈ 90 ms  →  limitamos a máx 8 Hz en lectura rápida
# slow (~38 vars) ≈ 390 ms →  limitamos a máx 2 Hz en lectura lenta
# ──────────────────────────────────────────────────────────────────────────────
FAST_READ_TIMEOUT  = 5.0   # s – si get_values tarda más → reconectar
SLOW_READ_TIMEOUT  = 8.0   # s – ciclo completo puede ser más lento
WRITE_TIMEOUT      = 3.0   # s – timeout individual por escritura
MAX_CONSEC_ERRORS  = 3     # número de ciclos con error antes de reconectar
SLOW_CYCLE_EVERY   = 8     # un ciclo completo cada N ciclos rápidos


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
        self.state: Dict = {}

        self.connected      = False
        self.active         = False
        self.error_msg      = ""
        self.latency_ms     = 0.0
        self._write_queue: asyncio.Queue = None   # type: ignore
        self._loop: asyncio.AbstractEventLoop = None  # type: ignore
        self._thread: threading.Thread = None     # type: ignore

    # ── API pública ────────────────────────────────────────────────────────────

    def enable(self):
        if self.active and self._thread and self._thread.is_alive():
            return
        self.active = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="opcua-thread")
        self._thread.start()
        logger.info("[OPC UA] Cliente activado -> %s", self.config.url)

    def disable(self):
        self.active    = False
        self.connected = False
        self.error_msg = "Modo simulacion activo"
        logger.info("[OPC UA] Cliente desactivado (modo simulacion)")

    def write(self, payload: dict):
        if not self.active or not self._loop:
            return
        self._loop.call_soon_threadsafe(self._write_queue.put_nowait, payload)

    def update_config(self, ip: str, port: str,
                      db_name_fast: str = "", db_name_slow: str = "",
                      hz_fast: float = 100.0, hz_slow: float = 100.0,
                      namespace: str = "3",
                      db_name: Optional[str] = None,
                      frequency: Optional[float] = None):
        self.config.ip        = ip
        self.config.port      = port
        resolved_db           = db_name if db_name is not None else db_name_fast
        resolved_freq         = frequency if frequency is not None else hz_fast
        self.config.db_name   = resolved_db
        self.config.db_name_fast = resolved_db
        self.config.db_name_slow = resolved_db
        self.config.frequency = float(resolved_freq)
        self.config.hz_fast   = float(resolved_freq)
        self.config.hz_slow   = float(resolved_freq)
        self.config.namespace = namespace
        if self.active:
            self.disable()
            time.sleep(0.5)
            self.enable()

    # ── Loop asíncrono interno ─────────────────────────────────────────────────

    def _run_loop(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._write_queue = asyncio.Queue()
        try:
            self._loop.run_until_complete(self._connect_and_poll())
        except Exception as e:
            logger.error("[OPC UA] Loop terminado: %s", e)
        finally:
            self._loop.close()
            self.connected = False

    async def _connect_and_poll(self):
        """Bucle de reconexión con backoff. Una sesión a la vez."""
        retry_delay = 5.0
        max_delay   = 30.0

        while self.active:
            try:
                await self._session()
                retry_delay = 5.0   # sesión terminó ok → reiniciar delay
            except Exception as e:
                self.connected = False
                err_str = str(e)
                self.error_msg = err_str
                is_too_many = "BadTooManySessions" in err_str
                # Si el PLC rechaza por límite de sesiones, esperar
                # al menos que expire la sesión anterior (30 s)
                wait = 35.0 if is_too_many else retry_delay
                logger.warning("[OPC UA] Reconectando en %.0f s... (%s)", wait, err_str)
                await asyncio.sleep(wait)
                if not is_too_many:
                    retry_delay = min(retry_delay * 1.5, max_delay)

    async def _session(self):
        """Una sesión completa: conecta, descubre, lee/escribe y cierra."""
        try:
            from asyncua import Client, ua
        except ImportError:
            self.error_msg = "asyncua no instalado"
            self.active = False
            return

        client = Client(url=self.config.url)
        # El S7-1200 negocia 30 000 ms; pedimos lo mismo
        client.session_timeout        = 30_000
        client.secure_channel_timeout = 30_000

        logger.info("[OPC UA] Conectando a %s ...", self.config.url)
        try:
            await asyncio.wait_for(client.connect(), timeout=10.0)
        except asyncio.TimeoutError:
            raise Exception("Timeout conectando (10 s)")
        except Exception as e:
            raise Exception(f"Error al conectar: {e}")

        self.connected = True
        self.error_msg = ""
        logger.info("[OPC UA] Conectado a %s", self.config.url)

        try:
            fast_nodes: Dict = {}
            slow_nodes: Dict = {}
            node_types: Dict = {}   # caché de VariantType para escrituras

            # ── Discovery ────────────────────────────────────────────────────
            async def discover(node, depth=0):
                if depth > 4:
                    return
                try:
                    nc = await node.read_node_class()
                    if nc == ua.NodeClass.Variable:
                        bn = await node.read_browse_name()
                        name = bn.Name
                        target = fast_nodes if name in FAST_VARS_SET else slow_nodes
                        target[name] = node
                    elif nc == ua.NodeClass.Object:
                        for child in await node.get_children():
                            await discover(child, depth + 1)
                except Exception:
                    pass

            db_node = None
            async def find_db(node, depth=1):
                nonlocal db_node
                if depth > 3 or db_node:
                    return
                try:
                    for child in await node.get_children():
                        try:
                            name = (await child.read_browse_name()).Name
                            if name == self.config.db_name:
                                db_node = child
                                return
                            await find_db(child, depth + 1)
                        except Exception:
                            pass
                except Exception:
                    pass

            logger.info("[OPC UA] Buscando DB '%s'...", self.config.db_name)
            await find_db(client.nodes.objects)

            if db_node:
                await discover(db_node)
                logger.info("[OPC UA] Discovery: %d vars rapidas, %d vars lentas",
                            len(fast_nodes), len(slow_nodes))
            else:
                logger.warning("[OPC UA] DB no encontrado: %s", self.config.db_name)

            # Fallback por NodeId si discovery vacío
            if not fast_nodes and not slow_nodes:
                for var in PLC_WRITE_VARS:
                    try:
                        n = client.get_node(self.config.node_id_slow(var))
                        await n.read_value()
                        (fast_nodes if var in FAST_VARS_SET else slow_nodes)[var] = n
                    except Exception:
                        pass

            # Cachear tipos de dato para evitar lecturas extra en escrituras
            for name, node in {**fast_nodes, **slow_nodes}.items():
                try:
                    dv = await node.read_data_value()
                    if dv and dv.Value is not None:
                        node_types[name] = dv.Value.VariantType
                except Exception:
                    pass
            logger.info("[OPC UA] Tipos cacheados: %d nodos", len(node_types))

            # Listas inmutables para el ciclo
            f_names    = list(fast_nodes.keys())
            f_nodelist = list(fast_nodes.values())
            all_names  = f_names + list(slow_nodes.keys())
            all_nodes  = f_nodelist + list(slow_nodes.values())

            # ── Estado del bucle ──────────────────────────────────────────────
            last_app_heartbeat  = time.time()
            app_heartbeat_state = False
            consec_errors       = 0
            cycle_counter       = 0

            # ── Bucle principal ───────────────────────────────────────────────
            while self.active:
                cycle_start = time.time()

                # Decidir ciclo rápido (solo vars críticas) o completo
                read_all      = (cycle_counter % SLOW_CYCLE_EVERY == 0)
                cycle_counter += 1
                nodes_now     = all_nodes  if read_all else f_nodelist
                names_now     = all_names  if read_all else f_names
                timeout_now   = SLOW_READ_TIMEOUT if read_all else FAST_READ_TIMEOUT

                # ── Lectura en bloque ─────────────────────────────────────────
                if nodes_now:
                    try:
                        values = await asyncio.wait_for(
                            client.get_values(nodes_now),
                            timeout=timeout_now
                        )
                        for i, val in enumerate(values):
                            self.state[names_now[i]] = (
                                val if isinstance(val, (int, float, bool, str)) else str(val)
                            )
                        consec_errors = 0

                    except asyncio.TimeoutError:
                        # Timeout en lectura = estado TCP inconsistente → reconectar
                        consec_errors += 1
                        logger.warning("[OPC UA] Timeout lectura (ciclo %s, intento %d/%d)",
                                       "completo" if read_all else "rapido",
                                       consec_errors, MAX_CONSEC_ERRORS)
                        if consec_errors >= MAX_CONSEC_ERRORS:
                            raise Exception(f"Reconectando: {consec_errors} timeouts consecutivos")
                        # Pausa breve antes de reintentar (da tiempo al PLC)
                        await asyncio.sleep(1.0)
                        continue

                    except Exception as e:
                        consec_errors += 1
                        logger.warning("[OPC UA] Error lectura (intento %d/%d): %s",
                                       consec_errors, MAX_CONSEC_ERRORS, e)
                        if consec_errors >= MAX_CONSEC_ERRORS:
                            raise Exception(f"Reconectando: {consec_errors} errores consecutivos ({e})")
                        await asyncio.sleep(0.5)
                        continue

                # ── Heartbeat APP → PLC (cada 2 s, sin leer tipo extra) ───────
                now = time.time()
                if now - last_app_heartbeat >= 2.0:
                    last_app_heartbeat  = now
                    app_heartbeat_state = not app_heartbeat_state
                    node_vida = slow_nodes.get("Ib_Bit_VIDA_APP_PLC") or fast_nodes.get("Ib_Bit_VIDA_APP_PLC")
                    if node_vida:
                        try:
                            v_type = node_types.get("Ib_Bit_VIDA_APP_PLC", ua.VariantType.Boolean)
                            await asyncio.wait_for(
                                node_vida.write_value(
                                    ua.DataValue(ua.Variant(app_heartbeat_state, v_type))
                                ),
                                timeout=WRITE_TIMEOUT
                            )
                        except Exception as e:
                            logger.warning("[OPC UA] Heartbeat fallo: %s", e)

                # ── Escrituras manuales ───────────────────────────────────────
                while not self._write_queue.empty():
                    try:
                        payload = self._write_queue.get_nowait()
                        for k, v in payload.items():
                            if k == "is_force":
                                continue
                            node = fast_nodes.get(k) or slow_nodes.get(k)
                            if not node:
                                continue
                            # Usar tipo cacheado (sin leer el nodo de nuevo)
                            v_type = node_types.get(k)
                            if v_type is None:
                                v_type = (
                                    ua.VariantType.Boolean if isinstance(v, bool)
                                    else ua.VariantType.Float if isinstance(v, float)
                                    else ua.VariantType.Int16
                                )
                            # Coerción de tipo
                            if v_type == ua.VariantType.Boolean:
                                coerced = bool(v)
                            elif v_type in (ua.VariantType.Float, ua.VariantType.Double):
                                coerced = float(v)
                            elif v_type in (
                                ua.VariantType.Int16, ua.VariantType.Int32, ua.VariantType.Int64,
                                ua.VariantType.UInt16, ua.VariantType.UInt32, ua.VariantType.UInt64
                            ):
                                coerced = int(v)
                            else:
                                coerced = v
                            try:
                                await asyncio.wait_for(
                                    node.write_value(ua.DataValue(ua.Variant(coerced, v_type))),
                                    timeout=WRITE_TIMEOUT
                                )
                            except Exception as we:
                                logger.error("[OPC UA] Error escritura %s=%s: %s", k, v, we)
                        self._write_queue.task_done()
                    except asyncio.QueueEmpty:
                        break
                    except Exception as e:
                        logger.warning("[OPC UA] Error procesando escritura: %s", e)
                        break

                # ── Cadencia: respetar el ciclo mínimo del PLC ────────────────
                elapsed = time.time() - cycle_start
                self.latency_ms = elapsed * 1000
                # No enviar peticiones más rápido de lo que el PLC puede responder
                # fast ~90 ms → mín 100 ms entre ciclos rápidos
                # slow ~390 ms → ya consume su propio tiempo
                min_cycle = 0.10 if not read_all else 0.0
                sleep_t   = max(0.01, min_cycle - elapsed)
                await asyncio.sleep(sleep_t)

        finally:
            try:
                await asyncio.wait_for(client.disconnect(), timeout=5.0)
            except Exception:
                pass
            self.connected = False
            logger.info("[OPC UA] Sesion cerrada (%s)", self.config.url)


# ── Instancia global (singleton) ───────────────────────────────────────────────
opcua_manager = OpcUaClientManager()
