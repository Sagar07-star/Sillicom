import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import EventSource from 'react-native-sse';
import { requireApiUrl } from '../config/api';
import { Feed, Item, Kind, Topic } from './types';

export function useLiveFeed(kind: Kind, q: string, tag: Topic | '', asOf?: string) {
  const [pending, setPending] = useState<Item[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | undefined>(asOf);
  const cursor = useRef(asOf || new Date().toISOString());
  const handled = useRef(new Set<number>());
  useEffect(() => { if (asOf) { cursor.current = asOf; setLastUpdated(asOf); } }, [asOf]);
  useEffect(() => {
    setPending([]); handled.current.clear(); cursor.current = asOf || new Date().toISOString();
    let disposed = false, active = AppState.currentState === 'active', busy = false;
    let source: EventSource<'feed'> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let attempts = 0;
    async function collect() {
      if (disposed || !active || busy) return;
      busy = true; controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 45000);
      try {
        const gathered: Item[] = []; let offset = 0, watermark = cursor.current;
        while (!disposed && active) {
          const params = new URLSearchParams({ type: kind, q, since: cursor.current, limit: '100', offset: String(offset) });
          if (tag) params.set('tag', tag);
          const response = await fetch(`${requireApiUrl()}/feed?${params}`, { signal: controller.signal });
          if (!response.ok) throw new Error('Live fetch failed');
          const data = await response.json() as Feed;
          if (offset === 0 && data.as_of) watermark = data.as_of;
          gathered.push(...data.items); offset += data.items.length;
          if (!data.items.length || offset >= data.total) break;
        }
        if (!disposed && active) {
          const fresh = gathered.filter(item => !handled.current.has(item.id));
          fresh.forEach(item => handled.current.add(item.id));
          if (fresh.length) setPending(old => [...fresh, ...old]);
          cursor.current = watermark; setLastUpdated(new Date().toISOString());
        }
      } catch { /* Cached feed remains visible; the next poll retries. */ }
      finally { clearTimeout(timeout); busy = false; }
    }
    function connect() {
      if (disposed || !active) return;
      try {
        source = new EventSource<'feed'>(`${requireApiUrl()}/feed/stream`, { pollingInterval: 0, timeout: 90000 });
        source.addEventListener('open', () => { attempts = 0; void collect(); });
        source.addEventListener('feed', () => { void collect(); });
        source.addEventListener('error', () => {
          source?.close();
          if (!disposed && active && !retry) retry = setTimeout(() => { retry = undefined; connect(); }, Math.min(60000, 1000 * 2 ** Math.min(attempts++, 6)));
        });
      } catch { /* Polling also works when SSE cannot be opened. */ }
    }
    connect();
    const poll = setInterval(() => { void collect(); }, 60000);
    const lifecycle = AppState.addEventListener('change', state => {
      active = state === 'active';
      source?.close(); if (retry) { clearTimeout(retry); retry = undefined; }
      if (active) { connect(); void collect(); } else controller?.abort();
    });
    return () => { disposed = true; source?.close(); controller?.abort(); if (retry) clearTimeout(retry); clearInterval(poll); lifecycle.remove(); };
    // Changing the full-feed timestamp updates the cursor without reopening SSE.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, q, tag]);
  return { pending, lastUpdated, takePending: () => { const items = pending; setPending([]); return items; } };
}
