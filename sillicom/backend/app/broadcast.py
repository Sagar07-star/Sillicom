import asyncio
from contextlib import asynccontextmanager
class Broadcaster:
    def __init__(self): self.clients = set()
    @asynccontextmanager
    async def subscribe(self):
        queue = asyncio.Queue(maxsize=32); self.clients.add(queue)
        try: yield queue
        finally: self.clients.discard(queue)
    async def publish(self, event):
        for queue in tuple(self.clients):
            if queue.full(): queue.get_nowait()
            queue.put_nowait(event)
broadcaster = Broadcaster()
