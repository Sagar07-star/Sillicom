from datetime import datetime
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

class Source(Base):
    __tablename__ = "sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(20))
    url: Mapped[str] = mapped_column(String(2048), unique=True)
    config_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_error: Mapped[str | None] = mapped_column(Text)
    consecutive_failures: Mapped[int] = mapped_column(default=0)

class Item(Base):
    __tablename__ = "items"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"))
    source: Mapped[Source] = relationship(lazy="joined")
    type: Mapped[str] = mapped_column(String(20), index=True)
    title: Mapped[str] = mapped_column(String(500))
    url: Mapped[str] = mapped_column(String(2048), unique=True)
    summary: Mapped[str] = mapped_column(Text)
    why_it_matters: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JSON)
    published_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ingested_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    image_url: Mapped[str | None] = mapped_column(String(2048))
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime)
    location: Mapped[str | None] = mapped_column(String(200))
    deadline: Mapped[datetime | None] = mapped_column(DateTime)
    mode: Mapped[str | None] = mapped_column(String(50))
    team_size: Mapped[str | None] = mapped_column(String(50))

class HttpCache(Base):
    __tablename__ = "http_cache"
    key: Mapped[str] = mapped_column(String(4096), primary_key=True)
    etag: Mapped[str | None] = mapped_column(Text)
    modified: Mapped[str | None] = mapped_column(Text)

class SourceRun(Base):
    __tablename__ = "source_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"))
    at: Mapped[datetime] = mapped_column(DateTime, index=True)
    added: Mapped[int]

class Device(Base):
    __tablename__ = "devices"
    token: Mapped[str] = mapped_column(String(250), primary_key=True)
    topics: Mapped[list[str]] = mapped_column(JSON)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    quiet_start: Mapped[str] = mapped_column(String(5))
    quiet_end: Mapped[str] = mapped_column(String(5))
    timezone: Mapped[str] = mapped_column(String(100))
    reminder_types: Mapped[list[str]] = mapped_column(JSON)

class PushLog(Base):
    __tablename__ = "push_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(ForeignKey("devices.token", ondelete="CASCADE"), index=True)
    event_key: Mapped[str] = mapped_column(String(200))
    at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ticket: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30), default="reserved")

class ItemSequence(Base):
    __tablename__ = "item_sequence"
    id: Mapped[int] = mapped_column(primary_key=True)
    next_id: Mapped[int]
