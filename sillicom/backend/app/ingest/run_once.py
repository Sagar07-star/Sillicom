import asyncio
from ..config import load_sources
from ..db import initialize_db
from .service import initialize_sources
from .runner import Runner
async def main():
    initialize_db();sources=load_sources();initialize_sources(sources);runner=Runner(sources)
    try:
        results=await asyncio.gather(*(runner.one(c) for c in runner.configs))
        print(f"{'Source':36} {'Fetched':>7} {'New':>6} Status")
        for r in results:print(f"{r['source'][:36]:36} {r['fetched']:7} {r['new']:6} {r['status']}")
    finally:await runner.client.aclose()
if __name__=="__main__":asyncio.run(main())
