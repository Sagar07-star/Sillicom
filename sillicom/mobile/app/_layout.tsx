import { useEffect } from 'react';
import { Stack, router, useSegments, ErrorBoundaryProps } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, SpaceGrotesk_400Regular, SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { ThemeProvider, useTheme } from '../theme';
import { usePreferences } from '../store/preferences';
import { useNotifications } from '../store/notifications';
import { usePushRegistration } from '../api/push';
import { queryClient } from '../api/client';
import { AppErrorBoundary, CrashScreen } from '../components/AppErrorBoundary';
import { EmptyState } from '../components/UI';
import { Skeleton } from '../components/Skeleton';
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
export function ErrorBoundary({ retry }: ErrorBoundaryProps) { return <CrashScreen retry={() => { void retry(); }} />; }
function Navigator() {
  const { colors, dark } = useTheme();
  const hydrated = usePreferences(s => s.hydrated), onboarded = usePreferences(s => s.onboarded);
  const prompted = useNotifications(s => s.prompted);
  const segments = useSegments();
  usePushRegistration();
  useEffect(() => {
    if (!hydrated) return;
    if (!onboarded && segments[0] !== 'onboarding') router.replace('/onboarding');
    else if (onboarded && !prompted && segments[0] === '(tabs)') router.push('/notifications');
  }, [hydrated, onboarded, prompted, segments]);
  if (!hydrated) return <Skeleton />;
  return <><StatusBar style={dark ? 'light' : 'dark'} /><Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerTitleStyle: { fontFamily: 'SpaceGrotesk_600SemiBold' }, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
    <Stack.Screen name="saved" options={{ title: 'Saved' }} />
    <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
  </Stack></>;
}
export default function Root() {
  const [loaded, error] = useFonts({ SpaceGrotesk_400Regular, SpaceGrotesk_600SemiBold });
  useEffect(() => { if (loaded || error) void SplashScreen.hideAsync().catch(() => undefined); }, [loaded, error]);
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><QueryClientProvider client={queryClient}><ThemeProvider><AppErrorBoundary>
    {error ? <EmptyState title="Font failed to load" detail="Restart the app to reload the bundled font." /> : loaded ? <Navigator /> : <Skeleton />}
  </AppErrorBoundary></ThemeProvider></QueryClientProvider></SafeAreaProvider></GestureHandlerRootView>;
}
