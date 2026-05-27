import configparser
import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ─── Resolución robusta del archivo .config ───────────────────────────────────
def get_config_path():
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

# ─── Engine principal (DAFEED / SQL Server) ───────────────────────────────────
DATABASE_URL = config.get('DATABASE', 'url', fallback="sqlite:///./hmi_logisnext.db")
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

# Fábrica de sesiones y base declarativa
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Alias para compatibilidad interna (erp_sync, etc.)
LocalSessionLocal = SessionLocal

def get_db():
    """Sesión hacia DAFEED — para todos los endpoints y operaciones de la app."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Alias de get_db para compatibilidad
get_local_db = get_db
