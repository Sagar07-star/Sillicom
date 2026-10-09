import asyncio
from datetime import timedelta
import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, now
from app.models import Item, Source
from app.config import SourceConfig
from app.broadcast import Broadcaster
from app.processing import canonicalize,clean
from app.ingest.connectors import RSSConnector
from app.ingest.types import RawItem
from app.ingest.http import Fetcher
from app.ingest import service
@pytest.fixture
def database(tmp_path,monkeypatch):
    engine=create_engine("sqlite:///"+str(tmp_path/"test.db"));Base.metadata.create_all(engine)
    factory=sessionmaker(engine,expire_on_commit=False)
    monkeypatch.setattr(service,"SessionLocal",factory)
    from app.ingest import http
    monkeypatch.setattr(http,"SessionLocal",factory)
    yield factory
    engine.dispose()
def config():
    return SourceConfig(id="test",name="Test",type="news",kind="rss",url="https://example.org/feed",interval_minutes=5,enabled=True,tags_hint=["AI"])
def test_canonicalization():
    assert canonicalize("https://EXAMPLE.org:443/story/?utm_source=x&fbclid=y&b=2&a=1#top")=="https://example.org/story?a=1&b=2"
    assert canonicalize("https://example.org/?id=123")=="https://example.org/?id=123"
    assert clean("<script>bad</script><p>"+"text "*100+"</p>").__len__()<=200
def test_dedup(database):
    cfg=config();service.initialize_sources([cfg])
    http=type("Cache",(),{"commit":lambda self,db:None})()
    first=service.persist(cfg,[RawItem(title="A useful machine learning release",url="https://example.org/a",published_at=now())],http)
    assert len(first)==1
    assert service.persist(cfg,[RawItem(title="Different title",url="https://example.org/a?utm_source=x")],http)==[]
    assert service.persist(cfg,[RawItem(title="A useful machine learning release!",url="https://example.org/b")],http)==[]
    with database() as db:
        item=db.get(Item,first[0].id);item.ingested_at=now()-timedelta(days=4);db.commit()
    assert len(service.persist(cfg,[RawItem(title="A useful machine learning release!",url="https://example.org/b")],http))==1
def test_rss():
    content=b'<rss version="2.0"><channel><title>Test</title><item><title>Release</title><link>https://example.org/release</link><description>&lt;p&gt;A short update&lt;/p&gt;</description><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>'
    rows=RSSConnector.parse(content)
    assert len(rows)==1 and rows[0].summary=="A short update"
    assert rows[0].published_at.isoformat()=="2026-10-09T10:00:00"
def test_etag_304(database):
    async def run():
        seen=[]
        def handler(request):
            seen.append(request.headers.get("if-none-match"))
            return httpx.Response(304) if seen[-1]=='"abc"' else httpx.Response(200,headers={"etag":'"abc"'},json={"ok":True})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            first=Fetcher("test",client);assert await first.json("https://example.org/data")=={"ok":True}
            with database() as db:first.commit(db);db.commit()
            second=Fetcher("test",client);assert await second.json("https://example.org/data") is None
        assert seen==[None,'"abc"']
    asyncio.run(run())
def test_broadcaster():
    async def run():
        bus=Broadcaster()
        async with bus.subscribe() as queue:
            await bus.publish({"type":"news","count":2,"latest_ids":[1,2]})
            assert (await queue.get())["count"]==2
            for i in range(40):await bus.publish({"count":i})
            assert queue.qsize()==32
        assert not bus.clients
    asyncio.run(run())
