import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { usePreferences } from '../store/preferences';
export const palettes = {
  dark: { background: '#0D0F14', card: '#171A22', border: '#262B38', text: '#F2F4F8', muted: '#9AA3B2', accent: '#4CF0B4', highlight: '#FFB547', accentText: '#4CF0B4', onAccent: '#0D0F14', shadow: '#000000', transparent: 'transparent' },
  light: { background: '#F6EFE4', card: '#FFF9F0', border: '#E6D9C5', text: '#2B2118', muted: '#6E5E4E', accent: '#C8553D', highlight: '#D9962B', accentText: '#A33F2B', onAccent: '#000000', shadow: '#2B2118', transparent: 'transparent' },
};
export type Colors = typeof palettes.light;
const Context = createContext<{ colors: Colors; dark: boolean }>({ colors: palettes.light, dark: false });
export const useTheme = () => useContext(Context);
export function ThemeProvider({ children }: React.PropsWithChildren) {
  const mode = usePreferences((s) => s.theme); const system = useColorScheme();
  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const colors = dark ? palettes.dark : palettes.light;
  const background = useSharedValue(colors.background);
  const opacity = useSharedValue(1);
  useEffect(() => { background.value = withTiming(colors.background, { duration: 260 }); opacity.value = 0.82; opacity.value = withTiming(1, { duration: 260 }); }, [colors, background, opacity]);
  const style = useAnimatedStyle(() => ({ backgroundColor: background.value, opacity: opacity.value }));
  const value = useMemo(() => ({ colors, dark }), [colors, dark]);
  return <Context.Provider value={value}><Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View></Context.Provider>;
}
