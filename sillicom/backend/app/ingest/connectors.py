import asyncio
import json
import re
from datetime import datetime, timezone
from typing import Protocol
from urllib.parse import quote
import feedparser
from icalendar import Calendar
from ..config import APP_DIR
from ..db import now
from ..processing import clean, utc
from .types import RawItem

class Connector(Protocol):
    async def fetch(self, source): raise NotImplementedError
class BaseConnector:
    def __init__(self, http): self.http = http
class RSSConnector(BaseConnector):
    @staticmethod
    def parse(content):
        feed = feedparser.parse(content)
        if feed.bozo and not feed.entries: raise ValueError("Invalid RSS/Atom")
        result = []
        for entry in feed.entries[:80]:
            if not entry.get("title") or not entry.get("link"): continue
            date = entry.get("published") or entry.get("updated")
            image = next((m.get("url") for m in entry.get("media_content", []) if m.get("url")), None)
            if not image: image = next((m.get("href") for m in entry.get("enclosures", []) if m.get("type", "").startswith("image/")), None)
            result.append(RawItem(title=clean(entry.title,500), url=entry.link, summary=clean(entry.get("summary", "")), published_at=utc(date) if date else now(), image_url=image))
        return result
    async def fetch(self, source):
        response = await self.http.get(source.url)
        return [] if response is None else self.parse(response.content)
class AtomConnector(RSSConnector): pass
class PyPIConnector(RSSConnector): pass
class HNConnector(BaseConnector):
    async def fetch(self, source):
        ids = await self.http.json(source.url)
        if ids is None: return []
        result = []
        for id in ids[:80]:
            item = await self.http.json(f"https://hacker-news.firebaseio.com/v0/item/{id}.json")
            if not item or item.get("deleted") or item.get("dead") or item.get("type") != "story": continue
            result.append(RawItem(title=item["title"], url=item.get("url") or f"https://news.ycombinator.com/item?id={id}", published_at=utc(datetime.fromtimestamp(item["time"], timezone.utc))))
        return result
class DevToConnector(BaseConnector):
    async def fetch(self, source):
        rows = await self.http.json(source.url)
        return [RawItem(title=r["title"],url=r["url"],summary=clean(r.get("description","")),published_at=utc(r.get("published_at")),image_url=r.get("cover_image")) for r in rows or []]
class GitHubConnector(BaseConnector):
    async def fetch(self, source):
        rows = await self.http.json(source.url)
        return [RawItem(title=r.get("name") or r["tag_name"],url=r["html_url"],summary=clean(r.get("body", "")),published_at=utc(r.get("published_at"))) for r in rows or [] if not r.get("draft")]
class NpmConnector(BaseConnector):
    async def fetch(self, source):
        data = await self.http.json(source.url)
        if data is None: return []
        version = data.get("dist-tags", {}).get("latest") or data.get("version")
        if not version: raise ValueError("npm registry has no latest release")
        name = data["name"]
        return [RawItem(title=f"{name} {version}",url=f"https://www.npmjs.com/package/{quote(name,safe='@/')}/v/{version}",summary=clean(data.get("description", "")),published_at=utc(data.get("time", {}).get(version)) or now())]
class JsonConnector(BaseConnector):
    async def fetch(self, source):
        rows = await self.http.json(source.url.replace("{year}",str(now().year)))
        if rows is None: return []
        if isinstance(rows,dict): rows = rows.get("events", rows.get("items", []))
        return self.normalize(rows, source)
    @staticmethod
    def normalize(rows, source):
        result = []
        for r in rows:
            if r.get("cancelled"): continue
            start = utc(r.get("starts_at") or r.get("startDate"))
            end = utc(r.get("ends_at") or r.get("endDate"), end=True)
            deadline = utc(r.get("deadline") or r.get("cfpEndDate"), end=True)
            result.append(RawItem(title=r.get("title") or r["name"],url=r["url"],summary=clean(r.get("summary") or r.get("description") or "See the organiser for programme and registration details."),published_at=utc(r.get("published_at")) or now(),starts_at=start,ends_at=end,deadline=deadline,location=r.get("location") or ", ".join(filter(None,[r.get("city"),r.get("country")])) or "Online",mode=r.get("mode"),team_size=r.get("team_size"),image_url=r.get("image_url")))
        return result
class ManualConnector(JsonConnector):
    async def fetch(self, source):
        path = (APP_DIR/source.url).resolve()
        if not path.is_relative_to(APP_DIR/"seed"): raise ValueError("Manual file must be inside app/seed")
        rows = json.loads(path.read_text(encoding="utf-8"))
        return self.normalize(rows, source)
class ICSConnector(BaseConnector):
    async def fetch(self, source):
        response = await self.http.get(source.url)
        if response is None: return []
        result = []
        for row in Calendar.from_ical(response.content).walk("VEVENT"):
            if not row.get("URL") or not row.get("SUMMARY"): continue
            result.append(RawItem(title=str(row["SUMMARY"]),url=str(row["URL"]),summary=clean(str(row.get("DESCRIPTION",""))),starts_at=utc(row.decoded("DTSTART")),ends_at=utc(row.decoded("DTEND")) if row.get("DTEND") else None,published_at=utc(row.decoded("DTSTAMP")) if row.get("DTSTAMP") else now(),location=str(row.get("LOCATION","Online"))))
        return result
class DevpostConnector(BaseConnector):
    async def fetch(self, source):
        await self.http.robots_allowed(source.url)
        data = await self.http.json(source.url)
        result = []
        for row in (data or {}).get("hackathons", []):
            period = row.get("submission_period_dates", "")
            end = row.get("submission_end_date") or re.split(r"\s+[–-]\s+",period)[-1]
            if not end: continue
            deadline = utc(end) if row.get("submission_end_date") else utc(utc(end).date(),end=True)
            result.append(RawItem(title=row["title"],url=row["url"],deadline=deadline,ends_at=deadline,published_at=now(),summary="See the organiser for rules and submission details.",mode="Online" if row.get("displayed_location", {}).get("location") == "Online" else "See organiser",team_size="See organiser",image_url=row.get("thumbnail_url")))
        return result
CONNECTORS = {"rss":RSSConnector,"atom":AtomConnector,"hn_api":HNConnector,"devto_api":DevToConnector,"github_releases":GitHubConnector,"npm":NpmConnector,"pypi":PyPIConnector,"json_file":JsonConnector,"ics":ICSConnector,"manual":ManualConnector,"devpost":DevpostConnector}
