"""Script de inspección — muestra datos reales de DAFEED."""
from database.database import engine
from sqlalchemy import text

queries = {
    "Secuencia_Mastiles (5 filas)": "SELECT TOP 5 * FROM Secuencia_Mastiles",
    "REFERENCIAS_MASTILES (3 filas)": "SELECT TOP 3 * FROM REFERENCIAS_MASTILES",
}

with engine.connect() as conn:
    for title, sql in queries.items():
        print(f"\n=== {title} ===")
        rows = conn.execute(text(sql)).fetchall()
        for r in rows:
            print(dict(r._mapping))
