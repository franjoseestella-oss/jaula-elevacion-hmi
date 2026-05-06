import configparser
from sqlalchemy import create_engine, text

config = configparser.ConfigParser()
config.read('database.config')
url = config.get('DATABASE', 'url')

engine = create_engine(url)
with engine.connect() as conn:
    try:
        conn.execute(text("EXEC sp_rename 'LOG_TABLA.ESTADO_DESCENSO_CARGA', 'ESTADO_CARGA', 'COLUMN';"))
        print('Renamed ESTADO_DESCENSO_CARGA to ESTADO_CARGA')
    except Exception as e:
        print('Rename failed:', e)
    
    try:
        conn.execute(text("ALTER TABLE LOG_TABLA ADD DURACION_SEC VARCHAR(50) NULL;"))
        print('Added DURACION_SEC')
    except Exception as e:
        print('Add DURACION_SEC failed:', e)
        
    conn.commit()
