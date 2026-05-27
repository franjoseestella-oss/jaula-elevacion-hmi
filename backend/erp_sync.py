import os
import configparser
import threading
import time
from sqlalchemy.orm import Session
from database.database import SessionLocal, get_config_path
from database.models import ErpCarretilla

# ─── File-Watcher: re-sincroniza el DAT automáticamente si cambia ───────────
_watcher_thread: threading.Thread | None = None
_watcher_stop = threading.Event()

def _get_dat_path() -> str:
    """Lee la ruta del DAT desde database.config."""
    config = configparser.ConfigParser()
    config.read(get_config_path())
    default = r"C:\Users\franj\OneDrive\Escritorio\COSAS  FRAN\PROYECTOS\JAULA ELEVACION\FICHEROS JAULA\DATOSMAST.DAT"
    dat_path = config.get('ERP', 'file_path', fallback=default)
    if not os.path.exists(dat_path):
        default_dir = r"C:\Users\franj\OneDrive\Escritorio\COSAS  FRAN\PROYECTOS\JAULA ELEVACION\FICHEROS JAULA"
        alt = os.path.join(default_dir, os.path.basename(dat_path))
        if os.path.exists(alt):
            return alt
    return dat_path

def _watcher_loop(interval_seconds: int = 10):
    """Bucle en hilo daemon que comprueba cambios en el fichero DAT cada `interval_seconds` segundos."""
    last_mtime = None
    last_size = None
    print(f"[DAT-WATCHER] Iniciado. Comprobando cambios cada {interval_seconds}s.")
    while not _watcher_stop.is_set():
        try:
            dat_path = _get_dat_path()
            if os.path.exists(dat_path):
                stat = os.stat(dat_path)
                mtime = stat.st_mtime
                size = stat.st_size
                if last_mtime is None:
                    # Primera lectura: registrar estado sin sincronizar (ya se hace en startup)
                    last_mtime = mtime
                    last_size = size
                elif mtime != last_mtime or size != last_size:
                    print(f"[DAT-WATCHER] Cambio detectado en {os.path.basename(dat_path)} — re-sincronizando...")
                    result = parse_and_sync_dat()
                    print(f"[DAT-WATCHER] {result.get('message', result)}")
                    last_mtime = mtime
                    last_size = size
        except Exception as exc:
            print(f"[DAT-WATCHER] Error en bucle de vigilancia: {exc}")
        _watcher_stop.wait(interval_seconds)
    print("[DAT-WATCHER] Detenido.")

def start_dat_watcher(interval_seconds: int = 10):
    """Arranca el watcher en un hilo daemon (seguro llamarlo varias veces)."""
    global _watcher_thread
    if _watcher_thread and _watcher_thread.is_alive():
        return  # Ya está corriendo
    _watcher_stop.clear()
    _watcher_thread = threading.Thread(
        target=_watcher_loop,
        args=(interval_seconds,),
        daemon=True,
        name="DatFileWatcher"
    )
    _watcher_thread.start()

def stop_dat_watcher():
    """Señaliza la parada del watcher."""
    _watcher_stop.set()

# ─── Offsets reales del fichero DATOSMAST.DAT ───────────────
# Campo               Inicio  Fin  Longitud
# FEC.MONTAJE            0     8      8
# SECUENCIA              8    12      4
# MODELO COMERCIAL      12    23     11
# BASTIDOR              23    40     17
# MASTIL                40    46      6
# ALTURA MAX.INTERM.    46    50      4
# CAPAC.INTERM. 1       50    54      4
# CAPAC.INTERM. 2       54    58      4
# CAPAC.INTERM. 3       58    62      4
# TPO.ELEVAC.MIN.       62    66      4
# TPO.ELEVAC.MAX.       66    70      4
# TPO.DESCENSO MIN.     70    74      4
# TPO.DESCENSO MAX.     74    78      4
# TPO.INCL.ADEL.MAX.    78    82      4
# TPO.INCL.ATRAS.MAX.   82    86      4
# TPO.ELEV.MIN.S/CARGA  86    90      4
# TPO.ELEV.MAX.S/CARGA  90    94      4
# TPO.DESC.MIN.S/CARGA  94    98      4
# TPO.DESC.MAX.S/CARGA  98   102      4
# ─────────────────────────────────────────────────────────────

def _safe_float(s: str):
    """Convierte un campo del DAT a float, devuelve None si no es válido."""
    try:
        return float(s.strip())
    except (ValueError, AttributeError):
        return None

def _safe_str(s: str):
    return s.strip() if s else None


