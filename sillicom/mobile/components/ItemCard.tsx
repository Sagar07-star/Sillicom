import { Alert, Linking, Platform, View } from 'react-native';
import { Item, timeAgo } from '../api/types';
import { usePreferences } from '../store/preferences';
import { Button, Card, Label } from './UI';
import { CountdownRing } from './CountdownRing';
async function addCalendar(item: Item) {
  try {
    if (Platform.OS === 'web') throw new Error('Calendar is available on Android and iOS development builds.');
    // Lazy load: unsupported Expo Go can still render the rest of the app.
    const Calendar = await import('expo-calendar/legacy');
    if (!item.starts_at) throw new Error('This event has no start date.');
    const permission = await Calendar.requestCalendarPermissionsAsync();
    if (!permission.granted) throw new Error('Calendar permission was declined. You can still open the event link.');
    await Calendar.createEventInCalendarAsync({ title: item.title, startDate: new Date(item.starts_at), endDate: new Date(item.ends_at || Date.parse(item.starts_at) + 3600000), location: item.location || 'Online', notes: `${item.summary}\n${item.url}` });
  } catch (error) { Alert.alert('Calendar', error instanceof Error ? error.message : 'Could not open calendar.'); }
}
export function ItemCard({ item, remove = false }: { item: Item; remove?: boolean }) {
  const saved = usePreferences((s) => s.saved.some((i) => i.id === item.id));
  const toggle = usePreferences((s) => s.toggleSave);
  return <Card><Label muted>{item.source.name} · {item.tags.join(' / ')} · {timeAgo(item.published_at)}</Label><Label style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 20, lineHeight: 27 }}>{item.title}</Label><Label muted>{item.summary}</Label>
    {item.type === 'event' && <><Label>{item.starts_at ? new Date(item.starts_at).toLocaleString() : 'Date TBA'} · {item.location || 'Online'}</Label><Button title="Add to calendar" icon="calendar-outline" onPress={() => { void addCalendar(item); }} /></>}
    {item.type === 'hackathon' && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>{item.deadline && <CountdownRing deadline={item.deadline} published={item.published_at} />}<View style={{ flex: 1 }}><Label>{item.mode} · Team {item.team_size}</Label><Label muted>{item.deadline ? `Deadline: ${new Date(item.deadline).toLocaleDateString()}` : 'Deadline TBA'}</Label></View></View>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button title="Open link" icon="open-outline" onPress={() => { void Linking.openURL(item.url).catch(() => Alert.alert('Link', 'Could not open this link.')); }} /><Button title={remove ? 'Remove' : saved ? 'Unsave' : 'Save'} icon={saved ? 'bookmark' : 'bookmark-outline'} onPress={() => toggle(item)} /></View>
  </Card>;
}
