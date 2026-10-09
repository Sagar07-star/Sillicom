import { useNotifications } from '../store/notifications';
import { enablePush } from '../api/push';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { usePreferences, ThemeMode } from '../store/preferences';
import { clearFeedCache } from '../api/client';
import { Button, Card, Chip, Label } from '../components/UI';
export default function Settings() {
  const notification = useNotifications();
  const theme = usePreferences((s) => s.theme), setTheme = usePreferences((s) => s.setTheme);
  const topics = usePreferences((s) => s.topics); const [busy, setBusy] = useState(false);
  return <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}><Card><Label style={{ fontSize: 22 }}>Make yourself at home</Label><Label muted>Choose your reading light.</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => <Chip key={mode} title={mode === 'system' ? 'Follow system' : mode === 'dark' ? 'Dark' : 'Light'} selected={theme === mode} onPress={() => setTheme(mode)} />)}</View></Card><Card><Label>Topics</Label><Label muted>{topics.join(' · ')}</Label><Button title="Manage topics" onPress={() => router.push('/onboarding')} /></Card><Card><Label>Notifications</Label><Label muted>{notification.status}</Label><Button title={notification.enabled ? 'Turn off notifications' : 'Enable notifications'} onPress={() => { if (notification.enabled) notification.set({ enabled: false }); else void enablePush(); }} /><Label muted>Topics follow your chosen topics. Quiet hours: 22:00–08:00 in your local timezone.</Label>{notification.token && <Label selectable muted>{notification.token}</Label>}</Card><Card><Label>Local cache</Label><Label muted>Remove downloaded feeds. Your bookmarks and preferences stay saved.</Label><Button title={busy ? 'Clearing…' : 'Clear cache'} disabled={busy} onPress={() => { setBusy(true); void clearFeedCache().then(() => Alert.alert('Cache cleared', 'Fresh feeds will download when you return to a tab.')).catch(() => Alert.alert('Cache', 'Could not clear the cache. Please retry.')).finally(() => setBusy(false)); }} /></Card><Label muted>Sillicom · quick reads for curious minds</Label></ScrollView>;
}
