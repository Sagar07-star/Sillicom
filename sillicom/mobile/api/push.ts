import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { requireApiUrl } from '../config/api';
import { useNotifications } from '../store/notifications';
import { usePreferences } from '../store/preferences';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export async function enablePush(): Promise<void> {
  const set = useNotifications.getState().set;
  set({ prompted: true });
  try {
    if (!Device.isDevice || !Constants.expoConfig?.extra?.pushConfigured) {
      set({ enabled: false, status: 'Push is not configured for this build. You can still use every feed.' }); return;
    }
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Sillicom', importance: Notifications.AndroidImportance.DEFAULT });
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) { set({ enabled: false, status: 'Permission declined. Feeds and saved items still work.' }); return; }
    const projectId: unknown = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== 'string') { set({ enabled: false, status: 'This build needs an Expo project ID before push can work.' }); return; }
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    set({ token: result.data, enabled: true, status: 'Notifications enabled' });
  } catch { set({ enabled: false, status: 'Push is temporarily unavailable. Try enabling it again later.' }); }
}
export function usePushRegistration() {
  const enabled = useNotifications(s => s.enabled), token = useNotifications(s => s.token);
  const topics = usePreferences(s => s.topics);
  useEffect(() => {
    if (!token) return;
    let disposed = false;
    async function sync() {
      if (disposed || AppState.currentState !== 'active') return;
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        const response = enabled ? await fetch(`${requireApiUrl()}/devices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, topics, enabled, timezone, quiet_start: '22:00', quiet_end: '08:00', reminder_types: ['event', 'hackathon'] }), signal: controller.signal }) : await fetch(`${requireApiUrl()}/devices/${encodeURIComponent(token as string)}`, { method: 'DELETE', signal: controller.signal });
        if (!response.ok) throw new Error('Registration failed');
        if (!disposed) useNotifications.getState().set({ status: enabled ? 'Notifications enabled' : 'Notifications are off' });
      } catch { if (!disposed) useNotifications.getState().set({ status: 'Server is unavailable; notification settings will sync when you return.' }); }
      finally { clearTimeout(timer); }
    }
    void sync();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void sync(); });
    const timer = setInterval(() => { void sync(); }, 300000);
    return () => { disposed = true; subscription.remove(); clearInterval(timer); };
  }, [enabled, token, topics]);
}
