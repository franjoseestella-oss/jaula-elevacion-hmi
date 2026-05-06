from sqlalchemy.orm import Session
from .models import ErpCarretilla, LogTabla
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
    """Guarda un registro completo en LOG_TABLA."""
    # Evitar guardar en base de datos si log_data tiene campos nulos irrelevantes que fallarían
    log = LogTabla(**log_data)
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
