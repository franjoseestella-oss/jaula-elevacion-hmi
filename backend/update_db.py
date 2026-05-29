import os
import sys
import configparser
from sqlalchemy import create_engine, text

# Añadir la carpeta backend al path para poder importar database.database
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database.database import get_config_path

config = configparser.ConfigParser()
config_path = get_config_path()
config.read(config_path)
url = config.get('DATABASE', 'url')

engine = create_engine(url)
with engine.connect() as conn:
    try:
        conn.execute(text("EXEC sp_rename 'LOG_TABLA.ESTADO_DESCENSO_CARGA', 'ESTADO_CARGA', 'COLUMN';"))
        print('Renamed ESTADO_DESCENSO_CARGA to ESTADO_CARGA')
    except Exception as e:
        print('Rename failed:', e)
    
    try:
        conn.execute(text("ALTER TABLE LOG_TABLA ADD AVG_ELEVACION_SINCARGA FLOAT NULL;"))
        print('Added AVG_ELEVACION_SINCARGA')
    except Exception as e:
        print('Add AVG_ELEVACION_SINCARGA failed:', e)
        
    try:
        conn.execute(text("ALTER TABLE LOG_TABLA ADD AVG_DESCENSO_SINCARGA FLOAT NULL;"))
        print('Added AVG_DESCENSO_SINCARGA')
    except Exception as e:
        print('Add AVG_DESCENSO_SINCARGA failed:', e)

    try:
        conn.execute(text("ALTER TABLE LOG_TABLA ADD AVG_ELEVACION_CARGA FLOAT NULL;"))
        print('Added AVG_ELEVACION_CARGA')
    except Exception as e:
        print('Add AVG_ELEVACION_CARGA failed:', e)

    try:
        conn.execute(text("ALTER TABLE JAULA_ERP ADD peso_pruebas FLOAT NULL;"))
        print('Added peso_pruebas to JAULA_ERP')
    except Exception as e:
        print('Add peso_pruebas failed:', e)

    try:
        conn.execute(text("ALTER TABLE LOG_TABLA ADD PESO_PRUEBA FLOAT NULL;"))
        print('Added PESO_PRUEBA to LOG_TABLA')
    except Exception as e:
        print('Add PESO_PRUEBA failed:', e)

    conn.commit()
