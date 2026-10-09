import { existsSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const release = profile === 'preview' || profile === 'production';
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (release && (!url || !url.startsWith('https://') || url.includes('YOUR-SERVICE'))) {
    throw new Error('Set EXPO_PUBLIC_API_URL to your real HTTPS backend URL before building.');
  }
  const firebase = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
  const projectId = config.extra?.eas?.projectId as string | undefined;
  return {
    ...config,
    name: 'Sillicom', slug: 'sillicom', version: '1.0.0',
    android: {
      ...config.android,
      ...(existsSync(firebase) ? { googleServicesFile: firebase } : {}),
    },
    extra: { ...config.extra, pushConfigured: existsSync(firebase) },
    runtimeVersion: { policy: 'fingerprint' },
    ...(projectId ? { updates: { ...config.updates, url: `https://u.expo.dev/${projectId}` } } : {}),
  };
};
