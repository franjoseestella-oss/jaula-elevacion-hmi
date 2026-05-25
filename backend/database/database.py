import configparser
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Obtener la ruta del archivo .config de forma robusta (desarrollo y producción)
def get_config_path():
    import sys
    candidates = [
        os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), 'database.config'),
        os.path.join(os.getcwd(), 'database.config'),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'database.config'),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'database.config'),
    ]
    if hasattr(sys, '_MEIPASS'):
        candidates.append(os.path.join(sys._MEIPASS, 'database.config'))
        
    for c in candidates:
        if os.path.exists(c):
            return c
    return 'database.config'

config = configparser.ConfigParser()
config_path = get_config_path()
config.read(config_path)

# Extraer la URL de la base de datos
# Si no existe el archivo o la sección, usamos SQLite en la raíz del backend por defecto
DATABASE_URL = config.get('DATABASE', 'url', fallback="sqlite:///./hmi_logisnext.db")

# Crear el Engine. Si es sqlite necesitamos check_same_thread=False en FastAPI
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(
    DATABASE_URL, 
    echo=False,
    connect_args=connect_args
)

# Fábrica de Sesiones
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base declarativa para modelos
Base = declarative_base()

def get_db():
    """Generador para obtener una sesión de base de datos."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
