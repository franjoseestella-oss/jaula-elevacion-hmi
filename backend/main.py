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

from database.database import engine, get_db, get_local_db
from database.models import init_db, ErpCarretilla, ReferenciaEnCiclo
from database.crud import create_log, get_logs
from erp_sync import parse_and_sync_dat, start_dat_watcher
from opcua_client import opcua_manager
from fastapi.responses import Response
import basler_camera

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

    # ─── Sincronización inicial del DAT ─────────────────────────────
    try:
        resultado = parse_and_sync_dat()
        print(f"[OK] Sync ERP al arrancar: {resultado.get('message', resultado)}")
    except Exception as e:
        print(f"[WARN] No se pudo sincronizar el DAT al arrancar: {e}")

    # ─── Watcher: re-sincroniza si el fichero cambia en disco ────────────
    try:
        start_dat_watcher(interval_seconds=10)
        print("[OK] DAT file-watcher activo (comprueba cambios cada 10s).")
    except Exception as e:
        print(f"[WARN] No se pudo iniciar el watcher del DAT: {e}")

    # Cargar la configuración guardada del PLC
    try:
        import json
        config_path = resource_path("plc_config.json")
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = json.load(f)
                ip = config_data.get("ip", "192.168.0.1")
                port = config_data.get("port", "4840")
                db_name = config_data.get("dbName") or config_data.get("dbNameFast") or "DB25_OPC_UA_SCAN_LENTO"
                frequency = config_data.get("frequency") or config_data.get("hzFast") or 100.0
                namespace = config_data.get("namespace", "3")
                is_simulation = config_data.get("isSimulation", True)
                
                opcua_manager.update_config(
                    ip=ip,
                    port=port,
                    db_name_fast=db_name,
                    db_name_slow=db_name,
                    hz_fast=float(frequency),
                    hz_slow=float(frequency),
                    namespace=str(namespace),
                    db_name=db_name,
                    frequency=float(frequency)
                )
                
                if is_simulation:
                    opcua_manager.disable()
                else:
                    opcua_manager.enable()
                print(f"[OK] Configuración PLC cargada desde archivo: {ip}:{port}, DB={db_name}, sim={is_simulation}")
    except Exception as e:
        print(f"[WARN] No se pudo cargar plc_config.json: {e}")

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
def buscar_bastidor(bastidor: str, db: Session = Depends(get_local_db)):
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
            "peso_pruebas": erp.peso_pruebas,
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
            "peso_pruebas": None,
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
        "peso_pruebas":          erp.peso_pruebas,
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
def buscar_secuencia(secuencia: str, db: Session = Depends(get_local_db)):
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


