from sqlalchemy.orm import Session
from .models import ErpCarretilla, LogTabla, LogAlarma
from typing import Optional, List


# ─────────────────────────────────────────────────────────────
# ErpCarretilla (tabla JAULA_ERP)
# ─────────────────────────────────────────────────────────────

def get_carretilla_by_bastidor(db: Session, bastidor: str) -> Optional[ErpCarretilla]:
    """Busca un registro ERP por número de bastidor (búsqueda parcial o exacta)."""
    return (
        db.query(ErpCarretilla)
        .filter(ErpCarretilla.bastidor.ilike(f"%{bastidor}%"))
        .first()
    )

def get_all_carretillas(db: Session, skip: int = 0, limit: int = 200) -> List[ErpCarretilla]:
    """Devuelve todas las carretillas importadas del ERP."""
    return db.query(ErpCarretilla).offset(skip).limit(limit).all()

def get_carretilla_count(db: Session) -> int:
    """Cuenta el total de registros importados."""
    return db.query(ErpCarretilla).count()

def upsert_carretilla(db: Session, data: dict) -> ErpCarretilla:
    """Inserta o actualiza una carretilla por su bastidor."""
    bastidor = data.get("bastidor", "").strip()
    existing = db.query(ErpCarretilla).filter(ErpCarretilla.bastidor == bastidor).first()

    if existing:
        existing.fecha_montaje = data.get("fecha_montaje", existing.fecha_montaje)
        existing.secuencia = data.get("secuencia", existing.secuencia)
        existing.modelo = data.get("modelo", existing.modelo)
        existing.mastil = data.get("mastil", existing.mastil)
        existing.datos_crudos = data.get("datos_crudos", existing.datos_crudos)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_record = ErpCarretilla(**data)
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        return new_record



# ─────────────────────────────────────────────────────────────
# LogTabla
# ─────────────────────────────────────────────────────────────

def create_log(db: Session, log_data: dict) -> LogTabla:
    """Guarda o actualiza un registro completo en LOG_TABLA."""
    # Sanitizar strings 'NULL' o 'null' a None
    cleaned_data = {}
    for k, v in log_data.items():
        if isinstance(v, str) and v.strip().upper() == 'NULL':
            cleaned_data[k] = None
        else:
            cleaned_data[k] = v

    log_id = cleaned_data.get("id")
    existing = None
    if log_id is not None:
        existing = db.query(LogTabla).filter(LogTabla.id == log_id).first()

    if existing:
        # Actualizar todos los campos del registro existente
        for k, v in cleaned_data.items():
            if k != 'id':  # No cambiar la clave primaria
                setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        if 'id' in cleaned_data:
            del cleaned_data['id']
        log = LogTabla(**cleaned_data)
        # Generar ID manual autoincremental si no se proporciona, ya que la columna id en LOG_TABLA no es IDENTITY
        if log.id is None:
            from sqlalchemy import func
            max_id = db.query(func.max(LogTabla.id)).scalar()
            log.id = 1.0 if max_id is None else float(max_id) + 1.0

        db.add(log)
        db.commit()
        db.refresh(log)
        return log


def get_logs(db: Session, skip: int = 0, limit: int = 200) -> List[LogTabla]:
    """Obtiene el historial de LOG_TABLA."""
    return db.query(LogTabla).order_by(LogTabla.id.desc()).offset(skip).limit(limit).all()

def get_last_log_for_bastidor(db: Session, bastidor: str) -> Optional[LogTabla]:
    """Obtiene el último registro de LOG_TABLA para un bastidor."""
    return db.query(LogTabla).filter(LogTabla.NBASTIDOR == bastidor).order_by(LogTabla.id.desc()).first()


# ─────────────────────────────────────────────────────────────
# LogAlarma (tabla LOG_ALARMAS)
# ─────────────────────────────────────────────────────────────

def create_alarm(db: Session, alarm_data: dict) -> LogAlarma:
    """Inserta una nueva alarma en LOG_ALARMAS."""
    db_data = {
        "FECHA_Y_HORA": alarm_data.get("timestamp"),
        "TIPO": alarm_data.get("type"),
        "DESCRIPCION": alarm_data.get("description"),
        "DURACION": alarm_data.get("duration", "Activa")
    }
    alarm = LogAlarma(**db_data)
    db.add(alarm)
    db.commit()
    db.refresh(alarm)
    return alarm

def resolve_alarm(db: Session, plcVar: str, endTime: int, duration: str) -> Optional[LogAlarma]:
    """Marca como resuelta la alarma más reciente que esté activa buscando por descripción."""
    mapping = {
        "SYS_PLC_DISCONNECTED": "Sin conexión con PLC",
        "SYS_QR_DISCONNECTED": "Lector QR Datalogic desconectado",
        "SYS_MODO_MANUAL": "Máquina en estado manual",
        "SYS_FENCE_NOT_IN_WORK": "Valla no está en trabajo",
        "SYS_FENCE_NOT_IN_REPOSO": "Valla no está en reposo"
    }
    search_term = mapping.get(plcVar, f"[{plcVar}]")

    alarm = (
        db.query(LogAlarma)
        .filter(LogAlarma.DURACION == "Activa", LogAlarma.DESCRIPCION.like(f"%{search_term}%"))
        .order_by(LogAlarma.id.desc())
        .first()
    )
    if alarm:
        alarm.DURACION = duration
        db.commit()
        db.refresh(alarm)
    return alarm

def get_alarms(db: Session, skip: int = 0, limit: int = 2000) -> List[LogAlarma]:
    """Obtiene el historial de LOG_ALARMAS ordenado de más reciente a más antiguo."""
    return db.query(LogAlarma).order_by(LogAlarma.id.desc()).offset(skip).limit(limit).all()

def delete_all_alarms(db: Session):
    """Borra todo el historial de la tabla LOG_ALARMAS."""
    db.query(LogAlarma).delete()
    db.commit()

