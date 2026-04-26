from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from .database import Base, engine

class PruebaElevacion(Base):
    __tablename__ = "pruebas_elevacion"

    id = Column(Integer, primary_key=True, index=True)
    fecha_montaje = Column(String(20))
    secuencia = Column(String(20))
    modelo = Column(String(50))
    bastidor = Column(String(100))
    mastil = Column(String(50))
    
    # Tolerancias objetivo
    altura_max_interm = Column(Float)
    tpo_elevac_min = Column(Float)
    tpo_elevac_max = Column(Float)
    
    # Tiempos reales (para cuando finalice la prueba)
    tiempo_real_elevacion = Column(Float, nullable=True)
    estado_final = Column(String(20), default="PENDIENTE")
    
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

class ErpCarretilla(Base):
    """
    Caché local de los datos del ERP importados desde DATOSMAST.DAT.
    Esquema NG6OF1 — offsets fijos de caracteres.
    """
    __tablename__ = "JAULA_ERP"

    id              = Column(Integer, primary_key=True, index=True)
    fecha_montaje   = Column(String(8))
    secuencia       = Column(String(4))
    modelo          = Column(String(11))
    bastidor        = Column(String(17), unique=True, index=True)
    mastil          = Column(String(6))

    # Parámetros de prueba
    altura_max_interm   = Column(Float, nullable=True)  # mm
    capac_interm_1      = Column(Float, nullable=True)  # kg
    capac_interm_2      = Column(Float, nullable=True)
    capac_interm_3      = Column(Float, nullable=True)

    # Tiempos CON CARGA (segundos)
    tpo_elevac_min      = Column(Float, nullable=True)
    tpo_elevac_max      = Column(Float, nullable=True)
    tpo_descenso_min    = Column(Float, nullable=True)
    tpo_descenso_max    = Column(Float, nullable=True)
    tpo_incl_adel_max   = Column(Float, nullable=True)
    tpo_incl_atras_max  = Column(Float, nullable=True)

    # Tiempos SIN CARGA (segundos)
    tpo_elev_min_scarga     = Column(Float, nullable=True)
    tpo_elev_max_scarga     = Column(Float, nullable=True)
    tpo_desc_min_scarga     = Column(Float, nullable=True)
    tpo_desc_max_scarga     = Column(Float, nullable=True)

    fecha_importacion = Column(DateTime(timezone=True), server_default=func.now())


class RegistroTelemetria(Base):
    __tablename__ = "registros_telemetria"

    id = Column(Integer, primary_key=True, index=True)
    prueba_id = Column(Integer, index=True) # Referencia lógica a PruebaElevacion
    tiempo_transcurrido = Column(Float)
    distancia_mm = Column(Float)
    estado_movimiento = Column(String(50))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

def init_db():
    Base.metadata.create_all(bind=engine)
    print("Tablas de base de datos creadas/sincronizadas correctamente.")
