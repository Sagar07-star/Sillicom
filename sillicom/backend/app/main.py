import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
import portalocker
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, exists, func, select, text, cast
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session
from .broadcast import broadcaster
from .config import load_sources
from .db import engine, get_db, initialize_db, now
from .ingest.runner import Runner
from .ingest.service import initialize_sources
from .models import Device, Item, Source, SourceRun
from .processing import utc
from .schemas import DeviceIn, FeedOut, ItemOut, ItemType, SourceHealth, SourceOut
logging.basicConfig(level=logging.INFO)
@asynccontextmanager
async def lifespan(app):
    initialize_db();configs=load_sources();initialize_sources(configs)
    lock = None
    runner = None
    owner = None
    if os.getenv("INGEST_ENABLED", "true").lower() == "true":
        if engine.dialect.name == "postgresql":
            owner = engine.connect()
            acquired = owner.scalar(text("SELECT pg_try_advisory_lock(731992)"))
            owner.commit()
            if not acquired:
                owner.close(); owner = None
        else:
            lock = portalocker.Lock(str(engine.url.database or "sillicom") + ".scheduler.lock", timeout=0)
            try: lock.acquire()
            except portalocker.exceptions.LockException: lock = None
        if owner is not None or lock is not None:
            runner = Runner(configs); runner.start()
        else:
            logging.warning("Another process owns ingestion; use one server worker for SSE")
    try: yield
    finally:
        if runner: await runner.close()
        if lock: lock.release()
        if owner is not None:
            owner.execute(text("SELECT pg_advisory_unlock(731992)")); owner.commit(); owner.close()
app=FastAPI(title="Sillicom",lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=os.getenv("CORS_ORIGINS","*").split(","),allow_methods=["GET","POST","DELETE"],allow_headers=["*"],allow_credentials=False)
@app.get("/health")
def health(db:Session=Depends(get_db)):
    db.execute(text("SELECT 1")); return {"status":"ok"}
@app.get("/feed/stream")
async def stream(request:Request):
    async def events():
        async with broadcaster.subscribe() as queue:
            yield ": connected\n\n"
            while not await request.is_disconnected():
                try:
                    event=await asyncio.wait_for(queue.get(),25)
                    yield "event: feed\ndata: "+json.dumps(event)+"\n\n"
                except asyncio.TimeoutError:yield ": heartbeat\n\n"
    return StreamingResponse(events(),media_type="text/event-stream",headers={"Cache-Control":"no-cache, no-transform","X-Accel-Buffering":"no"})
@app.get("/feed",response_model=FeedOut)
def feed(type:ItemType="news",tag:str|None=None,q:str=Query("",max_length=200),since:datetime|None=None,limit:int=Query(30,ge=1,le=100),offset:int=Query(0,ge=0),db:Session=Depends(get_db)):
    snapshot=now();clauses=[Item.type==type,Item.ingested_at<=snapshot]
    if since:clauses.append(Item.ingested_at>utc(since))
    if tag:
        if db.get_bind().dialect.name == "postgresql":
            clauses.append(cast(Item.tags, JSONB).contains([tag]))
        else:
            tags=func.json_each(Item.tags).table_valued("value")
            clauses.append(exists(select(1).select_from(tags).where(tags.c.value==tag)))
    if q:
        esc=chr(92);value=q.replace(esc,esc*2).replace("%",esc+"%").replace("_",esc+"_")
        clauses.append(Item.title.ilike(f"%{value}%",escape=esc)|Item.summary.ilike(f"%{value}%",escape=esc))
    if type in ("event","hackathon"):
        clauses.extend([(Item.ends_at==None)|(Item.ends_at>snapshot),(Item.deadline==None)|(Item.deadline>snapshot)])
    total=db.scalar(select(func.count()).select_from(Item).where(*clauses))
    order=[Item.ingested_at,Item.id] if since else [Item.published_at.desc(),Item.id.desc()]
    items=db.scalars(select(Item).where(*clauses).order_by(*order).offset(offset).limit(limit)).all()
    return dict(items=items,total=total,limit=limit,offset=offset,as_of=snapshot)
@app.get("/items/{id}",response_model=ItemOut)
def item(id:int,db:Session=Depends(get_db)):
    result=db.get(Item,id)
    if not result:raise HTTPException(404,"Item not found")
    return result
@app.get("/sources",response_model=list[SourceOut])
def sources(db:Session=Depends(get_db)):
    return db.scalars(select(Source).where(Source.config_id!=None).order_by(Source.id)).all()
@app.get("/sources/health",response_model=list[SourceHealth])
def source_health(db:Session=Depends(get_db)):
    result=[]
    for source in db.scalars(select(Source).where(Source.config_id!=None)):
        count=db.scalar(select(func.coalesce(func.sum(SourceRun.added),0)).where(SourceRun.source_id==source.id,SourceRun.at>=now()-timedelta(days=1)))
        result.append(dict(id=source.config_id,name=source.name,enabled=source.enabled,last_success_at=source.last_success_at,last_error=source.last_error,consecutive_failures=source.consecutive_failures,items_added_last_24h=count))
    return result
@app.post("/devices",status_code=201)
def register(payload:DeviceIn,db:Session=Depends(get_db)):
    db.merge(Device(**payload.model_dump()));db.commit();return {"registered":True}
@app.delete("/devices/{token}",status_code=204)
def unregister(token:str,db:Session=Depends(get_db)):
    db.execute(delete(Device).where(Device.token==token));db.commit();return Response(status_code=204)
