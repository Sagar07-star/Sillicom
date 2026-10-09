import asyncio
import hashlib
import os
import random
import time
from datetime import timedelta
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser
import httpx
from sqlalchemy import select
from ..db import SessionLocal, now
from ..models import HttpCache

class RateLimited(Exception):
    def __init__(self, seconds):
        self.until = now() + timedelta(seconds=seconds)
        super().__init__("Source rate limit; retry deferred")
locks, next_request = {}, {}
class Fetcher:
    def __init__(self, source_id, client):
        self.source_id, self.client, self.pending = source_id, client, {}
    async def get(self, url, conditional=True):
        host = urlsplit(url).hostname
        async with locks.setdefault(host, asyncio.Lock()):
            await asyncio.sleep(max(0, next_request.get(host, 0)-time.monotonic()))
            next_request[host] = time.monotonic() + 0.5
        key = hashlib.sha256((self.source_id+"|"+url).encode()).hexdigest()
        headers = {"User-Agent": f"SillicomBot/1.0 (+{os.getenv('BOT_CONTACT','contact@example.com')})"}
        if host == "api.github.com" and os.getenv("GITHUB_TOKEN"): headers["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
        if conditional:
            with SessionLocal() as db:
                cached = db.get(HttpCache, key)
                if cached and cached.etag: headers["If-None-Match"] = cached.etag
                if cached and cached.modified: headers["If-Modified-Since"] = cached.modified
        for attempt in range(3):
            try:
                response = await self.client.get(url, headers=headers)
                if response.status_code == 304: return None
                limited = response.status_code == 429 or response.status_code == 403 and response.headers.get("x-ratelimit-remaining") == "0"
                if limited:
                    delay = response.headers.get("retry-after")
                    try: seconds = float(delay) if delay else max(60, float(response.headers.get("x-ratelimit-reset", time.time()+60))-time.time())
                    except ValueError:
                        from ..processing import utc
                        seconds = max(1, (utc(delay)-now()).total_seconds())
                    raise RateLimited(max(1, seconds))
                response.raise_for_status()
                if "text/html" in response.headers.get("content-type", "").lower(): raise ValueError("HTML scraping is not supported")
                if conditional: self.pending[key] = (response.headers.get("etag"), response.headers.get("last-modified"))
                return response
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code < 500: raise
                if attempt == 2: raise
                await asyncio.sleep(2**attempt + random.random())
    async def json(self, url):
        response = await self.get(url)
        return None if response is None else response.json()
    async def robots_allowed(self, url):
        p = urlsplit(url)
        response = await self.get(f"{p.scheme}://{p.netloc}/robots.txt", conditional=False)
        parser = RobotFileParser(); parser.parse(response.text.splitlines())
        if not parser.can_fetch("SillicomBot", url): raise PermissionError("robots.txt disallows this endpoint")
    def commit(self, db):
        for key,(etag,modified) in self.pending.items(): db.merge(HttpCache(key=key, etag=etag, modified=modified))
