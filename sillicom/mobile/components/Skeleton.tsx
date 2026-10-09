import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { Card } from './UI';
export function Skeleton() {
  const { colors } = useTheme(); const opacity = useSharedValue(0.3);
  useEffect(() => { opacity.value = withRepeat(withTiming(0.8, { duration: 800 }), -1, true); }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Card accessibilityLabel="Loading feed"><Animated.View style={[{ gap: 18 }, style]}>{[40, 24, 24, 80].map((height, i) => <View key={i} style={{ height, borderRadius: 12, backgroundColor: colors.border }} />)}</Animated.View></Card>;
}
