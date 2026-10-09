from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator
from .processing import TOPICS
ItemType = Literal["news", "update", "event", "hackathon"]
class UTCModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    @field_serializer("*", check_fields=False)
    def serialize(self, value):
        return value.isoformat()+"Z" if isinstance(value, datetime) else value
class SourceOut(UTCModel):
    id: int
    name: str
    type: str
    url: str
class ItemOut(UTCModel):
    id: int
    source_id: int
    source: SourceOut
    type: ItemType
    title: str
    url: str
    summary: str
    why_it_matters: str
    tags: list[str]
    published_at: datetime
    ingested_at: datetime
    image_url: str | None
    starts_at: datetime | None
    ends_at: datetime | None
    location: str | None
    deadline: datetime | None
    mode: str | None
    team_size: str | None
class FeedOut(UTCModel):
    items: list[ItemOut]
    total: int
    limit: int
    offset: int
    as_of: datetime
class SourceHealth(UTCModel):
    id: str
    name: str
    enabled: bool
    last_success_at: datetime | None
    last_error: str | None
    consecutive_failures: int
    items_added_last_24h: int
class DeviceIn(BaseModel):
    token: str = Field(pattern=r"^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$", max_length=250)
    topics: list[str] = Field(default_factory=list, max_length=8)
    enabled: bool = True
    quiet_start: str = Field(default="22:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    quiet_end: str = Field(default="08:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    timezone: str = "Asia/Kolkata"
    reminder_types: list[Literal["event", "hackathon"]] = Field(default_factory=lambda: ["event", "hackathon"])
    @field_validator("topics")
    @classmethod
    def topics_valid(cls, values):
        if set(values)-set(TOPICS): raise ValueError("Unknown topic")
        return list(dict.fromkeys(values))
    @field_validator("timezone")
    @classmethod
    def timezone_valid(cls, value):
        try: ZoneInfo(value)
        except Exception as exc: raise ValueError("Invalid timezone") from exc
        return value
