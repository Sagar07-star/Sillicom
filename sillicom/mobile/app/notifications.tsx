import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Label } from '../components/UI';
import { enablePush } from '../api/push';
import { useNotifications } from '../store/notifications';
export default function NotificationPermission() {
  const status = useNotifications(s => s.status);
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}><Card>
    <Label style={{ fontSize: 24 }}>A small heads-up</Label>
    <Label>Sillicom can notify you about your chosen topics and upcoming deadlines. At most three notifications a day, with quiet hours from 10 pm to 8 am.</Label>
    <Label muted>You can keep using the app if you skip or decline permission.</Label>
    <Button title="Enable notifications" onPress={() => { void enablePush(); }} />
    <Label muted>{status}</Label>
    <Button title="Continue" onPress={() => { useNotifications.getState().set({ prompted: true }); router.replace('/'); }} />
  </Card></ScrollView>;
}
