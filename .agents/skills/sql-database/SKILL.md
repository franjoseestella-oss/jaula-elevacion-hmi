---
name: sql-database
description: Skill para crear, conectarse y gestionar bases de datos SQL (SQLite, PostgreSQL, MySQL, SQL Server) desde la aplicación Python utilizando SQLAlchemy ORM.
---

# 🗄️ SQL Database Skill

Esta skill define el estándar oficial para la integración de bases de datos SQL en el proyecto. Se utiliza **SQLAlchemy ORM** (versión 2.0+), lo que permite interactuar con la base de datos mediante objetos de Python y abstraer el motor subyacente (por defecto SQLite para desarrollo local, fácilmente escalable a PostgreSQL, MySQL, o SQL Server).

## 📦 1. Requisitos y Dependencias

Para instalar las dependencias necesarias, ejecuta:

```bash
# Instalación base de SQLAlchemy
pip install SQLAlchemy

# Si vas a usar SQLite, no necesitas nada más (viene integrado en Python).
# Si vas a usar PostgreSQL: pip install psycopg2-binary
# Si vas a usar MySQL/MariaDB: pip install pymysql
```

## ⚙️ 2. Conexión y Configuración del Engine

El `Engine` es el punto de entrada a la base de datos. La `Session` es lo que usamos para realizar las consultas y transacciones.

**Archivo sugerido: `database/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 1. Definir la URL de conexión.
# Para SQLite (archivo local en la carpeta del proyecto):
DATABASE_URL = "sqlite:///./app_database.db"

# Ejemplos para otros motores:
# PostgreSQL: "postgresql+psycopg2://usuario:password@localhost:5432/mi_base"
# MySQL: "mysql+pymysql://usuario:password@localhost:3306/mi_base"

# 2. Crear el Engine
engine = create_engine(
    DATABASE_URL, 
    echo=False, # Pon echo=True para ver las consultas SQL generadas en la terminal
    # connect_args={"check_same_thread": False} # Descomentar SOLO si usas SQLite en una app multihilo (ej. FastAPI/Flask)
)

# 3. Crear la fábrica de Sesiones
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Base declarativa para crear los modelos
Base = declarative_base()

def get_db():
    """Generador para obtener una sesión de base de datos."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## 🏗️ 3. Creación de Tablas (Modelos)

Las tablas se definen como clases de Python que heredan de `Base`.

**Archivo sugerido: `database/models.py`**

```python
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from .database import Base, engine

class RegistroOperacion(Base):
    __tablename__ = "registros_operacion"

    id = Column(Integer, primary_key=True, index=True)
    nombre_operador = Column(String(50), nullable=False)
    tipo_operacion = Column(String(50), nullable=False)
    valor = Column(Float, nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

# Comando para crear todas las tablas en la base de datos (si no existen)
def init_db():
    Base.metadata.create_all(bind=engine)
    print("Tablas creadas correctamente.")
```

## 🔄 4. Operaciones Básicas (CRUD)

Ejemplo de cómo insertar, leer, actualizar y borrar datos usando la sesión.

**Archivo sugerido: `database/crud.py`**

```python
from sqlalchemy.orm import Session
from .models import RegistroOperacion

# --- CREATE (Crear) ---
def crear_registro(db: Session, operador: str, tipo: str, valor: float = None):
    nuevo_registro = RegistroOperacion(
        nombre_operador=operador,
        tipo_operacion=tipo,
        valor=valor
    )
    db.add(nuevo_registro)
    db.commit()          # Guardar en la BD
    db.refresh(nuevo_registro) # Obtener el ID generado
    return nuevo_registro

# --- READ (Leer) ---
def obtener_registros(db: Session, limit: int = 100):
    return db.query(RegistroOperacion).limit(limit).all()

def obtener_registro_por_id(db: Session, registro_id: int):
    return db.query(RegistroOperacion).filter(RegistroOperacion.id == registro_id).first()

# --- UPDATE (Actualizar) ---
def actualizar_valor_registro(db: Session, registro_id: int, nuevo_valor: float):
    registro = obtener_registro_por_id(db, registro_id)
    if registro:
        registro.valor = nuevo_valor
        db.commit()
        db.refresh(registro)
    return registro

# --- DELETE (Borrar) ---
def eliminar_registro(db: Session, registro_id: int):
    registro = obtener_registro_por_id(db, registro_id)
    if registro:
        db.delete(registro)
        db.commit()
        return True
    return False
```

## 🚀 5. Ejemplo de Integración

Cómo unir todo en el script principal de tu aplicación:

```python
from database.database import SessionLocal, init_db
from database.crud import crear_registro, obtener_registros

def main():
    # 1. Inicializar la base de datos (crear el archivo .db y las tablas si es SQLite)
    init_db()
    
    # 2. Abrir sesión
    db = SessionLocal()
    
    try:
        # 3. Insertar datos
        print("Guardando operación...")
        crear_registro(db, operador="Juan", tipo="Inspeccion_Camara", valor=98.5)
        
        # 4. Leer datos
        registros = obtener_registros(db)
        print("Registros actuales en la BD:")
        for r in registros:
            print(f"- [{r.id}] {r.fecha_creacion} | {r.nombre_operador}: {r.tipo_operacion} ({r.valor})")
            
    finally:
        # 5. Cerrar siempre la sesión
        db.close()

if __name__ == "__main__":
    main()
```

## 📝 Buenas Prácticas

1. **Gestión de Sesiones**: Nunca dejes sesiones abiertas. Usa bloques `try...finally` o `context managers` (`with`) para asegurar que `db.close()` siempre se ejecuta.
2. **Migraciones (Avanzado)**: Si el proyecto crece y necesitas modificar columnas sin perder datos, implementa la librería **Alembic** asociada a SQLAlchemy.
3. **Variables de Entorno**: No dejes credenciales en duro en el código. Si usas PostgreSQL o MySQL, guarda la `DATABASE_URL` en un archivo `.env` y cárgala con la librería `python-dotenv`.