def parse_and_sync_dat():
    # Leer el archivo database.config para obtener la ruta del ERP
    config = configparser.ConfigParser()
    config_path = get_config_path()
    config.read(config_path)
    
    # Obtener el path del ERP configurado (con fallback al valor por defecto)
    default_path = r"C:\Users\franj\OneDrive\Escritorio\COSAS  FRAN\PROYECTOS\JAULA ELEVACION\FICHEROS JAULA\DATOSMAST.DAT"
    dat_path = config.get('ERP', 'file_path', fallback=default_path)
    
    # Si la ruta no existe de manera absoluta o relativa directa,
    # intentamos buscarlo en el directorio de ficheros por defecto.
    if not os.path.exists(dat_path):
        default_dir = r"C:\Users\franj\OneDrive\Escritorio\COSAS  FRAN\PROYECTOS\JAULA ELEVACION\FICHEROS JAULA"
        alternative_path = os.path.join(default_dir, os.path.basename(dat_path))
        if os.path.exists(alternative_path):
            dat_path = alternative_path

    if not os.path.exists(dat_path):
        return {"status": "error", "message": f"Archivo ERP no encontrado en: {dat_path}"}

    file_size = os.path.getsize(dat_path)
    print(f"[ERP-SYNC] Leyendo: {dat_path} ({file_size} bytes)")

    # ── Fase 1: parsear todo el fichero en memoria ───────────────────────────
    nuevos_registros = []
    count_skipped = 0

    try:
        with open(dat_path, 'r', encoding='latin-1', errors='ignore') as f:
            for line in f:
                if len(line) < 46:
                    count_skipped += 1
                    continue

                fecha   = _safe_str(line[0:8])
                sec     = _safe_str(line[8:12])
                modelo  = _safe_str(line[12:23])
                bast    = _safe_str(line[23:40])
                mastil  = _safe_str(line[40:46])

                if not bast:
                    count_skipped += 1
                    continue

                altura          = _safe_float(line[46:50])  if len(line) >= 50  else None
                capac_1         = _safe_float(line[50:54])  if len(line) >= 54  else None
                capac_2         = _safe_float(line[54:58])  if len(line) >= 58  else None
                capac_3         = _safe_float(line[58:62])  if len(line) >= 62  else None
                tpo_elev_min    = _safe_float(line[62:66])  if len(line) >= 66  else None
                tpo_elev_max    = _safe_float(line[66:70])  if len(line) >= 70  else None
                tpo_desc_min    = _safe_float(line[70:74])  if len(line) >= 74  else None
                tpo_desc_max    = _safe_float(line[74:78])  if len(line) >= 78  else None
                tpo_incl_adel   = _safe_float(line[78:82])  if len(line) >= 82  else None
                tpo_incl_atras  = _safe_float(line[82:86])  if len(line) >= 86  else None
                tpo_elev_min_sc = _safe_float(line[86:90])  if len(line) >= 90  else None
                tpo_elev_max_sc = _safe_float(line[90:94])  if len(line) >= 94  else None
                tpo_desc_min_sc = _safe_float(line[94:98])  if len(line) >= 98  else None
                tpo_desc_max_sc = _safe_float(line[98:102]) if len(line) >= 102 else None
                peso_pruebas    = _safe_float(line[102:107]) if len(line) >= 107 else None

                nuevos_registros.append(ErpCarretilla(
                    fecha_montaje=fecha, secuencia=sec, modelo=modelo,
                    bastidor=bast, mastil=mastil,
                    altura_max_interm=altura,
                    capac_interm_1=capac_1, capac_interm_2=capac_2, capac_interm_3=capac_3,
                    peso_pruebas=peso_pruebas,
                    tpo_elevac_min=tpo_elev_min, tpo_elevac_max=tpo_elev_max,
                    tpo_descenso_min=tpo_desc_min, tpo_descenso_max=tpo_desc_max,
                    tpo_incl_adel_max=tpo_incl_adel, tpo_incl_atras_max=tpo_incl_atras,
                    tpo_elev_min_scarga=tpo_elev_min_sc, tpo_elev_max_scarga=tpo_elev_max_sc,
                    tpo_desc_min_scarga=tpo_desc_min_sc, tpo_desc_max_scarga=tpo_desc_max_sc,
                ))
    except Exception as e:
        return {"status": "error", "message": f"Error al leer el fichero DAT: {str(e)}"}

    if not nuevos_registros:
        return {"status": "error", "message": f"El fichero DAT no contiene ningún registro válido: {dat_path}"}

    # ── Fase 2: reemplazar la tabla completa (borra lo viejo, inserta lo nuevo) ─
    db: Session = SessionLocal()
    try:
        eliminados = db.query(ErpCarretilla).count()
        db.query(ErpCarretilla).delete()          # borra TODOS los registros previos
        db.bulk_save_objects(nuevos_registros)    # inserta los del fichero actual
        db.commit()

        count_new = len(nuevos_registros)
        msg = (
            f"Leer ERP OK — {eliminados} registros anteriores eliminados, "
            f"{count_new} cargados desde el fichero. "
            f"{count_skipped} líneas omitidas."
        )
        print(f"[ERP-SYNC] {msg}")
        return {
            "status": "success",
            "message": msg,
            "nuevos": count_new,
            "eliminados": eliminados,
            "omitidos": count_skipped,
            "total_bd": count_new,
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": f"Error al guardar en base de datos: {str(e)}"}
    finally:
        db.close()
