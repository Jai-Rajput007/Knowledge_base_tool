"""Standalone DB migration script — run once to apply schema changes to existing DB."""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.db.database import init_db, engine
from app.core.logging import logger
import sqlalchemy


def check_tables():
    inspector = sqlalchemy.inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables after migration: {tables}")
    for table in tables:
        cols = [c["name"] for c in inspector.get_columns(table)]
        print(f"  {table}: {cols}")


if __name__ == "__main__":
    print("Running DB migration...")
    init_db()
    print("Migration complete.")
    check_tables()
