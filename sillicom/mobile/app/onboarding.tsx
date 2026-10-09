import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { TOPICS, Topic } from '../api/types';
import { usePreferences } from '../store/preferences';
import { Button, Chip, Label } from '../components/UI';
function Bubble({ topic, index, selected, onPress }: { topic: Topic; index: number; selected: boolean; onPress: () => void }) {
  const y = useSharedValue(0);
  useEffect(() => { y.value = withDelay(index * 110, withRepeat(withTiming(-7, { duration: 1400 + index * 100 }), -1, true)); }, [index, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ marginVertical: 12 }, style]}><Chip title={topic} selected={selected} onPress={onPress} /></Animated.View>;
}
export default function Onboarding() {
  const initial = usePreferences((s) => s.topics); const setTopics = usePreferences((s) => s.setTopics);
  const [selected, setSelected] = useState<Topic[]>(initial);
  return <SafeAreaView style={{ flex: 1 }}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 26, gap: 24 }}><Label style={{ fontSize: 18 }}>Sillicom</Label><Label style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 36, lineHeight: 44 }}>A little tech.
A little curiosity.</Label><Label muted>Pick at least three topics. Your favourites appear first in the feed filters.</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{TOPICS.map((topic, index) => <Bubble key={topic} topic={topic} index={index} selected={selected.includes(topic)} onPress={() => { setSelected((list) => list.includes(topic) ? list.filter((t) => t !== topic) : [...list, topic]); void Haptics.selectionAsync().catch(() => undefined); }} />)}</View><Label muted>{selected.length} selected · minimum 3</Label><Button title="Let's explore" disabled={selected.length < 3} onPress={() => { setTopics(selected); router.replace('/(tabs)'); }} /></ScrollView></SafeAreaView>;
}
