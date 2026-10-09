from pathlib import Path
from typing import Literal
import yaml
from pydantic import BaseModel, Field, field_validator
from .processing import TOPICS
APP_DIR = Path(__file__).resolve().parent

class SourceConfig(BaseModel):
    id: str
    name: str
    type: Literal["news", "update", "event", "hackathon"]
    kind: Literal["rss", "atom", "hn_api", "devto_api", "github_releases", "npm", "pypi", "json_file", "ics", "manual", "devpost"]
    url: str
    interval_minutes: int = Field(ge=1)
    enabled: bool
    tags_hint: list[str] = []
    @field_validator("tags_hint")
    @classmethod
    def topics(cls, values):
        if set(values) - set(TOPICS): raise ValueError("Unknown topic")
        return values

def load_sources():
    rows = yaml.safe_load((APP_DIR / "sources.yaml").read_text(encoding="utf-8"))
    sources = [SourceConfig.model_validate(row) for row in rows]
    if len({s.id for s in sources}) != len(sources): raise ValueError("Duplicate source id")
    if len({s.url for s in sources}) != len(sources): raise ValueError("Duplicate source URL")
    return sources
