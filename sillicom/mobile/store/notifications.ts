import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
interface NotificationPreferences {
  enabled: boolean; prompted: boolean; token: string | null; status: string;
  set: (patch: Partial<Pick<NotificationPreferences, 'enabled' | 'prompted' | 'token' | 'status'>>) => void;
}
export const useNotifications = create<NotificationPreferences>()(persist(set => ({
  enabled: false, prompted: false, token: null, status: 'Notifications are off',
  set: patch => set(patch),
}), { name: 'sillicom-notifications', storage: createJSONStorage(() => AsyncStorage) }));
