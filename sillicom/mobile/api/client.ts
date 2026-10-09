import { useEffect } from 'react';
import { API_URL, requireApiUrl } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { Feed, Kind, Topic } from './types';
export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60000, retry: 1, gcTime: 86400000 } } });
const BASE = API_URL;
const PREFIX = 'sillicom-feed:';
let cacheEpoch = 0;
export async function clearFeedCache() {
  cacheEpoch += 1;
  await queryClient.cancelQueries();
  queryClient.clear();
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
  await AsyncStorage.multiRemove(keys);
}
export function useFeed(kind: Kind, q: string, tag: Topic | '') {
  const query = useInfiniteQuery({
    queryKey: ['feed', kind, q, tag], initialPageParam: 0,
    queryFn: async ({ pageParam, signal }): Promise<Feed & { offline: boolean }> => {
      const key = `${PREFIX}${BASE}:${kind}:${q}:${tag}:${pageParam}`; const epoch = cacheEpoch;
      const controller = new AbortController();
      const abort = () => controller.abort(); signal.addEventListener('abort', abort);
      const timeout = setTimeout(abort, 45000);
      try {
        const params = new URLSearchParams({ type: kind, q, tag, limit: '30', offset: String(pageParam) });
        if (!tag) params.delete('tag');
        const response = await fetch(`${requireApiUrl()}/feed?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const data = await response.json() as Feed;
        if (epoch === cacheEpoch && !signal.aborted) await AsyncStorage.setItem(key, JSON.stringify(data));
        return { ...data, offline: false };
      } catch (error) {
        if (signal.aborted) throw error;
        const cached = await AsyncStorage.getItem(key);
        if (cached) return { ...JSON.parse(cached) as Feed, offline: true };
        throw new Error(error instanceof Error && error.message.includes('server address') ? error.message : "Can’t reach the server. It may be waking up; please retry in a moment.");
      } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
    },
    getNextPageParam: (page) => page.offset + page.items.length < page.total ? page.offset + page.items.length : undefined,
  });
  useEffect(() => {
    let disposed = false;
    const key = `${PREFIX}${BASE}:${kind}:${q}:${tag}:0`;
    void AsyncStorage.getItem(key).then(cached => {
      if (!disposed && cached && !queryClient.getQueryData(['feed', kind, q, tag])) {
        queryClient.setQueryData(['feed', kind, q, tag], { pages: [{ ...JSON.parse(cached) as Feed, offline: true }], pageParams: [0] });
      }
    }).catch(() => undefined);
    return () => { disposed = true; };
  }, [kind, q, tag]);
  return query;
}

export async function persistFeedPage(kind: Kind, q: string, tag: Topic | '', page: Feed): Promise<void> {
  await AsyncStorage.setItem(`${PREFIX}${BASE}:${kind}:${q}:${tag}:${page.offset}`, JSON.stringify(page));
}
