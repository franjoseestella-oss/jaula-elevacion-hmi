from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from .database import Base, engine



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




class LogTabla(Base):
    __tablename__ = "LOG_TABLA"

    id = Column(Integer, primary_key=True, index=True)
    
    # 1. Cabecera (ERP)
    FECHA_MONTAJE = Column(String(20), nullable=True)
    NSECUENCIA = Column(String(20), nullable=True)
    NMODELO = Column(String(50), nullable=True)
    NBASTIDOR = Column(String(100), nullable=True)
    NMASTIL = Column(String(50), nullable=True)
    ALTURA_MAX_INTERMEDIA = Column(Float, nullable=True)
    CARGA_CONSIGNADA = Column(Float, nullable=True)
    TIEMPO_ELEVACION_MIN_SINCARGA = Column(Float, nullable=True)
    TIEMPO_ELEVACION_MAX_SINCARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MIN_SINCARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MAX_SINCARGA = Column(Float, nullable=True)
    TIEMPO_ELEVACION_MIN_CARGA = Column(Float, nullable=True)
    TIEMPO_ELEVACION_MAX_CARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MIN_CARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MAX_CARGA = Column(Float, nullable=True)

    # 2. Etapa 2 (Multiload)
    ALTURA_CAPTADA = Column(Float, nullable=True)
    FECHA_HORA_INICIO_MULTILOAD = Column(String(50), nullable=True)
    FECHA_HORA_FIN_MULTILOAD = Column(String(50), nullable=True)
    ESTADO_MULTILOAD = Column(String(20), nullable=True)

    # 3. Etapa 3 (Sin Carga)
    TIEMPO_ELEVACION_MEDIDO_SINCARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MEDIDO_SINCARGA = Column(Float, nullable=True)
    FECHA_HORA_INICIO_SINCARGA = Column(String(50), nullable=True)
    FECHA_HORA_FIN_SINCARGA = Column(String(50), nullable=True)
    ESTADO_SINCARGA = Column(String(20), nullable=True)

    # 4. Etapa 4 (Con Carga)
    TIEMPO_ELEVACION_MEDIDO_CARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MEDIDO_CARGA = Column(Float, nullable=True)
    FECHA_HORA_INICIO_CARGA = Column(String(50), nullable=True)
    FECHA_HORA_FIN_CARGA = Column(String(50), nullable=True)
    ESTADO_DESCENSO_CARGA = Column(String(20), nullable=True)
    CARGA_GET = Column(Float, nullable=True)

    # 5. Etapa 5 (5 Minutos)
    ALTURA_INICIAL = Column(Float, nullable=True)
    ALTURA_FINAL = Column(Float, nullable=True)
    DIFERENCIA_ALTURAS = Column(Float, nullable=True)
    FECHA_HORA_INICIO_5MIN = Column(String(50), nullable=True)
    FECHA_HORA_FIN_5MIN = Column(String(50), nullable=True)
    ESTADO_CARGA_5_MIN = Column(String(20), nullable=True)

    # 6. Globales
    OK_NOK = Column(String(20), nullable=True)
    REPETICIONES_SECUENCIA = Column(Integer, nullable=True)
    FECHA_HORA_INICIO_SEC = Column(String(50), nullable=True)
    FECHA_HORA_FIN_SEC = Column(String(50), nullable=True)
    OPERARIO = Column(String(100), nullable=True)

    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

def init_db():
    Base.metadata.create_all(bind=engine)
    print("Tablas de base de datos creadas/sincronizadas correctamente.")