@app.get("/erp/qr/{qr_raw}")
def buscar_por_qr(qr_raw: str, db: Session = Depends(get_local_db)):
    """
    Busca una carretilla a partir del contenido bruto de un código QR.
    El formato esperado es DDMMYY + NNNN  (ej. '260501' + '0138' → fecha 26/05 y secuencia 0138).
    Si el raw tiene 8+ dígitos: los últimos 4 son la secuencia y los anteriores la fecha.
    Si tiene 4 dígitos: se interpreta directamente como secuencia.
    Siempre intenta primero con fecha+secuencia (más preciso) y cae en solo secuencia si falla.
    """
    digits = qr_raw.strip().replace("/", "").replace("-", "").replace(" ", "")
    digits_only = ''.join(c for c in digits if c.isdigit())

    seq_q = digits_only[-4:].zfill(4) if len(digits_only) >= 4 else digits_only.zfill(4)
    fecha_q = digits_only[:-4] if len(digits_only) > 4 else None

    # Intento 1: fecha + secuencia (si tenemos ambos)
    if fecha_q:
        from sqlalchemy import or_
        query_filters = [ErpCarretilla.secuencia.ilike(f"%{seq_q}%")]
        
        if len(fecha_q) == 6:
            # QR puede ser DDMMYY (260525 -> 26 mayo 2025) o YYMMDD (250526)
            # En la BD tenemos YYYYMMDD (ej: 20250526).
            yy = fecha_q[4:6]
            mm = fecha_q[2:4]
            dd = fecha_q[0:2]
            yyyy = f"20{yy}"
            
            # 1. Asumiendo que es DDMMYY -> Fecha en BD sería YYYYMMDD -> yyyy + mm + dd
            fecha_as_ddmmyy = f"{yyyy}{mm}{dd}"
            
            # 2. Asumiendo que es YYMMDD -> Fecha en BD sería YYYYMMDD -> 20 + yy + mm + dd
            yy_alt = fecha_q[0:2]
            mm_alt = fecha_q[2:4]
            dd_alt = fecha_q[4:6]
            yyyy_alt = f"20{yy_alt}"
            fecha_as_yymmdd = f"{yyyy_alt}{mm_alt}{dd_alt}"
            
            query_filters.append(or_(
                ErpCarretilla.fecha_montaje.ilike(f"%{fecha_q}%"),
                ErpCarretilla.fecha_montaje.ilike(f"%{fecha_as_ddmmyy}%"),
                ErpCarretilla.fecha_montaje.ilike(f"%{fecha_as_yymmdd}%")
            ))
        else:
            query_filters.append(ErpCarretilla.fecha_montaje.ilike(f"%{fecha_q}%"))
            
        erp = db.query(ErpCarretilla).filter(*query_filters).first()
        if erp:
            return _erp_row_to_dict(erp)

    # Intento 2: solo secuencia
    erp = db.query(ErpCarretilla).filter(
        ErpCarretilla.secuencia.ilike(f"%{seq_q}%")
    ).first()
    if erp:
        return _erp_row_to_dict(erp)

    raise HTTPException(
        status_code=404,
        detail=f"QR '{qr_raw}' no encontrado en ERP (secuencia buscada: {seq_q}). Verifica o sincroniza el DAT."
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
def listar_carretillas(limit: int = 500, db: Session = Depends(get_local_db)):
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
                "peso_pruebas":      r.peso_pruebas,
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

@app.post("/config/datalogic/read")
def read_datalogic_connection(config: DatalogicConfig):
    """Intenta leer un dato del Datalogic por TCP o Serial (timeout 5s)."""
    if config.connType == "tcp":
        try:
            port_int = int(config.port)
            s = socket.create_connection((config.ip, port_int), timeout=5)
            data = s.recv(1024)
            s.close()
            if data:
                return {"status": "ok", "data": data.decode('utf-8', errors='ignore').strip()}
            else:
                return {"status": "error", "message": "Timeout: No se leyó nada en 5 segundos."}
        except Exception as e:
            return {"status": "error", "message": f"Fallo TCP: {str(e)}"}
    elif config.connType == "serial":
        try:
            import serial
            baud_int = int(config.baudRate)
            ser = serial.Serial(config.comPort, baud_int, timeout=5)
            data = ser.read_until(b'\r')
            ser.close()
            if data:
                return {"status": "ok", "data": data.decode('utf-8', errors='ignore').strip()}
            else:
                return {"status": "error", "message": "Timeout: No se leyó nada en 5 segundos."}
        except Exception as e:
            return {"status": "error", "message": f"Fallo Serial: {str(e)}"}
    return {"status": "error", "message": "Tipo de conexión inválido."}

@app.post("/config/qr/test")
def test_qr_connection(config: DatalogicConfig):
    """Prueba la conexión al Lector QR por TCP, Serial o USB."""
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
    elif config.connType == "usb":
        try:
            import subprocess
            out = subprocess.check_output(
                ['powershell', '-Command', 'Get-PnpDevice -PresentOnly | Select-Object InstanceId, FriendlyName'], 
                creationflags=subprocess.CREATE_NO_WINDOW
            ).decode('cp850', errors='ignore')
            
            for line in out.splitlines():
                line_upper = line.upper()
                if 'VID_05F9' in line_upper or 'DATALOGIC' in line_upper:
                    return {"status": "ok", "message": "Lector USB Datalogic detectado correctamente."}
            
            return {"status": "error", "message": "No se detectó ningún Lector USB conectado."}
        except Exception as e:
            # Fallback en caso de error con powershell (asumir conectado si no podemos comprobar)
            return {"status": "ok", "message": "Lector USB configurado (sin verificación de hardware)."}
            
    return {"status": "error", "message": "Tipo de conexión inválido."}

@app.get("/api/com_ports")
def get_com_ports():
    try:
        import serial.tools.list_ports
        ports = serial.tools.list_ports.comports()
        return {"status": "ok", "ports": [port.device for port in ports]}
    except ImportError:
        return {"status": "error", "message": "Falta la librería pyserial. Ejecuta: pip install pyserial"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/config/qr/read")
def read_qr_connection(config: DatalogicConfig):
    """Intenta leer un dato del Lector QR por TCP o Serial (timeout 5s)."""
    if config.connType == "tcp":
        try:
            port_int = int(config.port)
            s = socket.create_connection((config.ip, port_int), timeout=5)
            data = s.recv(1024)
            s.close()
            if data:
                return {"status": "ok", "data": data.decode('utf-8', errors='ignore').strip()}
            else:
                return {"status": "error", "message": "Timeout: No se leyó nada en 5 segundos."}
        except Exception as e:
            return {"status": "error", "message": f"Fallo TCP: {str(e)}"}
    elif config.connType == "serial":
        try:
            import serial
            baud_int = int(config.baudRate)
            ser = serial.Serial(config.comPort, baud_int, timeout=5)
            data = ser.readline()
            ser.close()
            if data:
                return {"status": "ok", "data": data.decode('utf-8', errors='ignore').strip()}
            else:
                return {"status": "error", "message": "Timeout: No se leyó nada en 5 segundos."}
        except ImportError:
            return {"status": "error", "message": "Falta la librería pyserial."}
        except Exception as e:
            return {"status": "error", "message": f"Fallo Serial: {str(e)}"}
    return {"status": "error", "message": "Tipo de conexión inválido."}

# ─────────────────────────────────────────────────────────────
# PLC OPC UA — Simulación de lectura y escritura
# ─────────────────────────────────────────────────────────────

class BaslerConfig(BaseModel):
    ip: str

@app.get("/api/basler/status")
def basler_status_endpoint():
    """
    Comprueba si la cámara Basler está accesible y devuelve el diagnóstico.
    """
    is_connected, msg = basler_camera.check_connection()
    return {"connected": is_connected, "message": msg}

@app.post("/api/basler/config")
def update_basler_config(config: BaslerConfig):
    """
    Actualiza la configuración de la cámara Basler en memoria.
    """
    basler_camera.CAMERA_CONFIG["IPAddress"] = config.ip.strip()
    return {"status": "ok", "message": f"IP de cámara actualizada a {config.ip}"}

@app.get("/api/basler/capture")
def capture_basler_endpoint():
    """
    Captura un frame de la cámara Basler y lo devuelve como base64.
    """
    try:
        import cv2
        import base64
        frame = basler_camera.capture_basler_frame()
        if frame is None:
            raise HTTPException(status_code=503, detail="No se pudo capturar la imagen de la cámara Basler.")
            
        success, encoded_image = cv2.imencode('.jpg', frame)
        if not success:
            raise HTTPException(status_code=500, detail="Error al codificar la imagen capturada.")
            
        # Convertir a base64 para evitar problemas de parsing binario en el frontend
        b64_str = base64.b64encode(encoded_image.tobytes()).decode('utf-8')
        return {"image": f"data:image/jpeg;base64,{b64_str}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en la captura de Basler: {str(e)}")

# Estado global simulado
plc_sim_state = {
    # Salidas (Comandos HMI -> PLC)
    "b_LUZ_VERDE": False,
    "b_LUZ_AZUL": False,
    "b_LUZ_ROJA": False,
    "Ib_EV_VALLA_REPOSO": False,
    "Ib_EV_VALLA_TRABAJO": False,

    # Entradas Analógicas (Simuladas)
    "R_Altura_Carretilla": 0.0,
    "W_Numero_Pallets": 0.0,

    # Entradas Digitales (Simuladas)
    "b_Iniciar_Secuencia": False,
    "b_Poner_Pegatina": False,
    "b_Abortar_Secuencia": False,
    
    "Ob_Trabajo_Cilindro_Valla_1": False,
    "Ob_Trabajo_Cilindro_Valla_2": False,
    "Ob_Reposo_Cilindro_Valla_1": True,

    # Temporización y Consignas del PLC
    "or_tiempo_elevacion": 0,
    "or_tiempo_descenso": 0,
    "Ib_Inicia_Temp_Ascenso": False,
    "inicia_temporizador_ascenso": False,
    "Ib_Inicia_Temporizador_Ascenso": False,
    "Ib_Inicia_Temp_Descenso": False,
    "inicia_temporizador_descenso": False,
    "Ib_Inicia_Temporizador_Descenso": False,
    "IW_Altura_Relativa": 0,
    "altura_relativa": 0,
    "IW_Consigna_Posicion_Altura": 0,
    "consigna_posicion_altura": 0,
    "consigna_posicion": 0,
    "Ob_Ready_Temporizador": False,
    "Ib_Restart_Temporizador": False
}

global_force_mode = False

class PlcWriteParams(BaseModel):
    b_LUZ_VERDE: bool | None = None
    b_LUZ_AZUL: bool | None = None
    b_LUZ_ROJA: bool | None = None
    Ib_EV_VALLA_REPOSO: bool | None = None
    Ib_EV_VALLA_TRABAJO: bool | None = None
    R_Altura_Carretilla: float | None = None
    W_Numero_Pallets: float | None = None
    b_Iniciar_Secuencia: bool | None = None
    b_Poner_Pegatina: bool | None = None
    b_Abortar_Secuencia: bool | None = None
    is_force: bool = False


class PlcConfigModel(BaseModel):
    ip: str
    port: str
    dbNameFast: str | None = None
    dbNameSlow: str | None = None
    hzFast: float | None = None
    hzSlow: float | None = None
    dbName: str | None = None
    frequency: float | None = None
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
        db_name_fast=config.dbNameFast or config.dbName or "DB25_OPC_UA_SCAN_LENTO",
        db_name_slow=config.dbNameSlow or config.dbName or "DB25_OPC_UA_SCAN_LENTO",
        hz_fast=config.hzFast if config.hzFast is not None else (config.frequency or 100.0),
        hz_slow=config.hzSlow if config.hzSlow is not None else (config.frequency or 100.0),
        namespace=config.namespace,
        db_name=config.dbName,
        frequency=config.frequency
    )
    if config.isSimulation:
        opcua_manager.disable()
    else:
        opcua_manager.enable()
        
    # Guardar configuración en archivo plc_config.json
    try:
        import json
        config_path = resource_path("plc_config.json")
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump({
                "ip": config.ip,
                "port": config.port,
                "dbName": config.dbName or config.dbNameFast,
                "frequency": config.frequency or config.hzFast,
                "namespace": config.namespace,
                "isSimulation": config.isSimulation
            }, f, indent=4)
        print("[OK] Configuración PLC guardada en plc_config.json")
    except Exception as e:
        print(f"[WARN] No se pudo guardar plc_config.json: {e}")
        
    return {"status": "ok", "message": "Configuración guardada"}

@app.get("/config/plc")
def get_plc_config():
    """Devuelve la configuración actual del PLC."""
    return {
        "ip": opcua_manager.config.ip,
        "port": opcua_manager.config.port,
        "dbName": opcua_manager.config.db_name,
        "frequency": opcua_manager.config.frequency,
        "namespace": opcua_manager.config.namespace,
        "isSimulation": not opcua_manager.active
    }

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
        
        db_names = set()
        
        async def browse_recursive(node, current_depth, max_depth=3):
            if current_depth > max_depth:
                return
            try:
                children = await node.get_children()
                for child in children:
                    try:
                        bname = await child.read_browse_name()
                        name = bname.Name
                        if name == "Server" and current_depth == 1:
                            continue
                        
                        node_class = await child.read_node_class()
                        # Si es un objeto, miramos si tiene variables o es un DB
                        # Guardamos todos los nombres para que el usuario elija
                        # En Siemens, los DBs suelen ser Objetos bajo ServerInterfaces o bajo el nombre del PLC
                        if name not in ["DeviceSet", "ServerInterfaces", "PLC_1", "DataBlocksGlobal"]:
                            # Ignore common root folders, add the actual meaningful ones
                            db_names.add(name)
                            
                        # Recurse into the child
                        await browse_recursive(child, current_depth + 1, max_depth)
                    except Exception:
                        pass
            except Exception:
                pass

        objects = client.nodes.objects
        await browse_recursive(objects, 1, 3)
                
        await client.disconnect()
        return {"nodes": sorted(list(db_names))}
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
def write_to_plc(payload: dict):
    """
    Simula la escritura de señales hacia el PLC vía OPC UA.
    En el futuro, esto utilizará la librería asyncua para escribir en el S7-1200.
    """
    global plc_sim_state
    global global_force_mode
    
    is_force = payload.get("is_force", False)
    
    # Si el forzado manual está activado, ignorar comandos automáticos de la app
    if global_force_mode and not is_force:
        return {"status": "ignored", "message": "Comando ignorado, el forzado manual está activo."}
        
    escrito = {k: v for k, v in payload.items() if k != 'is_force' and v is not None}
    print(f"[API WRITE] Recibido payload de escritura: {escrito} (is_force={is_force})")
    
    # Si el cliente OPC UA está activo, escribimos en el PLC real
    if opcua_manager.active:
        opcua_manager.write(escrito)
    
    for key, value in escrito.items():
        plc_sim_state[key] = value
        
        # Simulación de temporizadores ready/restart
        if key == "Ib_Restart_Temporizador" and value is True:
            # Resetear valores de tiempo medidos a 0
            plc_sim_state["or_tiempo_elevacion"] = 0
            plc_sim_state["or_tiempo_descenso"] = 0
            plc_sim_state["OW_Tiempo_Elevacion"] = 0
            plc_sim_state["OW_Tiempo_Descenso"] = 0
            plc_sim_state["inicia_temporizador_ascenso"] = False
            plc_sim_state["Ib_Inicia_Temporizador_Ascenso"] = False
            plc_sim_state["inicia_temporizador_descenso"] = False
            plc_sim_state["Ib_Inicia_Temporizador_Descenso"] = False
            plc_sim_state["Ob_Ready_Temporizador"] = True   # READY: timers frescos
            plc_sim_state["Ib_Restart_Temporizador"] = False

        # Cuando los timers empiezan a correr, Ready vuelve a False
        # (el PLC indica que los timers están en uso; hay que reiniciar para la próxima prueba)
        if key in ("inicia_temporizador_ascenso", "Ib_Inicia_Temporizador_Ascenso") and value is True:
            plc_sim_state["Ob_Ready_Temporizador"] = False
            
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
        
        if key == "Ib_EV_VALLA_REPOSO" and value is True:
            plc_sim_state["Ib_EV_VALLA_TRABAJO"] = False
            plc_sim_state["Ob_Trabajo_Cilindro_Valla_1"] = False
            plc_sim_state["Ob_Trabajo_Cilindro_Valla_2"] = False
            plc_sim_state["Ob_Reposo_Cilindro_Valla_1"] = True
            
        elif key == "Ib_EV_VALLA_TRABAJO" and value is True:
            plc_sim_state["Ib_EV_VALLA_REPOSO"] = False
            plc_sim_state["Ob_Reposo_Cilindro_Valla_1"] = False
            plc_sim_state["Ob_Trabajo_Cilindro_Valla_1"] = True
            plc_sim_state["Ob_Trabajo_Cilindro_Valla_2"] = True
                    
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
            cycle_start = time.time()
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
                "opcua_error": opcua_manager.error_msg,
                "opcua_latency_ms": opcua_manager.latency_ms if opcua_manager.active else 0
            })
            
            # Frecuencia de envío de telemetría por WebSocket (aprox 60-100Hz sin consumir CPU)
            await asyncio.sleep(0.01)

    except WebSocketDisconnect:
        # Desconexión limpia del cliente (cierre normal)
        print("[WS] Cliente desconectado.")
    except (ConnectionResetError, ConnectionAbortedError):
        # En Windows (WinError 10054/10053): el cliente cerró la conexión abruptamente
        print("[WS] Cliente desconectado (cierre forzado por el cliente).")
    except RuntimeError as e:
        # FastAPI/Starlette lanza RuntimeError cuando el WebSocket ya está cerrado
        if "disconnect" in str(e).lower() or "closed" in str(e).lower():
            print("[WS] Cliente desconectado (WebSocket cerrado).")
        else:
            print(f"[WS] Error inesperado en WebSocket: {e}")
    except asyncio.CancelledError:
        # Cancelación del task (p.ej. al reiniciar el servidor)
        print("[WS] Conexión WebSocket cancelada.")
    except Exception as e:
        # Cualquier otro error de red — log silencioso para no llenar la consola
        print(f"[WS] Cliente desconectado (error de red: {type(e).__name__}).")






