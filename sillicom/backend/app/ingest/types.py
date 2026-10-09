from dataclasses import dataclass
from datetime import datetime
@dataclass
class RawItem:
    title: str
    url: str
    summary: str = ""
    published_at: datetime | None = None
    image_url: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    location: str | None = None
    deadline: datetime | None = None
    mode: str | None = None
    team_size: str | None = None
