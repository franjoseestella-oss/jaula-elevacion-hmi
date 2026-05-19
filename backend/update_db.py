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
        conn.execute(text("ALTER TABLE LOG_TABLA ADD AVG_DESCENSO_CARGA FLOAT NULL;"))
        print('Added AVG_DESCENSO_CARGA')
    except Exception as e:
        print('Add AVG_DESCENSO_CARGA failed:', e)
        
    conn.commit()
