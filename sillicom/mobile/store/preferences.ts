import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Item, Topic } from '../api/types';
export type ThemeMode = 'light' | 'dark' | 'system';
interface Preferences {
  theme: ThemeMode; topics: Topic[]; onboarded: boolean; saved: Item[]; hydrated: boolean;
  setTheme: (theme: ThemeMode) => void; setTopics: (topics: Topic[]) => void;
  toggleSave: (item: Item) => void; setHydrated: () => void;
}
export const usePreferences = create<Preferences>()(persist((set) => ({
  theme: 'system', topics: [], onboarded: false, saved: [], hydrated: false,
  setTheme: (theme) => set({ theme }),
  setTopics: (topics) => set({ topics, onboarded: topics.length >= 3 }),
  toggleSave: (item) => set((s) => ({ saved: s.saved.some((v) => v.id === item.id) ? s.saved.filter((v) => v.id !== item.id) : [item, ...s.saved] })),
  setHydrated: () => set({ hydrated: true }),
}), {
  name: 'sillicom-preferences', storage: createJSONStorage(() => AsyncStorage),
  partialize: ({ theme, topics, onboarded, saved }) => ({ theme, topics, onboarded, saved }),
  onRehydrateStorage: () => (state) => { if (state) state.setHydrated(); else usePreferences.setState({ hydrated: true }); },
}));
