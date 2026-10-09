import asyncio
import logging
import random
from datetime import timedelta
import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from ..db import now
from .service import poll, retention
from ..push import receipts, reminders
log=logging.getLogger(__name__)
class Runner:
    def __init__(self,configs):
        self.configs=[c for c in configs if c.enabled];self.scheduler=AsyncIOScheduler(timezone="UTC")
        self.client=httpx.AsyncClient(timeout=httpx.Timeout(20,connect=10),follow_redirects=True)
        self.slots=asyncio.Semaphore(4);self.tasks=set()
    async def one(self,config):
        async with self.slots: result=await poll(config,self.client)
        job=self.scheduler.get_job(config.id)
        if job:
            delay=config.interval_minutes*result["multiplier"]
            self.scheduler.modify_job(config.id,trigger=IntervalTrigger(minutes=delay,jitter=15),next_run_time=max(now()+timedelta(minutes=delay,seconds=random.randint(1,15)),result["retry_at"] or now()))
        return result
    async def maintenance(self):
        try:
            await receipts();await reminders()
        except Exception:log.exception("Maintenance failed; retry next cycle")
    async def startup(self,config):
        await asyncio.sleep(random.uniform(0,5));return await self.one(config)
    def start(self):
        for c in self.configs:
            self.scheduler.add_job(self.one,"interval",minutes=c.interval_minutes,jitter=15,args=[c],id=c.id,max_instances=1,coalesce=True)
            task=asyncio.create_task(self.startup(c));self.tasks.add(task);task.add_done_callback(self.tasks.discard)
        # Daily reminder keys prevent duplicates; periodic retries can leave quiet hours.
        self.scheduler.add_job(self.maintenance,"interval",minutes=5,id="maintenance",max_instances=1,coalesce=True)
        self.scheduler.add_job(retention,"cron",hour=2,id="retention",max_instances=1,coalesce=True)
        self.scheduler.add_job(reminders,"cron",hour=9,id="daily-reminders",max_instances=1,coalesce=True)
        self.scheduler.start()
    async def close(self):
        self.scheduler.shutdown(wait=False)
        for task in tuple(self.tasks):task.cancel()
        await asyncio.gather(*self.tasks,return_exceptions=True);await self.client.aclose()
