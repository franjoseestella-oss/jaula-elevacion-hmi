from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel
import socket
import asyncio
import random
import time
import os
import sys

from database.database import engine, get_db
from database.models import init_db, ErpCarretilla
from database.crud import create_log, get_logs
from erp_sync import parse_and_sync_dat
from opcua_client import opcua_manager

# ─────────────────────────────────────────────────────────────
# Resolución de rutas (compatible con PyInstaller --onefile)
# ─────────────────────────────────────────────────────────────
def resource_path(relative_path: str) -> str:
    """Devuelve la ruta absoluta, funciona tanto en dev como en .exe PyInstaller."""
    if hasattr(sys, '_MEIPASS'):
        base = sys._MEIPASS
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, relative_path)

# ─────────────────────────────────────────────────────────────
# Inicialización de la aplicación
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="HMI Jaula Elevación – API",
    description="Backend para el sistema HMI de pruebas de elevación de carretillas Logisnext.",
    version="2.0.0",
)

@app.on_event("startup")
def on_startup():
    """Inicializa las tablas de BD al arrancar el servidor."""
    try:
        init_db()
        print("[OK] Base de datos lista.")
    except Exception as e:
        print(f"[WARN] No se pudo inicializar la BD: {e}")
        print("   El servidor arrancara en modo solo-simulacion.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# ERP REST Endpoints — tablas reales DAFEED
# ─────────────────────────────────────────────────────────────

@app.get("/erp/bastidor/{bastidor}")
def buscar_bastidor(bastidor: str, db: Session = Depends(get_db)):
    """
    Busca una carretilla por BASTIDOR.
    Prioridad: JAULA_ERP (datos completos del DAT) -> Secuencia_Mastiles (DAFEED live).
    """
    bastidor_q = bastidor.strip()

    # ── 1. Buscar en JAULA_ERP (caché del DAT con todos los tiempos) ──
    erp = db.query(ErpCarretilla).filter(
        ErpCarretilla.bastidor.ilike(f"%{bastidor_q}%")
    ).first()

    if erp:
        return {
            "status": "found",
            "fuente": "JAULA_ERP",
            "bastidor": erp.bastidor,
            "secuencia": erp.secuencia,
            "modelo": erp.modelo,
            "mastil": erp.mastil,
            "fecha_montaje": erp.fecha_montaje,
            "descripcion": erp.modelo,
            "referencia_mastil": erp.mastil,
            "longitud_mm": erp.altura_max_interm,
            "maquina": None,
            "familia": None,
            "tonelaje": None,
            # Parámetros de prueba — datos reales del DAT
            "altura_max_interm": erp.altura_max_interm,
            "capac_interm_1": erp.capac_interm_1,
            "capac_interm_2": erp.capac_interm_2,
            "capac_interm_3": erp.capac_interm_3,
            "tpo_elevac_min": erp.tpo_elevac_min,
            "tpo_elevac_max": erp.tpo_elevac_max,
            "tpo_descenso_min": erp.tpo_descenso_min,
            "tpo_descenso_max": erp.tpo_descenso_max,
            "tpo_incl_adel_max": erp.tpo_incl_adel_max,
            "tpo_incl_atras_max": erp.tpo_incl_atras_max,
            "tpo_elev_min_scarga": erp.tpo_elev_min_scarga,
            "tpo_elev_max_scarga": erp.tpo_elev_max_scarga,
            "tpo_desc_min_scarga": erp.tpo_desc_min_scarga,
            "tpo_desc_max_scarga": erp.tpo_desc_max_scarga,
        }


    # ── 2. Fallback: Secuencia_Mastiles (DAFEED live) ──
    try:
        bast_like = f"%{bastidor_q}%"
        with engine.connect() as conn:
            row = conn.execute(
                text("""
                    SELECT TOP 1
                        TRIM(SECUENCIA)   AS secuencia,
                        TRIM(REFERENCIA)  AS referencia,
                        TRIM(DESCRIPCION) AS descripcion,
                        TRIM(BASTIDOR)    AS bastidor
                    FROM Secuencia_Mastiles
                    WHERE BASTIDOR LIKE :bast
                    ORDER BY SECUENCIA DESC
                """),
                {"bast": bast_like}
            ).fetchone()

            if not row:
                raise HTTPException(
                    status_code=404,
                    detail=f"Bastidor '{bastidor}' no encontrado. Sincroniza el DAT o verifica DAFEED."
                )

            data = dict(row._mapping)
            referencia = data["referencia"].strip()

            ref_row = conn.execute(
                text("""
                    SELECT TOP 1
                        [DESCRIPCION MASTIL] AS mastil_desc,
                        [LONGITUD _MASTIL (m)] AS longitud_mm,
                        [REF# MASTIL] AS ref_mastil,
                        MAQUINA, PISTA, FAM, Ton
                    FROM REFERENCIAS_MASTILES
                    WHERE [REF# MASTIL] = :ref
                """),
                {"ref": referencia}
            ).fetchone()

            ref_data = dict(ref_row._mapping) if ref_row else {}

        longitud = ref_data.get("longitud_mm")
        return {
            "status": "found",
            "fuente": "DAFEED",
            "bastidor": data["bastidor"],
            "secuencia": data["secuencia"],
            "modelo": ref_data.get("mastil_desc") or data["descripcion"],
            "mastil": ref_data.get("ref_mastil") or referencia,
            "fecha_montaje": None,
            "descripcion": data["descripcion"],
            "referencia_mastil": referencia,
            "longitud_mm": longitud,
            "maquina": ref_data.get("MAQUINA"),
            "familia": ref_data.get("FAM"),
            "tonelaje": ref_data.get("Ton"),
            "altura_max_interm": int(longitud) if longitud else None,
            "capac_interm_1": None, "capac_interm_2": None, "capac_interm_3": None,
            "tpo_elevac_min": None, "tpo_elevac_max": None,
            "tpo_descenso_min": None, "tpo_descenso_max": None,
            "tpo_incl_adel_max": None, "tpo_incl_atras_max": None,
            "tpo_elev_min_scarga": None, "tpo_elev_max_scarga": None,
            "tpo_desc_min_scarga": None, "tpo_desc_max_scarga": None,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=404,
            detail=f"Bastidor '{bastidor}' no encontrado en JAULA_ERP ni en DAFEED."
        )


# ─────────────────────────────────────────────────────────────
# Búsqueda por SECUENCIA
# ─────────────────────────────────────────────────────────────

def _erp_row_to_dict(erp) -> dict:
    """Serializa un objeto ErpCarretilla al formato de respuesta estándar."""
    return {
        "status": "found",
        "fuente": "JAULA_ERP",
        "bastidor":          erp.bastidor,
        "secuencia":         erp.secuencia,
        "modelo":            erp.modelo,
        "mastil":            erp.mastil,
        "fecha_montaje":     erp.fecha_montaje,
        "descripcion":       erp.modelo,
        "referencia_mastil": erp.mastil,
        "longitud_mm":       erp.altura_max_interm,
        "maquina": None, "familia": None, "tonelaje": None,
        "altura_max_interm":     erp.altura_max_interm,
        "capac_interm_1":        erp.capac_interm_1,
        "capac_interm_2":        erp.capac_interm_2,
        "capac_interm_3":        erp.capac_interm_3,
        "tpo_elevac_min":        erp.tpo_elevac_min,
        "tpo_elevac_max":        erp.tpo_elevac_max,
        "tpo_descenso_min":      erp.tpo_descenso_min,
        "tpo_descenso_max":      erp.tpo_descenso_max,
        "tpo_incl_adel_max":     erp.tpo_incl_adel_max,
        "tpo_incl_atras_max":    erp.tpo_incl_atras_max,
        "tpo_elev_min_scarga":   erp.tpo_elev_min_scarga,
        "tpo_elev_max_scarga":   erp.tpo_elev_max_scarga,
        "tpo_desc_min_scarga":   erp.tpo_desc_min_scarga,
        "tpo_desc_max_scarga":   erp.tpo_desc_max_scarga,
    }


@app.get("/erp/secuencia/{secuencia}")
def buscar_secuencia(secuencia: str, db: Session = Depends(get_db)):
    """
    Busca una carretilla por número de SECUENCIA (4 dígitos) en JAULA_ERP.
    Acepta búsqueda parcial — p.ej. '210' encuentra '0210'.
    """
    seq_q = secuencia.strip().zfill(4)   # rellena con ceros a la izquierda

    erp = db.query(ErpCarretilla).filter(
        ErpCarretilla.secuencia.ilike(f"%{seq_q}%")
    ).first()

    if erp:
        return _erp_row_to_dict(erp)

    raise HTTPException(
        status_code=404,
        detail=f"Secuencia '{secuencia}' no encontrada en JAULA_ERP. Verifica el número o sincroniza el DAT."
    )



@app.get("/erp/operarios/{query}")
def buscar_operario(query: str):
    """
    Busca un operario en la tabla DAFEED.dbo.Operarios por CODIGO o APELLIDOS.
    """
    try:
        with engine.connect() as conn:
            query_str = f"%{query}%"
            if query.isnumeric():
                q_code = query.zfill(8)
                rows = conn.execute(
                    text("SELECT CODIGO, APELLIDOS, TARJETA FROM Operarios WHERE CODIGO = :c OR CODIGO = :q_raw OR APELLIDOS LIKE :q"),
                    {"c": q_code, "q_raw": query, "q": query_str}
                ).fetchall()
            else:
                rows = conn.execute(
                    text("SELECT CODIGO, APELLIDOS, TARJETA FROM Operarios WHERE CODIGO = :q_raw OR APELLIDOS LIKE :q"),
                    {"q_raw": query, "q": query_str}
                ).fetchall()
            
            if not rows:
                raise HTTPException(status_code=404, detail="Operario no encontrado")
            
            results = []
            for r in rows:
                d = dict(r._mapping)
                if d.get("CODIGO"):
                    d["CODIGO"] = d["CODIGO"].lstrip("0") or "0"
                results.append(d)
            return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/erp/carretillas")
def listar_carretillas(limit: int = 500, db: Session = Depends(get_db)):
    """
    Lista todas las carretillas de JAULA_ERP con todos sus campos técnicos.
    Fallback: Secuencia_Mastiles en DAFEED si está disponible.
    """
    erp_rows = (
        db.query(ErpCarretilla)
        .order_by(ErpCarretilla.secuencia.desc())
        .limit(limit)
        .all()
    )
    if erp_rows:
        bastidores = [r.bastidor for r in erp_rows if r.bastidor]
        from database.models import LogTabla
        pruebas = db.query(LogTabla.NBASTIDOR, LogTabla.OK_NOK)\
            .filter(LogTabla.NBASTIDOR.in_(bastidores))\
            .order_by(LogTabla.id.asc())\
            .all()
        
        estado_por_bastidor = {}
        for b, e in pruebas:
            if e:
                if e.upper() == 'OK':
                    estado_por_bastidor[b] = 'FINALIZADO_OK'
                elif e.upper() == 'NOK':
                    estado_por_bastidor[b] = 'ERROR'
                else:
                    estado_por_bastidor[b] = e

        items = [
            {
                # ── Identificación ──────────────────────────────
                "bastidor":         r.bastidor or "",
                "secuencia":        r.secuencia or "",
                "descripcion":      r.modelo or "",
                "referencia":       r.mastil or "",
                "modelo":           r.modelo or "",
                "mastil":           r.mastil or "",
                "fecha_montaje":    r.fecha_montaje or "",
                "fecha_importacion": str(r.fecha_importacion)[:10] if r.fecha_importacion else "",
                # ── Estado de Prueba ────────────────────────────
                "estado_prueba":    estado_por_bastidor.get(r.bastidor, "PENDIENTE"),
                # ── Geometría ───────────────────────────────────
                "altura_max_interm": r.altura_max_interm,
                # ── Capacidades intermedias (kg) ─────────────────
                "capac_interm_1":   r.capac_interm_1,
                "capac_interm_2":   r.capac_interm_2,
                "capac_interm_3":   r.capac_interm_3,
                # ── Tiempos CON CARGA (décimas de segundo) ───────
                "tpo_elevac_min":   r.tpo_elevac_min,
                "tpo_elevac_max":   r.tpo_elevac_max,
                "tpo_descenso_min": r.tpo_descenso_min,
                "tpo_descenso_max": r.tpo_descenso_max,
                "tpo_incl_adel_max":  r.tpo_incl_adel_max,
                "tpo_incl_atras_max": r.tpo_incl_atras_max,
                # ── Tiempos SIN CARGA (décimas de segundo) ───────
                "tpo_elev_min_scarga":  r.tpo_elev_min_scarga,
                "tpo_elev_max_scarga":  r.tpo_elev_max_scarga,
                "tpo_desc_min_scarga":  r.tpo_desc_min_scarga,
                "tpo_desc_max_scarga":  r.tpo_desc_max_scarga,
            }
            for r in erp_rows
        ]
        return {"total": len(items), "items": items, "fuente": "JAULA_ERP"}

    # — Fallback DAFEED —
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT TOP :lim
                        TRIM(SECUENCIA)   AS secuencia,
                        TRIM(REFERENCIA)  AS referencia,
                        TRIM(DESCRIPCION) AS descripcion,
                        TRIM(BASTIDOR)    AS bastidor
                    FROM Secuencia_Mastiles
                    ORDER BY SECUENCIA DESC
                """),
                {"lim": limit}
            ).fetchall()
        items = [dict(r._mapping) for r in rows]
        return {"total": len(items), "items": items, "fuente": "DAFEED"}
    except Exception:
        pass

    return {"total": 0, "items": [], "fuente": "ninguna", "mensaje": "Importa el fichero DATOSMAST.DAT con SYNC DAT"}



@app.post("/erp/sync")
def sincronizar_erp():
    """
    Importa el fichero DATOSMAST.DAT a la tabla local JAULA_ERP (caché de ERP).
    Los datos en tiempo real se consultan directamente desde DAFEED.
    """
    resultado = parse_and_sync_dat()
    if resultado["status"] == "error":
        raise HTTPException(status_code=500, detail=resultado["message"])
    return resultado


@app.get("/erp/status")
def estado_erp():
    """Verifica la conexión a DAFEED y devuelve el número de registros."""
    try:
        with engine.connect() as conn:
            count = conn.execute(
                text("SELECT COUNT(*) FROM Secuencia_Mastiles")
            ).scalar()
        return {"connected": True, "total_registros": count, "fuente": "DAFEED/Secuencia_Mastiles"}
    except Exception as e:
        return {"connected": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────
# Configuración Dispositivos (Datalogic)
# ─────────────────────────────────────────────────────────────

class DatalogicConfig(BaseModel):
    connType: str
    ip: str
    port: str
    comPort: str
    baudRate: str

@app.post("/config/datalogic/test")
def test_datalogic_connection(config: DatalogicConfig):
    """Prueba la conexión al escáner Datalogic por TCP o Serial."""
    if config.connType == "tcp":
        try:
            port_int = int(config.port)
            s = socket.create_connection((config.ip, port_int), timeout=2)
            s.close()
            return {"status": "ok", "message": f"Conexión TCP exitosa a {config.ip}:{port_int}"}
        except Exception as e:
            return {"status": "error", "message": f"Fallo TCP ({config.ip}:{config.port}): {str(e)}"}
    elif config.connType == "serial":
        try:
            import serial
            baud_int = int(config.baudRate)
            ser = serial.Serial(config.comPort, baud_int, timeout=2)
            ser.close()
            return {"status": "ok", "message": f"Conexión Serial exitosa en {config.comPort}"}
        except ImportError:
            return {"status": "error", "message": "Falta la librería pyserial. Ejecuta: pip install pyserial"}
        except Exception as e:
            return {"status": "error", "message": f"Fallo Serial ({config.comPort}): {str(e)}"}
    return {"status": "error", "message": "Tipo de conexión inválido."}

# ─────────────────────────────────────────────────────────────
# PLC OPC UA — Simulación de lectura y escritura
# ─────────────────────────────────────────────────────────────

# Estado global simulado
plc_sim_state = {
    # Salidas (Comandos HMI -> PLC)
    "b_LUZ_VERDE": False,
    "b_LUZ_AZUL": False,
    "b_LUZ_ROJA": False,
    "Ob_Subir_Vallas": False,
    "Ob_Bajar_Vallas": False,

    # Entradas Analógicas (Simuladas)
    "R_Altura_Carretilla": 0.0,
    "W_Numero_Pallets": 0.0,

    # Entradas Digitales (Simuladas)
    "b_Iniciar_Secuencia": False,
    "b_Poner_Pegatina": False,
    "b_Abortar_Secuencia": False,
    
    "Ob_Dtec_Valla_1_trabajo_LH": False,
    "Ob_Dtec_Valla_1_trabajo_RH": False,
    
    "Ob_Dtec_Valla_2_trabajo_LH": False,
    "Ob_Dtec_Valla_2_trabajo_RH": False,
}

global_force_mode = False

class PlcWriteParams(BaseModel):
    b_LUZ_VERDE: bool | None = None
    b_LUZ_AZUL: bool | None = None
    b_LUZ_ROJA: bool | None = None
    Ob_Subir_Vallas: bool | None = None
    Ob_Bajar_Vallas: bool | None = None
    R_Altura_Carretilla: float | None = None
    W_Numero_Pallets: float | None = None
    b_Iniciar_Secuencia: bool | None = None
    b_Poner_Pegatina: bool | None = None
    b_Abortar_Secuencia: bool | None = None
    is_force: bool = False

class PlcConfigModel(BaseModel):
    ip: str
    port: str
    dbName: str
    namespace: str
    isSimulation: bool

@app.post("/config/plc")
def update_plc_config(config: PlcConfigModel):
    """
    Actualiza la configuración OPC UA.
    Si isSimulation es falso, arranca la conexión real al PLC.
    """
    opcua_manager.update_config(
        ip=config.ip, 
        port=config.port, 
        db_name=config.dbName, 
        namespace=config.namespace
    )
    if config.isSimulation:
        opcua_manager.disable()
    else:
        opcua_manager.enable()
        
    return {"status": "ok", "message": "Configuración guardada"}

@app.get("/plc/scan_ips")
async def scan_ips():
    # Escanear red local para puerto 4840
    def get_local_ip():
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('10.255.255.255', 1))
            return s.getsockname()[0]
        except:
            return '192.168.0.1'
        finally:
            s.close()

    local_ip = get_local_ip()
    subnet = ".".join(local_ip.split(".")[:-1])
    ips_to_check = [f"{subnet}.{i}" for i in range(1, 255)]
    
    # Always include common industrial subnets
    if "192.168.0" not in subnet:
        ips_to_check.extend([f"192.168.0.{i}" for i in range(1, 255)])
    if "192.168.1" not in subnet:
        ips_to_check.extend([f"192.168.1.{i}" for i in range(1, 255)])

    sem = asyncio.Semaphore(50)

    async def check_port(ip, port, timeout=0.5):
        async with sem:
            try:
                reader, writer = await asyncio.wait_for(asyncio.open_connection(ip, port), timeout=timeout)
                writer.close()
                await writer.wait_closed()
                return True
            except:
                return False

    # Chunk the execution to avoid Windows select() limit
    results = await asyncio.gather(*(check_port(ip, 4840) for ip in ips_to_check))
    active_ips = [ip for ip, is_active in zip(ips_to_check, results) if is_active]
    
    return {"ips": active_ips}

class BrowseNodesParams(BaseModel):
    ip: str
    port: str

@app.post("/plc/browse_nodes")
async def browse_nodes(params: BrowseNodesParams):
    url = f"opc.tcp://{params.ip}:{params.port}"
    try:
        from asyncua import Client
    except ImportError:
        return {"error": "asyncua no instalado"}

    client = Client(url=url)
    client.session_timeout = 2000
    client.secure_channel_timeout = 2000
    try:
        await asyncio.wait_for(client.connect(), timeout=3.0)
        objects = client.nodes.objects
        children = await objects.get_children()
        
        db_names = []
        for child in children:
            try:
                bname = await child.read_browse_name()
                name = bname.Name
                if name != "Server": 
                    db_names.append(name)
            except:
                pass
                
        await client.disconnect()
        return {"nodes": db_names}
    except Exception as e:
        return {"error": str(e)}

class ForceModeParams(BaseModel):
    enabled: bool

@app.post("/plc/force_mode")
def set_force_mode(params: ForceModeParams):
    """Activa o desactiva el modo de forzado manual."""
    global global_force_mode
    global_force_mode = params.enabled
    print(f"[OPC UA SIM] Modo forzado manual: {'HABILITADO' if global_force_mode else 'DESHABILITADO'}")
    return {"status": "ok", "force_mode": global_force_mode}

@app.post("/plc/write")
def write_to_plc(params: PlcWriteParams):
    """
    Simula la escritura de señales hacia el PLC vía OPC UA.
    En el futuro, esto utilizará la librería asyncua para escribir en el S7-1200.
    """
    global plc_sim_state
    global global_force_mode
    
    # Si el forzado manual está activado, ignorar comandos automáticos de la app
    if global_force_mode and not params.is_force:
        return {"status": "ignored", "message": "Comando ignorado, el forzado manual está activo."}
        
    escrito = params.dict(exclude_none=True, exclude={'is_force'})
    
    # Si el cliente OPC UA está activo, escribimos en el PLC real
    if opcua_manager.active:
        opcua_manager.write(escrito)
    
    for key, value in escrito.items():
        if key in plc_sim_state:
            plc_sim_state[key] = value
            
            # Exclusión mutua para luces
            if value is True:
                if key == "b_LUZ_ROJA":
                    plc_sim_state["b_LUZ_VERDE"] = False
                    plc_sim_state["b_LUZ_AZUL"] = False
                elif key == "b_LUZ_VERDE":
                    plc_sim_state["b_LUZ_ROJA"] = False
                    plc_sim_state["b_LUZ_AZUL"] = False
                elif key == "b_LUZ_AZUL":
                    plc_sim_state["b_LUZ_ROJA"] = False
                    plc_sim_state["b_LUZ_VERDE"] = False
            
            # Lógica de simulación de vallas
            if key == "Ob_Subir_Vallas" and value is True:
                plc_sim_state["Ob_Bajar_Vallas"] = False
                
                plc_sim_state["Ob_Dtec_Valla_1_trabajo_LH"] = False
                plc_sim_state["Ob_Dtec_Valla_1_trabajo_RH"] = False
                plc_sim_state["Ob_Dtec_Valla_2_trabajo_LH"] = False
                plc_sim_state["Ob_Dtec_Valla_2_trabajo_RH"] = False
                
            elif key == "Ob_Bajar_Vallas" and value is True:
                plc_sim_state["Ob_Subir_Vallas"] = False
                plc_sim_state["Ob_Dtec_Valla_1_trabajo_LH"] = True
                plc_sim_state["Ob_Dtec_Valla_1_trabajo_RH"] = True
                plc_sim_state["Ob_Dtec_Valla_2_trabajo_LH"] = True
                plc_sim_state["Ob_Dtec_Valla_2_trabajo_RH"] = True
                    
    print(f"[OPC UA SIM] Escribiendo salidas al PLC: {escrito}")
    return {"status": "ok", "message": "Valores enviados al PLC simulado", "data": escrito}


# ─────────────────────────────────────────────────────────────
# WebSocket — Telemetría en tiempo real (OPC UA Simulado)
# ─────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    start_time = time.time()
    
    try:
        while True:
            global plc_sim_state
            
            elapsed = time.time() - start_time
            
            # Si estamos en modo PLC real, usamos el estado del manager
            current_plc_state = opcua_manager.state if opcua_manager.active else plc_sim_state
            state_str = "PLC REAL" if opcua_manager.active else "SIMULACION"

            await websocket.send_json({
                "type": "telemetry",
                "distance": round(current_plc_state.get("R_Altura_Carretilla", 0.0), 1),
                "timer": round(elapsed, 2),
                "state": state_str,
                "plc": current_plc_state,
                "opcua_connected": opcua_manager.connected,
                "opcua_error": opcua_manager.error_msg
            })

            await asyncio.sleep(0.1)  # 10 Hz

    except WebSocketDisconnect:
        print("[WS] Cliente desconectado.")






# ─────────────────────────────────────────────────────────────
# Logs de pruebas (LOG_TABLA)
# ─────────────────────────────────────────────────────────────

@app.post("/api/logs")
def save_log(log_data: dict, db: Session = Depends(get_db)):
    try:
        log = create_log(db, log_data)
        return {"status": "success", "id": log.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs")
def read_logs(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    try:
        logs = get_logs(db, skip=skip, limit=limit)
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs/bastidor/{bastidor}")
def read_last_log_for_bastidor(bastidor: str, db: Session = Depends(get_db)):
    try:
        from database.crud import get_last_log_for_bastidor
        log = get_last_log_for_bastidor(db, bastidor)
        if not log:
            raise HTTPException(status_code=404, detail="Log not found")
        return log
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/health/db")
def health_db():
    """
    Comprueba la conexión real a la base de datos.
    Devuelve connected=true si el engine puede ejecutar SELECT 1.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        # Contar registros en tablas clave
        with engine.connect() as conn:
            n_erp    = conn.execute(text("SELECT COUNT(*) FROM JAULA_ERP")).scalar()
            n_logs = conn.execute(text("SELECT COUNT(*) FROM LOG_TABLA")).scalar()
        return {
            "connected": True,
            "jaula_erp": n_erp,
            "logs": n_logs,
        }
    except Exception as e:
        return {"connected": False, "error": str(e)}



# ─────────────────────────────────────────────────────────────
# Servir frontend compilado (Vite dist/) como archivos estáticos
# ─────────────────────────────────────────────────────────────
_frontend_dist = resource_path("dist")
if os.path.isdir(_frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_frontend_dist, "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    async def serve_root():
        return FileResponse(os.path.join(_frontend_dist, "index.html"))

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Catch-all: sirve el index.html para rutas del SPA que no sean /api."""
        file_path = os.path.join(_frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_frontend_dist, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)
