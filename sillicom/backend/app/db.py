import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from sqlalchemy import create_engine, event, inspect, text, func, select
from sqlalchemy.orm import DeclarativeBase, sessionmaker
load_dotenv()

class Base(DeclarativeBase):
    pass

url = os.getenv("DATABASE_URL", "sqlite:///./sillicom.db")
if url.startswith("postgres://"):
    url = "postgresql+psycopg://" + url[len("postgres://"):]
elif url.startswith("postgresql://"):
    url = "postgresql+psycopg://" + url[len("postgresql://"):]
is_sqlite = url.startswith("sqlite:")
engine = create_engine(url, pool_pre_ping=True,
    connect_args={"check_same_thread": False, "timeout": 30} if is_sqlite else {"connect_timeout": 15})
SessionLocal = sessionmaker(engine, expire_on_commit=False)

if is_sqlite:
    @event.listens_for(engine, "connect")
    def sqlite_settings(connection, record):
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=30000")

if not is_sqlite:
    @event.listens_for(engine, "connect")
    def postgres_settings(connection, record):
        connection.autocommit = True
        with connection.cursor() as cursor:
            cursor.execute("SET search_path TO sillicom")
        connection.autocommit = False

def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def get_db():
    with SessionLocal() as db:
        yield db

def begin_write(db):
    if db.get_bind().dialect.name == "sqlite":
        db.execute(text("BEGIN IMMEDIATE"))
    else:
        # Serialize quota reservations and item-ID allocation across processes.
        db.execute(text("SELECT pg_advisory_xact_lock(731991)"))

def initialize_db():
    from .models import Item, ItemSequence
    with engine.begin() as connection:
        if not is_sqlite:
            connection.execute(text("SELECT pg_advisory_xact_lock(731991)"))
            connection.execute(text("CREATE SCHEMA IF NOT EXISTS sillicom"))
        Base.metadata.create_all(connection)
        additions = {
            "sources": {"config_id": "VARCHAR(100)", "enabled": "BOOLEAN NOT NULL DEFAULT FALSE", "last_success_at": "TIMESTAMP", "last_error": "TEXT", "consecutive_failures": "INTEGER NOT NULL DEFAULT 0"},
            "items": {"image_url": "VARCHAR(2048)", "pinned": "BOOLEAN NOT NULL DEFAULT FALSE", "ingested_at": "TIMESTAMP"},
        }
        for table, columns in additions.items():
            existing = {c["name"] for c in inspect(connection).get_columns(table)}
            for column, definition in columns.items():
                if column not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
        connection.execute(text("UPDATE items SET ingested_at=:now WHERE ingested_at IS NULL"), {"now": now()})
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_sources_config ON sources(config_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_items_ingested ON items(ingested_at)"))
        connection.execute(text("DELETE FROM items WHERE pinned=FALSE AND source_id IN (SELECT id FROM sources WHERE url IN ('events.json','hackathons.json'))"))
    with SessionLocal() as db:
        begin_write(db)
        maximum = db.scalar(select(func.coalesce(func.max(Item.id), 0)))
        sequence = db.get(ItemSequence, 1)
        if not sequence:
            db.add(ItemSequence(id=1, next_id=maximum + 1))
        elif sequence.next_id <= maximum:
            sequence.next_id = maximum + 1
        db.commit()
