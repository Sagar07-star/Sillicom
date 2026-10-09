import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
const icons = { index: 'newspaper-outline', updates: 'code-slash-outline', events: 'calendar-outline', hackathons: 'trophy-outline' } as const;
export default function TabLayout() {
  const { colors } = useTheme();
  return <SafeAreaView edges={['top']} style={{ flex: 1 }}><Tabs screenOptions={({ route }) => ({ headerShown: false, sceneStyle: { backgroundColor: colors.transparent }, tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, minHeight: 64 }, tabBarActiveTintColor: colors.accentText, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12 }, tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name as keyof typeof icons]} color={color} size={size} /> })}><Tabs.Screen name="index" options={{ title: 'News' }} /><Tabs.Screen name="updates" options={{ title: 'Updates' }} /><Tabs.Screen name="events" options={{ title: 'Events' }} /><Tabs.Screen name="hackathons" options={{ title: 'Hackathons' }} /></Tabs></SafeAreaView>;
}
