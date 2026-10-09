const value = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
export const API_URL = value;
export function requireApiUrl(): string {
  if (!value || !/^https?:\/\//.test(value)) throw new Error('The server address is missing. Set EXPO_PUBLIC_API_URL and rebuild.');
  if (!__DEV__ && !value.startsWith('https://')) throw new Error('This installed app requires an HTTPS server address.');
  return value;
}
