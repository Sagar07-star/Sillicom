import React, { Component, ErrorInfo, PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { Button, Label } from './UI';

export function CrashScreen({ retry }: { retry: () => void }) {
  const { colors } = useTheme();
  return <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: 'center', backgroundColor: colors.background }}>
    <Label style={{ fontSize: 24 }}>Let’s try that again</Label>
    <Label muted>Sillicom hit a hiccup. Your saved items and topics are still on this phone.</Label>
    <Button title="Retry" onPress={retry} />
  </View>;
}
export class AppErrorBoundary extends Component<PropsWithChildren, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Sillicom render error', error.message, info.componentStack); }
  render() {
    if (this.state.failed) return <CrashScreen retry={() => this.setState(s => ({ failed: false, attempt: s.attempt + 1 }))} />;
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}
