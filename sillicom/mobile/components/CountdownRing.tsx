import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';
import { Label } from './UI';
export function CountdownRing({ deadline, published }: { deadline: string; published: string }) {
  const { colors } = useTheme(); const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const left = Math.max(0, Date.parse(deadline) - now); const span = Math.max(1, Date.parse(deadline) - Date.parse(published));
  const fraction = Math.min(1, left / span); const circumference = 2 * Math.PI * 31;
  const text = left === 0 ? 'Closed' : left < 86400000 ? `${Math.ceil(left / 3600000)}h` : `${Math.ceil(left / 86400000)}d`;
  return <View accessible accessibilityLabel={`${text} until deadline`} style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={76} height={76} style={{ position: 'absolute' }}><Circle cx={38} cy={38} r={31} fill={colors.transparent} stroke={colors.border} strokeWidth={5} /><Circle cx={38} cy={38} r={31} fill={colors.transparent} stroke={colors.highlight} strokeWidth={5} strokeDasharray={`${circumference}`} strokeDashoffset={circumference * (1 - fraction)} rotation={-90} origin="38,38" strokeLinecap="round" /></Svg><Label>{text}</Label>
  </View>;
}
