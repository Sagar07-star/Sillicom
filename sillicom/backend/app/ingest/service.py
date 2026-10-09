import asyncio
import logging
from datetime import timedelta
from dataclasses import asdict
from rapidfuzz.fuzz import ratio
from sqlalchemy import delete, select, text
from ..db import SessionLocal, now, begin_write
from ..models import Item, ItemSequence, Source, SourceRun
from ..processing import auto_tags, canonicalize, clean, why_it_matters
from ..broadcast import broadcaster
from .connectors import CONNECTORS
from .http import Fetcher, RateLimited
log = logging.getLogger(__name__)
write_lock = asyncio.Lock()

def initialize_sources(configs):
    with SessionLocal() as db:
        for source in db.scalars(select(Source)): source.enabled = False
        for c in configs:
            source = db.scalar(select(Source).where(Source.config_id == c.id)) or db.scalar(select(Source).where(Source.url == c.url))
            if not source: source = Source(name=c.name,type=c.type,url=c.url); db.add(source)
            source.config_id, source.name, source.type, source.url, source.enabled = c.id,c.name,c.type,c.url,c.enabled
        db.commit()

def persist(config, rows, http):
    inserted = []
    with SessionLocal() as db:
        begin_write(db)
        source = db.scalar(select(Source).where(Source.config_id == config.id))
        sequence = db.get(ItemSequence,1)
        if not sequence:
            from sqlalchemy import func
            sequence = ItemSequence(id=1,next_id=db.scalar(select(func.coalesce(func.max(Item.id),0)))+1);db.add(sequence)
        cutoff = now()-timedelta(days=3)
        recent = list(db.scalars(select(Item).where(Item.type==config.type,Item.ingested_at>=cutoff)))
        known_urls = set(db.scalars(select(Item.url)))
        for raw in rows:
            try:
                data = asdict(raw); data["url"] = canonicalize(raw.url); data["title"] = clean(raw.title,500)
                if not data["title"] or data["url"] in known_urls: continue
                if any(ratio(data["title"].casefold(), i.title.casefold())>88 for i in recent): continue
                published = raw.published_at or now()
                if config.type in ("news","update") and published < now()-timedelta(days=14 if config.type=="news" else 30): continue
                if config.type in ("event","hackathon") and ((raw.ends_at and raw.ends_at<=now()) or (raw.deadline and raw.deadline<=now())): continue
                data["published_at"] = published; data["summary"] = clean(raw.summary) or "Read the original source for details."
                if raw.image_url:
                    from urllib.parse import urljoin
                    try: data["image_url"] = canonicalize(urljoin(raw.url,raw.image_url))
                    except ValueError: data["image_url"] = None
                tags = auto_tags(data["title"]+" "+data["summary"],config.tags_hint)
                item = Item(id=sequence.next_id, **data, source=source, source_id=source.id, type=config.type, ingested_at=now(), pinned=False, tags=tags, why_it_matters=why_it_matters(tags))
                sequence.next_id += 1
                db.add(item); recent.append(item); known_urls.add(item.url); inserted.append(item)
            except (ValueError, TypeError): log.exception("Skipping malformed item from %s",config.id)
        source.last_success_at, source.last_error, source.consecutive_failures = now(),None,0
        db.add(SourceRun(source_id=source.id,at=now(),added=len(inserted)))
        http.commit(db); db.commit()
    return inserted

def failure(config, message):
    with SessionLocal() as db:
        source = db.scalar(select(Source).where(Source.config_id==config.id))
        source.consecutive_failures += 1; source.last_error = message[:500]; db.commit()
        return min(4,2**min(source.consecutive_failures,2))

async def poll(config, client):
    http = Fetcher(config.id,client)
    try:
        rows = await CONNECTORS[config.kind](http).fetch(config)
        async with write_lock: inserted = await asyncio.to_thread(persist, config, rows, http)
    except Exception as exc:
        log.exception("Source failed: %s",config.id)
        async with write_lock: multiplier = await asyncio.to_thread(failure,config,str(exc))
        return {"source":config.name,"fetched":0,"new":0,"status":"failed", "multiplier":multiplier,"retry_at":exc.until if isinstance(exc,RateLimited) else None}
    if inserted:
        await broadcaster.publish({"type":config.type,"count":len(inserted),"latest_ids":[i.id for i in inserted[:20]]})
        try:
            from ..push import notify_new
            await notify_new(inserted)
        except Exception: log.exception("Push delivery failed; feed remains available")
    return {"source":config.name,"fetched":len(rows),"new":len(inserted),"status":"ok", "multiplier":1,"retry_at":None}

def retention():
    with SessionLocal() as db:
        begin_write(db)
        db.execute(delete(Item).where(Item.pinned==False, ((Item.type=="news") & (Item.published_at<now()-timedelta(days=14))) | ((Item.type=="update") & (Item.published_at<now()-timedelta(days=30))) | ((Item.type.in_(["event","hackathon"])) & ((Item.ends_at<=now()) | (Item.deadline<=now())))))
        db.execute(delete(SourceRun).where(SourceRun.at<now()-timedelta(days=30)))
        db.commit()
