import { useEffect, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Item, timeAgo } from '../api/types';
import { usePreferences } from '../store/preferences';
import { useTheme } from '../theme';
import { Button, Card, EmptyState, Label } from './UI';
type Action = 'next' | 'save' | 'skip';
export function SwipeDeck({ items, refresh, more }: { items: Item[]; refresh: () => void; more: () => void }) {
  const { colors } = useTheme(); const [index, setIndex] = useState(0);
  const x = useSharedValue(0), y = useSharedValue(0), busy = useSharedValue(false);
  const saved = usePreferences((s) => s.saved), toggleSave = usePreferences((s) => s.toggleSave);
  useEffect(() => { setIndex(0); x.value = 0; y.value = 0; busy.value = false; }, [items[0]?.id, x, y, busy]);
  useEffect(() => { if (index >= items.length - 3) more(); }, [index, items.length, more]);
  const current = items[index];
  const finish = (action: Action) => {
    if (action === 'save' && current && !saved.some((i) => i.id === current.id)) toggleSave(current);
    setIndex((i) => i + 1); x.value = 0; y.value = 0; busy.value = false;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };
  const animate = (action: Action) => {
    'worklet';
    if (busy.value) return; busy.value = true;
    if (action === 'next') y.value = withSpring(-1000, { damping: 24 }, (done) => { if (done) runOnJS(finish)(action); });
    else x.value = withSpring(action === 'save' ? 700 : -700, { damping: 24 }, (done) => { if (done) runOnJS(finish)(action); });
  };
  const gesture = Gesture.Pan().onUpdate((e) => { if (!busy.value) { x.value = e.translationX; y.value = e.translationY; } }).onEnd((e) => {
    if (busy.value) return;
    if (e.translationY < -90 && Math.abs(e.translationY) > Math.abs(e.translationX)) animate('next');
    else if (e.translationX > 90) animate('save');
    else if (e.translationX < -90) animate('skip');
    else { x.value = withSpring(0); y.value = withSpring(0); }
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${x.value / 30}deg` }] }));
  if (!current) return <EmptyState title="You're all caught up" detail="Take a breather, or pull down for a fresh batch." retry={refresh} />;
  return <View style={{ flex: 1, gap: 8 }}><GestureDetector gesture={gesture}><Animated.View style={[{ flex: 1 }, style]}><Card style={{ flex: 1 }}>
    <Label muted>{current.tags[0]} · {timeAgo(current.published_at)}</Label><Label style={{ color: colors.accentText }}>{current.source.name}</Label>
    <ScrollView><Label style={styles.headline}>{current.title}</Label><Label style={{ marginTop: 18 }}>{current.summary}</Label><View style={{ marginTop: 22, borderLeftWidth: 3, borderColor: colors.highlight, paddingLeft: 12 }}><Label style={styles.bold}>Why it matters</Label><Label muted>{current.why_it_matters}</Label></View></ScrollView>
    <Button title="Read at source" icon="open-outline" onPress={() => { void Linking.openURL(current.url).catch(() => undefined); }} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}><Button title="Skip" icon="close" onPress={() => animate('skip')} /><Button title="Save" icon={saved.some((i) => i.id === current.id) ? 'bookmark' : 'bookmark-outline'} onPress={() => animate('save')} /><Button title="Share" icon="share-outline" onPress={() => { void Share.share({ message: `${current.title} ${current.url}` }).catch(() => undefined); }} /></View>
  </Card></Animated.View></GestureDetector><Label muted style={{ textAlign: 'center', fontSize: 12 }}>Up: next · Right: save · Left: skip</Label></View>;
}
const styles = StyleSheet.create({ headline: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 29, lineHeight: 36 }, bold: { fontFamily: 'SpaceGrotesk_600SemiBold' } });
