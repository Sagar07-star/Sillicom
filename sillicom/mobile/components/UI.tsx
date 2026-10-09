import React from 'react';
import { Pressable, StyleSheet, Text, TextProps, View, ViewProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
export function Label({ style, muted, ...props }: TextProps & { muted?: boolean }) {
  const { colors } = useTheme();
  return <Text {...props} style={[styles.text, { color: muted ? colors.muted : colors.text }, style]} />;
}
export function Card({ style, ...props }: ViewProps) {
  const { colors, dark } = useTheme();
  return <View {...props} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, shadowOpacity: dark ? 0 : 0.07 }, style]} />;
}
export function Button({ title, onPress, icon, disabled = false, compact = false }: { title: string; onPress: () => void; icon?: React.ComponentProps<typeof Ionicons>['name']; disabled?: boolean; compact?: boolean }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { borderColor: colors.border, backgroundColor: colors.card, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
    {icon && <Ionicons name={icon} size={20} color={colors.accentText} />}{!compact && <Label style={{ color: colors.accentText, fontFamily: 'SpaceGrotesk_600SemiBold' }}>{title}</Label>}
  </Pressable>;
}
export function Chip({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? colors.accent : colors.card, borderColor: colors.border }]}><Label style={{ color: selected ? colors.onAccent : colors.muted }}>{title}</Label></Pressable>;
}
export function EmptyState({ title, detail, retry }: { title: string; detail: string; retry?: () => void }) {
  return <View style={styles.empty}><Label style={styles.heading}>{title}</Label><Label muted style={{ textAlign: 'center' }}>{detail}</Label>{retry && <Button title="Try again" onPress={retry} icon="refresh" />}</View>;
}
const styles = StyleSheet.create({
  text: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 15, lineHeight: 23 },
  heading: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 24, lineHeight: 30 },
  card: { borderRadius: 26, borderWidth: 1, padding: 20, gap: 12, shadowOffset: { width: 0, height: 6 }, shadowRadius: 18 },
  button: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  chip: { minHeight: 44, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16, justifyContent: 'center' },
  empty: { padding: 24, gap: 14, alignItems: 'center', justifyContent: 'center', flex: 1 },
});