class CycleStartParams(BaseModel):
    referencia: str
    operario: str = "0"
    fecha_montaje: str = "0"
    nsecuencia: str = "0"
    nmodelo: str = "0"
    nbastidor: str = "0"
    nmastil: str = "0"
    altura_max_intermedia: float = 0.0

@app.post("/api/cycle/start")
def start_cycle(params: CycleStartParams, db: Session = Depends(get_local_db)):
    try:
        ref = db.query(ReferenciaEnCiclo).filter(ReferenciaEnCiclo.id == 1).first()
        if not ref:
            ref = ReferenciaEnCiclo(id=1)
            db.add(ref)
        
        # Formato: HH:MM DD/MM/AAAA
        from datetime import datetime
        now = datetime.now()
        fecha_str = now.strftime("%H:%M %d/%m/%Y")
        
        ref.ETAPA_ACTUAL = 1
        ref.REFERENCIA_ACTUAL = params.referencia
        ref.FECHA_INICIO_CICLO = fecha_str
        ref.OPERARIO = params.operario
        ref.FECHA_MONTAJE = params.fecha_montaje
        ref.NSECUENCIA = params.nsecuencia
        ref.NMODELO = params.nmodelo
        ref.NBASTIDOR = params.nbastidor
        ref.NMASTIL = params.nmastil
        ref.ALTURA_MAX_INTERMEDIA = params.altura_max_intermedia
        
        # Reiniciar todos los otros datos por seguridad
        ref.ALTURA_CAPTADA = 0.0
        ref.FECHA_HORA_INICIO_MULTILOAD = "0"
        ref.FECHA_HORA_FIN_MULTILOAD = "0"
        ref.ESTADO_MULTILOAD = "0"
        ref.TIEMPO_ELEVACION_MIN_SINCARGA = 0.0
        ref.TIEMPO_ELEVACION_MAX_SINCARGA = 0.0
        ref.TIEMPO_ELEVACION_MEDIDO_SINCARGA = 0.0
        ref.AVG_ELEVACION_SINCARGA = 0.0
        ref.TIEMPO_DESCENSO_MIN_SINCARGA = 0.0
        ref.TIEMPO_DESCENSO_MAX_SINCARGA = 0.0
        ref.TIEMPO_DESCENSO_MEDIDO_SINCARGA = 0.0
        ref.AVG_DESCENSO_SINCARGA = 0.0
        ref.FECHA_HORA_INICIO_SINCARGA = "0"
        ref.FECHA_HORA_FIN_SINCARGA = "0"
        ref.ESTADO_SINCARGA = "0"
        ref.TIEMPO_ELEVACION_MIN_CARGA = 0.0
        ref.TIEMPO_ELEVACION_MAX_CARGA = 0.0
        ref.TIEMPO_ELEVACION_MEDIDO_CARGA = 0.0
        ref.AVG_ELEVACION_CARGA = 0.0
        ref.TIEMPO_DESCENSO_MIN_CARGA = 0.0
        ref.TIEMPO_DESCENSO_MAX_CARGA = 0.0
        ref.TIEMPO_DESCENSO_MEDIDO_CARGA = 0.0
        ref.AVG_DESCENSO_CARGA = 0.0
        ref.FECHA_HORA_INICIO_CARGA = "0"
        ref.FECHA_HORA_FIN_CARGA = "0"
        ref.ESTADO_CARGA = "0"
        ref.CARGA_CONSIGNADA = 0.0
        ref.CARGA_GET = 0.0
        ref.PESO_PRUEBA = 0.0
        ref.ALTURA_INICIAL = 0.0
        ref.ALTURA_FINAL = 0.0
        ref.DIFERENCIA_ALTURAS = 0.0
        ref.FECHA_HORA_INICIO_5MIN = "0"
        ref.FECHA_HORA_FIN_5MIN = "0"
        ref.ESTADO_CARGA_5_MIN = "0"
        ref.REPETICIONES_SECUENCIA = 0
        ref.FECHA_HORA_INICIO_SEC = "0"
        ref.FECHA_HORA_FIN_SEC = "0"
        ref.DURACION_SEC = "0"
        ref.OK_NOK = "0"

        db.commit()
        db.refresh(ref)
        return {
            "status": "success",
            "referencia": ref.REFERENCIA_ACTUAL,
            "fecha_inicio": ref.FECHA_INICIO_CICLO
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cycle/update")
def update_cycle(data: dict, db: Session = Depends(get_local_db)):
    try:
        ref = db.query(ReferenciaEnCiclo).filter(ReferenciaEnCiclo.id == 1).first()
        if not ref:
            ref = ReferenciaEnCiclo(id=1)
            db.add(ref)
        
        for key, value in data.items():
            if hasattr(ref, key):
                setattr(ref, key, value)
        
        db.commit()
        db.refresh(ref)
        return {"status": "success", "data": data}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cycle/reset")
def reset_cycle(db: Session = Depends(get_local_db)):
    try:
        ref = db.query(ReferenciaEnCiclo).filter(ReferenciaEnCiclo.id == 1).first()
        if not ref:
            ref = ReferenciaEnCiclo(id=1)
            db.add(ref)
        
        # Resetear todos los campos
        ref.ETAPA_ACTUAL = 0
        ref.REFERENCIA_ACTUAL = "0"
        ref.FECHA_INICIO_CICLO = "0"
        ref.OPERARIO = "0"
        ref.FECHA_MONTAJE = "0"
        ref.NSECUENCIA = "0"
        ref.NMODELO = "0"
        ref.NBASTIDOR = "0"
        ref.NMASTIL = "0"
        ref.ALTURA_MAX_INTERMEDIA = 0.0
        ref.ALTURA_CAPTADA = 0.0
        ref.FECHA_HORA_INICIO_MULTILOAD = "0"
        ref.FECHA_HORA_FIN_MULTILOAD = "0"
        ref.ESTADO_MULTILOAD = "0"
        ref.TIEMPO_ELEVACION_MIN_SINCARGA = 0.0
        ref.TIEMPO_ELEVACION_MAX_SINCARGA = 0.0
        ref.TIEMPO_ELEVACION_MEDIDO_SINCARGA = 0.0
        ref.AVG_ELEVACION_SINCARGA = 0.0
        ref.TIEMPO_DESCENSO_MIN_SINCARGA = 0.0
        ref.TIEMPO_DESCENSO_MAX_SINCARGA = 0.0
        ref.TIEMPO_DESCENSO_MEDIDO_SINCARGA = 0.0
        ref.AVG_DESCENSO_SINCARGA = 0.0
        ref.FECHA_HORA_INICIO_SINCARGA = "0"
        ref.FECHA_HORA_FIN_SINCARGA = "0"
        ref.ESTADO_SINCARGA = "0"
        ref.TIEMPO_ELEVACION_MIN_CARGA = 0.0
        ref.TIEMPO_ELEVACION_MAX_CARGA = 0.0
        ref.TIEMPO_ELEVACION_MEDIDO_CARGA = 0.0
        ref.AVG_ELEVACION_CARGA = 0.0
        ref.TIEMPO_DESCENSO_MIN_CARGA = 0.0
        ref.TIEMPO_DESCENSO_MAX_CARGA = 0.0
        ref.TIEMPO_DESCENSO_MEDIDO_CARGA = 0.0
        ref.AVG_DESCENSO_CARGA = 0.0
        ref.FECHA_HORA_INICIO_CARGA = "0"
        ref.FECHA_HORA_FIN_CARGA = "0"
        ref.ESTADO_CARGA = "0"
        ref.CARGA_CONSIGNADA = 0.0
        ref.CARGA_GET = 0.0
        ref.PESO_PRUEBA = 0.0
        ref.ALTURA_INICIAL = 0.0
        ref.ALTURA_FINAL = 0.0
        ref.DIFERENCIA_ALTURAS = 0.0
        ref.FECHA_HORA_INICIO_5MIN = "0"
        ref.FECHA_HORA_FIN_5MIN = "0"
        ref.ESTADO_CARGA_5_MIN = "0"
        ref.REPETICIONES_SECUENCIA = 0
        ref.FECHA_HORA_INICIO_SEC = "0"
        ref.FECHA_HORA_FIN_SEC = "0"
        ref.DURACION_SEC = "0"
        ref.OK_NOK = "0"
        
        db.commit()
        db.refresh(ref)
        return {
            "status": "success",
            "referencia": ref.REFERENCIA_ACTUAL,
            "fecha_inicio": ref.FECHA_INICIO_CICLO
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cycle/status")
def get_cycle_status(db: Session = Depends(get_local_db)):
    try:
        ref = db.query(ReferenciaEnCiclo).filter(ReferenciaEnCiclo.id == 1).first()
        if not ref:
            return {"referencia": "0", "fecha_inicio": "0", "etapa_actual": 0}
        return {
            "referencia": ref.REFERENCIA_ACTUAL or "0",
            "fecha_inicio": ref.FECHA_INICIO_CICLO or "0",
            "etapa_actual": ref.ETAPA_ACTUAL or 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# Logs de pruebas (LOG_TABLA)
# ─────────────────────────────────────────────────────────────

@app.post("/api/logs")
def save_log(log_data: dict, db: Session = Depends(get_local_db)):
    try:
        log = create_log(db, log_data)
        return {"status": "success", "id": log.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs")
def read_logs(skip: int = 0, limit: int = 200, db: Session = Depends(get_local_db)):
    try:
        logs = get_logs(db, skip=skip, limit=limit)
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs/bastidor/{bastidor}")
def read_last_log_for_bastidor(bastidor: str, db: Session = Depends(get_local_db)):
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
# Registro del alarmero (LOG_ALARMAS)
# ─────────────────────────────────────────────────────────────

class AlarmCreate(BaseModel):
    plcVar: str | None = None
    description: str | None = None
    type: str | None = None
    timestamp: str | None = None
    startTime: int | None = None
    endTime: int | None = None
    duration: str | None = None

class AlarmResolve(BaseModel):
    plcVar: str
    endTime: int
    duration: str

@app.get("/api/alarms")
def read_alarms(skip: int = 0, limit: int = 2000, db: Session = Depends(get_local_db)):
    try:
        from database.crud import get_alarms
        db_alarms = get_alarms(db, skip=skip, limit=limit)
        
        def extract_plc_var(desc: str) -> str:
            if not desc:
                return ""
            if "Sin conexión con PLC" in desc:
                return "SYS_PLC_DISCONNECTED"
            if "Lector QR" in desc:
                return "SYS_QR_DISCONNECTED"
            if "Máquina en estado manual" in desc:
                return "SYS_MODO_MANUAL"
            if "Valla no está en trabajo" in desc:
                return "SYS_FENCE_NOT_IN_WORK"
            if "Valla no está en reposo" in desc:
                return "SYS_FENCE_NOT_IN_REPOSO"
            import re
            m = re.match(r"^\[([^\]]+)\]", desc)
            if m:
                return m.group(1)
            return ""

        return [
            {
                "id": a.id,
                "plcVar": extract_plc_var(a.DESCRIPCION),
                "description": a.DESCRIPCION,
                "type": a.TIPO,
                "timestamp": a.FECHA_Y_HORA,
                "startTime": None,
                "endTime": None if a.DURACION == "Activa" else 1,
                "duration": a.DURACION
            }
            for a in db_alarms
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/alarms")
def save_alarm(alarm_data: AlarmCreate, db: Session = Depends(get_local_db)):
    try:
        from database.crud import create_alarm
        alarm = create_alarm(db, alarm_data.dict())
        return {"status": "success", "id": alarm.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/alarms/resolve")
def update_alarm_resolved(resolve_data: AlarmResolve, db: Session = Depends(get_local_db)):
    try:
        from database.crud import resolve_alarm
        alarm = resolve_alarm(
            db, 
            plcVar=resolve_data.plcVar, 
            endTime=resolve_data.endTime, 
            duration=resolve_data.duration
        )
        if not alarm:
            return {"status": "not_found", "message": "No active alarm found to resolve"}
        return {"status": "success", "id": alarm.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/alarms")
def clear_alarms(db: Session = Depends(get_local_db)):
    try:
        from database.crud import delete_all_alarms
        delete_all_alarms(db)
        return {"status": "success", "message": "Historial de alarmas borrado"}
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
            n_alarms = conn.execute(text("SELECT COUNT(*) FROM LOG_ALARMAS")).scalar()
        return {
            "connected": True,
            "jaula_erp": n_erp,
            "logs": n_logs,
            "alarms": n_alarms,
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
