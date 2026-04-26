import os
from sqlalchemy.orm import Session
from database.database import SessionLocal
from database.models import ErpCarretilla

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
    dat_path = r"C:\Users\franj\OneDrive\Escritorio\COSAS  FRAN\PROYECTOS\JAULA ELEVACION\FICHEROS JAULA\DATOSMAST.DAT"
    if not os.path.exists(dat_path):
        return {"status": "error", "message": f"Archivo DATOSMAST.DAT no encontrado en {dat_path}"}

    db: Session = SessionLocal()
    count_new = 0
    count_updated = 0
    count_skipped = 0

    try:
        with open(dat_path, 'r', encoding='latin-1', errors='ignore') as f:
            for line in f:
                # Línea mínima de 102 chars para contener todos los campos
                if len(line) < 46:
                    count_skipped += 1
                    continue

                # Extraer todos los campos con offsets reales
                fecha   = _safe_str(line[0:8])
                sec     = _safe_str(line[8:12])
                modelo  = _safe_str(line[12:23])
                bast    = _safe_str(line[23:40])
                mastil  = _safe_str(line[40:46])

                if not bast:
                    count_skipped += 1
                    continue

                # Parámetros numéricos (pueden estar vacíos en líneas cortas)
                altura      = _safe_float(line[46:50]) if len(line) > 50 else None
                capac_1     = _safe_float(line[50:54]) if len(line) > 54 else None
                capac_2     = _safe_float(line[54:58]) if len(line) > 58 else None
                capac_3     = _safe_float(line[58:62]) if len(line) > 62 else None
                tpo_elev_min    = _safe_float(line[62:66]) if len(line) > 66 else None
                tpo_elev_max    = _safe_float(line[66:70]) if len(line) > 70 else None
                tpo_desc_min    = _safe_float(line[70:74]) if len(line) > 74 else None
                tpo_desc_max    = _safe_float(line[74:78]) if len(line) > 78 else None
                tpo_incl_adel   = _safe_float(line[78:82]) if len(line) > 82 else None
                tpo_incl_atras  = _safe_float(line[82:86]) if len(line) > 86 else None
                tpo_elev_min_sc = _safe_float(line[86:90]) if len(line) > 90 else None
                tpo_elev_max_sc = _safe_float(line[90:94]) if len(line) > 94 else None
                tpo_desc_min_sc = _safe_float(line[94:98]) if len(line) > 98 else None
                tpo_desc_max_sc = _safe_float(line[98:102]) if len(line) > 102 else None

                # Upsert por bastidor
                existing = db.query(ErpCarretilla).filter(ErpCarretilla.bastidor == bast).first()

                if not existing:
                    new_record = ErpCarretilla(
                        fecha_montaje=fecha, secuencia=sec, modelo=modelo,
                        bastidor=bast, mastil=mastil,
                        altura_max_interm=altura,
                        capac_interm_1=capac_1, capac_interm_2=capac_2, capac_interm_3=capac_3,
                        tpo_elevac_min=tpo_elev_min, tpo_elevac_max=tpo_elev_max,
                        tpo_descenso_min=tpo_desc_min, tpo_descenso_max=tpo_desc_max,
                        tpo_incl_adel_max=tpo_incl_adel, tpo_incl_atras_max=tpo_incl_atras,
                        tpo_elev_min_scarga=tpo_elev_min_sc, tpo_elev_max_scarga=tpo_elev_max_sc,
                        tpo_desc_min_scarga=tpo_desc_min_sc, tpo_desc_max_scarga=tpo_desc_max_sc,
                    )
                    db.add(new_record)
                    count_new += 1
                else:
                    existing.fecha_montaje = fecha
                    existing.secuencia = sec
                    existing.modelo = modelo
                    existing.mastil = mastil
                    existing.altura_max_interm = altura
                    existing.capac_interm_1 = capac_1
                    existing.capac_interm_2 = capac_2
                    existing.capac_interm_3 = capac_3
                    existing.tpo_elevac_min = tpo_elev_min
                    existing.tpo_elevac_max = tpo_elev_max
                    existing.tpo_descenso_min = tpo_desc_min
                    existing.tpo_descenso_max = tpo_desc_max
                    existing.tpo_incl_adel_max = tpo_incl_adel
                    existing.tpo_incl_atras_max = tpo_incl_atras
                    existing.tpo_elev_min_scarga = tpo_elev_min_sc
                    existing.tpo_elev_max_scarga = tpo_elev_max_sc
                    existing.tpo_desc_min_scarga = tpo_desc_min_sc
                    existing.tpo_desc_max_scarga = tpo_desc_max_sc
                    count_updated += 1

        db.commit()
        return {
            "status": "success",
            "message": f"Sync OK: {count_new} nuevos, {count_updated} actualizados, {count_skipped} omitidos."
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": f"Error durante la importacion: {str(e)}"}
    finally:
        db.close()
