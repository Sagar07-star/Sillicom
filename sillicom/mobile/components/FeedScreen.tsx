import { useNetworkState } from 'expo-network';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Kind, TOPICS, Topic } from '../api/types';
import { useFeed, queryClient, persistFeedPage } from '../api/client';
import { InfiniteData } from '@tanstack/react-query';
import { Feed } from '../api/types';
import { useLiveFeed } from '../api/useLiveFeed';
import { useRef } from 'react';
import { useTheme } from '../theme';
import { usePreferences } from '../store/preferences';
import { Button, Chip, EmptyState, Label } from './UI';
import { Skeleton } from './Skeleton';
import { ItemCard } from './ItemCard';
import { SwipeDeck } from './SwipeDeck';
export function FeedScreen({ kind, title }: { kind: Kind; title: string }) {
  const { colors } = useTheme(); const topics = usePreferences((s) => s.topics);
  const [search, setSearch] = useState(''), [q, setQ] = useState(''), [tag, setTag] = useState<Topic | ''>('');
  useEffect(() => { const timer = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const feed = useFeed(kind, q, tag); const items = feed.data?.pages.flatMap((p) => p.items) || [];
  const network = useNetworkState();
  const scroll = useRef<ScrollView>(null);
  const live = useLiveFeed(kind, q, tag, feed.data?.pages[0]?.as_of);
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(timer); }, []);
  const newCount = live.pending.filter(item => !items.some(existing => existing.id === item.id)).length;
  const applyNew = () => {
    const incoming = live.takePending();
    queryClient.setQueryData<InfiniteData<Feed & { offline: boolean }, number>>(['feed', kind, q, tag], previous => {
      if (!previous?.pages.length) return previous;
      const ids = new Set(previous.pages.flatMap(page => page.items.map(item => item.id)));
      const additions = incoming.filter(item => !ids.has(item.id));
      return { ...previous, pages: previous.pages.map((page, index) => index === 0 ? { ...page, items: [...additions, ...page.items], total: page.total + additions.length } : { ...page, offset: page.offset + additions.length, total: page.total + additions.length }) };
    });
    const first = queryClient.getQueryData<InfiniteData<Feed & { offline: boolean }, number>>(['feed', kind, q, tag])?.pages[0];
    if (first) void persistFeedPage(kind, q, tag, first).catch(() => undefined);
    scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const refresh = useCallback(() => { void feed.refetch(); }, [feed.refetch]);
  const more = useCallback(() => { if (feed.hasNextPage && !feed.isFetchingNextPage && !feed.isFetchNextPageError) void feed.fetchNextPage(); }, [feed.hasNextPage, feed.isFetchingNextPage, feed.isFetchNextPageError, feed.fetchNextPage]);
  const status = feed.isPending ? <Skeleton /> : feed.isError && !items.length ? <EmptyState title="Can’t reach server" detail={feed.error.message} retry={refresh} /> : !items.length ? <EmptyState title="Nothing here yet" detail="Try another topic, clear your search or refresh in a moment." retry={refresh} /> : null;
  return <View style={{ flex: 1, paddingHorizontal: 16, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><Label style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 28, lineHeight: 36 }}>{title}</Label><View style={{ flexDirection: 'row', gap: 6 }}><Button compact title="Saved" icon="bookmark-outline" onPress={() => router.push('/saved')} /><Button compact title="Settings" icon="options-outline" onPress={() => router.push('/settings')} /></View></View>
    <TextInput accessibilityLabel={`Search ${title}`} placeholder={`Search ${title.toLowerCase()}`} placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={{ minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.card, paddingHorizontal: 16, fontFamily: 'SpaceGrotesk_400Regular' }} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}><Chip title="All" selected={!tag} onPress={() => setTag('')} />{[...topics, ...TOPICS.filter((t) => !topics.includes(t))].map((t) => <Chip key={t} title={t} selected={tag === t} onPress={() => setTag(tag === t ? '' : t)} />)}</ScrollView>
    {live.lastUpdated && <Label muted>Last updated {Math.max(0, Math.floor((Date.now() - Date.parse(live.lastUpdated)) / 60000))} min ago</Label>}
    {kind === 'news' && newCount > 0 && <Button title={`${newCount} new stories`} onPress={applyNew} icon="arrow-up" />}
    {kind !== 'news' && newCount > 0 && <Button title={`${newCount} new items`} onPress={applyNew} />}
    {(network.isConnected === false || network.isInternetReachable === false || feed.data?.pages.some((p) => p.offline)) && <Label muted>Offline - showing saved items</Label>}
    {feed.isRefetchError && !!items.length && <Button title="Refresh failed · Retry" onPress={refresh} />}
    {kind === 'news' ? <ScrollView ref={scroll} contentContainerStyle={{ flexGrow: 1, flex: 1, paddingBottom: 12 }} refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={refresh} tintColor={colors.accentText} colors={[colors.accent]} />}>
      {status || <SwipeDeck items={items} refresh={refresh} more={more} />}
      {feed.isFetchNextPageError && <Button title="Retry loading more" onPress={() => { void feed.fetchNextPage(); }} />}
    </ScrollView> : <FlatList data={items} keyExtractor={(i) => String(i.id)} renderItem={({ item }) => <ItemCard item={item} />} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }} ListEmptyComponent={status} onEndReached={more} onEndReachedThreshold={0.5} refreshing={feed.isRefetching} onRefresh={refresh} ListFooterComponent={feed.isFetchingNextPage ? <Skeleton /> : feed.isFetchNextPageError ? <Button title="Retry loading more" onPress={() => { void feed.fetchNextPage(); }} /> : null} />}
  </View>;
}
