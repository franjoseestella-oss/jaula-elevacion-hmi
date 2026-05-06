import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from database.database import engine, Base
from database.models import LogTabla

def recreate_table():
    print("Dropping LOG_TABLA...")
    LogTabla.__table__.drop(engine, checkfirst=True)
    print("Creating LOG_TABLA with new schema...")
    LogTabla.__table__.create(engine, checkfirst=True)
    print("Done.")

if __name__ == "__main__":
    recreate_table()
