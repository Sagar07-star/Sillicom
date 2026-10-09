import argparse
import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import httpx
from sqlalchemy import delete, func, select, text
from .db import SessionLocal, now, begin_write
from .models import Device, Item, PushLog
log = logging.getLogger(__name__)
lock = asyncio.Lock()
API = "https://exp.host/--/api/v2/push/"
def headers():
    return {"Authorization":"Bearer "+os.environ["EXPO_ACCESS_TOKEN"]} if os.getenv("EXPO_ACCESS_TOKEN") else {}
def quiet(device, current):
    local = current.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(device.timezone))
    clock = local.strftime("%H:%M"); start,end = device.quiet_start,device.quiet_end
    return start<=clock<end if start<end else clock>=start or clock<end if start>end else False

def reserve(candidates):
    messages, logs = [], []
    with SessionLocal() as db:
        begin_write(db)
        for token,key,title,body,data in candidates:
            device = db.get(Device,token)
            if not device or not device.enabled or quiet(device,now()): continue
            local = now().replace(tzinfo=timezone.utc).astimezone(ZoneInfo(device.timezone))
            day = local.replace(hour=0,minute=0,second=0,microsecond=0).astimezone(timezone.utc).replace(tzinfo=None)
            if db.scalar(select(func.count()).select_from(PushLog).where(PushLog.token==token,PushLog.at>=day))>=3: continue
            if db.scalar(select(PushLog.id).where(PushLog.token==token,PushLog.event_key==key)): continue
            record = PushLog(token=token,event_key=key,at=now(),status="reserved");db.add(record);db.flush()
            logs.append(record.id);messages.append({"to":token,"title":title[:100],"body":body[:200],"data":data,"sound":"default"})
        db.commit()
    return messages,logs

async def deliver(candidates):
    async with lock:
        messages,ids = await asyncio.to_thread(reserve,candidates)
        async with httpx.AsyncClient(timeout=20,headers=headers()) as client:
            for offset in range(0,len(messages),100):
                chunk = messages[offset:offset+100]; keys = ids[offset:offset+100]
                # Do not retry an ambiguous POST timeout: a retry can duplicate a push.
                try:
                    response = await client.post(API+"send",json=chunk);response.raise_for_status()
                    tickets = response.json().get("data",[])
                    if isinstance(tickets,dict): tickets=[tickets]
                    if len(tickets)!=len(keys): raise ValueError("Unexpected Expo ticket count")
                    with SessionLocal() as db:
                        for id,ticket in zip(keys,tickets):
                            record=db.get(PushLog,id)
                            if ticket.get("details",{}).get("error")=="DeviceNotRegistered": db.execute(delete(Device).where(Device.token==record.token));continue
                            record.status=ticket.get("status","error");record.ticket=ticket.get("id")
                        db.commit()
                except Exception:
                    log.exception("Expo batch failed; reservation still counts toward daily limit")
                    with SessionLocal() as db:
                        for id in keys:
                            record=db.get(PushLog,id)
                            if record: record.status="unknown"
                        db.commit()
    return len(messages)

async def notify_new(items):
    with SessionLocal() as db: devices=list(db.scalars(select(Device).where(Device.enabled==True)))
    candidates=[]
    for d in devices:
        matches=[i for i in items if set(i.tags)&set(d.topics) and i.published_at>=now()-timedelta(days=1)]
        if not matches: continue
        item=matches[0]
        candidates.append((d.token,f"new:{item.id}","New on Sillicom",f"{item.title} · {item.source.name}",{"item_id":item.id,"type":item.type,"url":item.url}))
    await deliver(candidates)

async def receipts():
    with SessionLocal() as db:
        rows=list(db.scalars(select(PushLog).where(PushLog.status=="ok",PushLog.ticket!=None,PushLog.at<=now()-timedelta(minutes=15))))
    async with httpx.AsyncClient(timeout=20,headers=headers()) as client:
        for offset in range(0,len(rows),1000):
            batch=rows[offset:offset+1000]
            try:
                response=await client.post(API+"getReceipts",json={"ids":[r.ticket for r in batch]});response.raise_for_status();data=response.json().get("data",{})
                with SessionLocal() as db:
                    for r in batch:
                        receipt=data.get(r.ticket)
                        if not receipt:
                            if r.at<now()-timedelta(hours=23):
                                record=db.get(PushLog,r.id)
                                if record:record.status="expired"
                            continue
                        if receipt.get("details",{}).get("error")=="DeviceNotRegistered": db.execute(delete(Device).where(Device.token==r.token))
                        else:
                            record=db.get(PushLog,r.id)
                            if record: record.status="receipt:"+receipt.get("status","error")
                    db.commit()
            except Exception: log.exception("Receipt check failed; retry next cycle")

async def reminders():
    with SessionLocal() as db:
        devices=list(db.scalars(select(Device).where(Device.enabled==True)))
        items=list(db.scalars(select(Item).where(Item.type.in_(["event","hackathon"]))))
    candidates=[]
    for d in devices:
        local=now().replace(tzinfo=timezone.utc).astimezone(ZoneInfo(d.timezone))
        for i in items:
            deadline=i.deadline or i.starts_at
            if not deadline or deadline<=now() or i.type not in d.reminder_types or not set(i.tags)&set(d.topics):continue
            days=(deadline.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(d.timezone)).date()-local.date()).days
            if days not in (1,2):continue
            candidates.append((d.token,f"reminder:{i.id}:{days}:{deadline.isoformat()}",f"Deadline in {days} day{'s' if days>1 else ''}",f"{i.title} · {i.source.name}",{"item_id":i.id,"type":i.type,"url":i.url}))
    await deliver(candidates)

async def test_push(token):
    with SessionLocal() as db:
        if not db.get(Device,token):raise ValueError("Register this device using POST /devices first")
    count=await deliver([(token,"test:"+uuid.uuid4().hex,"Sillicom test","Your phone is connected to the live backend.",{"type":"test"})])
    print(f"Reserved {count} push(es). Quiet hours and the three-per-day limit still apply. Check backend logs/receipts for delivery.")
if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--test-token",required=True);args=parser.parse_args()
    asyncio.run(test_push(args.test_token))
