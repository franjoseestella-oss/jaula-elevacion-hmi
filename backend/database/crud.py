from sqlalchemy.orm import Session
from .models import ErpCarretilla, PruebaElevacion, RegistroTelemetria
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
# PruebaElevacion
# ─────────────────────────────────────────────────────────────

def create_prueba(db: Session, prueba_data: dict) -> PruebaElevacion:
    """Crea un nuevo registro de prueba de elevación."""
    prueba = PruebaElevacion(**prueba_data)
    db.add(prueba)
    db.commit()
    db.refresh(prueba)
    return prueba

def get_pruebas_by_bastidor(db: Session, bastidor: str, limit: int = 20) -> List[PruebaElevacion]:
    """Obtiene el historial de pruebas de un bastidor."""
    return (
        db.query(PruebaElevacion)
        .filter(PruebaElevacion.bastidor.ilike(f"%{bastidor}%"))
        .order_by(PruebaElevacion.fecha_creacion.desc())
        .limit(limit)
        .all()
    )

def get_prueba_by_id(db: Session, prueba_id: int) -> Optional[PruebaElevacion]:
    return db.query(PruebaElevacion).filter(PruebaElevacion.id == prueba_id).first()

def update_prueba_resultado(
    db: Session, prueba_id: int, tiempo_real: float, estado: str
) -> Optional[PruebaElevacion]:
    """Actualiza el resultado final de una prueba."""
    prueba = get_prueba_by_id(db, prueba_id)
    if prueba:
        prueba.tiempo_real_elevacion = tiempo_real
        prueba.estado_final = estado
        db.commit()
        db.refresh(prueba)
    return prueba


# ─────────────────────────────────────────────────────────────
# RegistroTelemetria
# ─────────────────────────────────────────────────────────────

def add_telemetria(db: Session, prueba_id: int, tiempo: float, distancia: float, estado: str) -> RegistroTelemetria:
    """Almacena un punto de telemetría asociado a una prueba."""
    registro = RegistroTelemetria(
        prueba_id=prueba_id,
        tiempo_transcurrido=tiempo,
        distancia_mm=distancia,
        estado_movimiento=estado
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return registro

def get_telemetria_by_prueba(db: Session, prueba_id: int) -> List[RegistroTelemetria]:
    """Obtiene todos los registros de telemetría de una prueba."""
    return (
        db.query(RegistroTelemetria)
        .filter(RegistroTelemetria.prueba_id == prueba_id)
        .order_by(RegistroTelemetria.timestamp.asc())
        .all()
    )
