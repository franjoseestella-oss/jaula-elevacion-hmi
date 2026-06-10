from sqlalchemy import Column, Integer, String, Float, DateTime, BigInteger
from sqlalchemy.sql import func
from .database import Base, engine


class ErpCarretilla(Base):
    """
    Caché de los datos del ERP importados desde DATOSMAST.DAT / NI46SF.DAT.
    Se almacena en DAFEED (SQL Server), tabla dbo.JAULA_ERP.
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

    # Tiempos CON CARGA
    tpo_elevac_min      = Column(Float, nullable=True)
    tpo_elevac_max      = Column(Float, nullable=True)
    tpo_descenso_min    = Column(Float, nullable=True)
    tpo_descenso_max    = Column(Float, nullable=True)
    tpo_incl_adel_max   = Column(Float, nullable=True)
    tpo_incl_atras_max  = Column(Float, nullable=True)

    # Tiempos SIN CARGA
    tpo_elev_min_scarga     = Column(Float, nullable=True)
    tpo_elev_max_scarga     = Column(Float, nullable=True)
    tpo_desc_min_scarga     = Column(Float, nullable=True)
    tpo_desc_max_scarga     = Column(Float, nullable=True)

    # Peso de pruebas — al final, como en la tabla original de DAFEED
    peso_pruebas        = Column(Float, nullable=True)

    fecha_importacion = Column(DateTime, server_default=func.now(), nullable=True)


class LogTabla(Base):
    __tablename__ = "LOG_TABLA"

    id = Column(Integer, primary_key=True, index=True)

    # 1. Identificación y Generales
    OPERARIO = Column(String(100), nullable=True)
    FECHA_MONTAJE = Column(String(20), nullable=True)
    NSECUENCIA = Column(String(20), nullable=True)
    NMODELO = Column(String(50), nullable=True)
    NBASTIDOR = Column(String(100), nullable=True)
    NMASTIL = Column(String(50), nullable=True)
    ALTURA_MAX_INTERMEDIA = Column(Float, nullable=True)

    # 2. Multiload
    ALTURA_CAPTADA = Column(Float, nullable=True)
    FECHA_HORA_INICIO_MULTILOAD = Column(String(50), nullable=True)
    FECHA_HORA_FIN_MULTILOAD = Column(String(50), nullable=True)
    ESTADO_MULTILOAD = Column(String(20), nullable=True)

    # 3. Sin Carga
    TIEMPO_ELEVACION_MIN_SINCARGA = Column(Float, nullable=True)
    TIEMPO_ELEVACION_MAX_SINCARGA = Column(Float, nullable=True)
    TIEMPO_ELEVACION_MEDIDO_SINCARGA = Column(Float, nullable=True)
    AVG_ELEVACION_SINCARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MIN_SINCARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MAX_SINCARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MEDIDO_SINCARGA = Column(Float, nullable=True)
    AVG_DESCENSO_SINCARGA = Column(Float, nullable=True)
    FECHA_HORA_INICIO_SINCARGA = Column(String(50), nullable=True)
    FECHA_HORA_FIN_SINCARGA = Column(String(50), nullable=True)
    ESTADO_SINCARGA = Column(String(20), nullable=True)

    # 4. Con Carga
    TIEMPO_ELEVACION_MIN_CARGA = Column(Float, nullable=True)
    TIEMPO_ELEVACION_MAX_CARGA = Column(Float, nullable=True)
    TIEMPO_ELEVACION_MEDIDO_CARGA = Column(Float, nullable=True)
    AVG_ELEVACION_CARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MIN_CARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MAX_CARGA = Column(Float, nullable=True)
    TIEMPO_DESCENSO_MEDIDO_CARGA = Column(Float, nullable=True)
    AVG_DESCENSO_CARGA = Column(Float, nullable=True)
    FECHA_HORA_INICIO_CARGA = Column(String(50), nullable=True)
    FECHA_HORA_FIN_CARGA = Column(String(50), nullable=True)
    ESTADO_CARGA = Column(String(20), nullable=True)
    CARGA_CONSIGNADA = Column(Float, nullable=True)
    CARGA_GET = Column(Float, nullable=True)
    PESO_PRUEBA = Column(Float, nullable=True)

    # 5. 5 Minutos
    ALTURA_INICIAL = Column(Float, nullable=True)
    ALTURA_FINAL = Column(Float, nullable=True)
    DIFERENCIA_ALTURAS = Column(Float, nullable=True)
    FECHA_HORA_INICIO_5MIN = Column(String(50), nullable=True)
    FECHA_HORA_FIN_5MIN = Column(String(50), nullable=True)
    ESTADO_CARGA_5_MIN = Column(String(20), nullable=True)

    # 6. Final
    REPETICIONES_SECUENCIA = Column(Integer, nullable=True)
    FECHA_HORA_INICIO_SEC = Column(String(50), nullable=True)
    FECHA_HORA_FIN_SEC = Column(String(50), nullable=True)
    DURACION_SEC = Column(String(50), nullable=True)
    OK_NOK = Column(String(20), nullable=True)

    fecha_creacion = Column(DateTime, server_default=func.now(), nullable=True)


class LogAlarma(Base):
    __tablename__ = "LOG_ALARMAS"

    id = Column(Integer, primary_key=True, index=True)
    FECHA_Y_HORA = Column(String(50), nullable=True)
    TIPO = Column(String(50), nullable=True)
    DESCRIPCION = Column(String(500), nullable=True)
    DURACION = Column(String(50), nullable=True)


class ReferenciaEnCiclo(Base):
    __tablename__ = "REFERENCIA_EN_CICLO"

    id = Column(Integer, primary_key=True)
    ETAPA_ACTUAL = Column(Integer, nullable=True, default=0)
    REFERENCIA_ACTUAL = Column(String(100), nullable=True, default="0")
    FECHA_INICIO_CICLO = Column(String(50), nullable=True, default="0")

    # Campos idénticos a LogTabla
    OPERARIO = Column(String(100), nullable=True, default="0")
    FECHA_MONTAJE = Column(String(20), nullable=True, default="0")
    NSECUENCIA = Column(String(20), nullable=True, default="0")
    NMODELO = Column(String(50), nullable=True, default="0")
    NBASTIDOR = Column(String(100), nullable=True, default="0")
    NMASTIL = Column(String(50), nullable=True, default="0")
    ALTURA_MAX_INTERMEDIA = Column(Float, nullable=True, default=0.0)

    # 2. Multiload
    ALTURA_CAPTADA = Column(Float, nullable=True, default=0.0)
    FECHA_HORA_INICIO_MULTILOAD = Column(String(50), nullable=True, default="0")
    FECHA_HORA_FIN_MULTILOAD = Column(String(50), nullable=True, default="0")
    ESTADO_MULTILOAD = Column(String(20), nullable=True, default="0")

    # 3. Sin Carga
    TIEMPO_ELEVACION_MIN_SINCARGA = Column(Float, nullable=True, default=0.0)
    TIEMPO_ELEVACION_MAX_SINCARGA = Column(Float, nullable=True, default=0.0)
    TIEMPO_ELEVACION_MEDIDO_SINCARGA = Column(Float, nullable=True, default=0.0)
    AVG_ELEVACION_SINCARGA = Column(Float, nullable=True, default=0.0)
    TIEMPO_DESCENSO_MIN_SINCARGA = Column(Float, nullable=True, default=0.0)
    TIEMPO_DESCENSO_MAX_SINCARGA = Column(Float, nullable=True, default=0.0)
    TIEMPO_DESCENSO_MEDIDO_SINCARGA = Column(Float, nullable=True, default=0.0)
    AVG_DESCENSO_SINCARGA = Column(Float, nullable=True, default=0.0)
    FECHA_HORA_INICIO_SINCARGA = Column(String(50), nullable=True, default="0")
    FECHA_HORA_FIN_SINCARGA = Column(String(50), nullable=True, default="0")
    ESTADO_SINCARGA = Column(String(20), nullable=True, default="0")

    # 4. Con Carga
    TIEMPO_ELEVACION_MIN_CARGA = Column(Float, nullable=True, default=0.0)
    TIEMPO_ELEVACION_MAX_CARGA = Column(Float, nullable=True, default=0.0)
    TIEMPO_ELEVACION_MEDIDO_CARGA = Column(Float, nullable=True, default=0.0)
    AVG_ELEVACION_CARGA = Column(Float, nullable=True, default=0.0)
    TIEMPO_DESCENSO_MIN_CARGA = Column(Float, nullable=True, default=0.0)
    TIEMPO_DESCENSO_MAX_CARGA = Column(Float, nullable=True, default=0.0)
    TIEMPO_DESCENSO_MEDIDO_CARGA = Column(Float, nullable=True, default=0.0)
    AVG_DESCENSO_CARGA = Column(Float, nullable=True, default=0.0)
    FECHA_HORA_INICIO_CARGA = Column(String(50), nullable=True, default="0")
    FECHA_HORA_FIN_CARGA = Column(String(50), nullable=True, default="0")
    ESTADO_CARGA = Column(String(20), nullable=True, default="0")
    CARGA_CONSIGNADA = Column(Float, nullable=True, default=0.0)
    CARGA_GET = Column(Float, nullable=True, default=0.0)
    PESO_PRUEBA = Column(Float, nullable=True, default=0.0)

    # 5. 5 Minutos
    ALTURA_INICIAL = Column(Float, nullable=True, default=0.0)
    ALTURA_FINAL = Column(Float, nullable=True, default=0.0)
    DIFERENCIA_ALTURAS = Column(Float, nullable=True, default=0.0)
    FECHA_HORA_INICIO_5MIN = Column(String(50), nullable=True, default="0")
    FECHA_HORA_FIN_5MIN = Column(String(50), nullable=True, default="0")
    ESTADO_CARGA_5_MIN = Column(String(20), nullable=True, default="0")

    # 6. Final
    REPETICIONES_SECUENCIA = Column(Integer, nullable=True, default=0)
    FECHA_HORA_INICIO_SEC = Column(String(50), nullable=True, default="0")
    FECHA_HORA_FIN_SEC = Column(String(50), nullable=True, default="0")
    DURACION_SEC = Column(String(50), nullable=True, default="0")
    OK_NOK = Column(String(20), nullable=True, default="0")


def init_db():
    """Crea las tablas de la aplicación en DAFEED (SQL Server) si no existen."""
    try:
        Base.metadata.create_all(bind=engine)
        print("[OK] Tablas creadas/verificadas en DAFEED (JAULA_ERP, LOG_TABLA, LOG_ALARMAS, REFERENCIA_EN_CICLO).")

        # Inicializar/Resetear el registro de ciclo
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(bind=engine)
        session = SessionLocal()
        try:
            ref = session.query(ReferenciaEnCiclo).first()
            if not ref:
                ref = ReferenciaEnCiclo()
                session.add(ref)
            else:
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
            session.commit()
            print("[OK] Registro inicial de REFERENCIA_EN_CICLO establecido a 0.")
        except Exception as e:
            session.rollback()
            print(f"[WARN] Error al inicializar/resetear REFERENCIA_EN_CICLO: {e}")
        finally:
            session.close()
    except Exception as e:
        print(f"[ERROR] No se pudieron crear las tablas en DAFEED: {e}")
        raise

