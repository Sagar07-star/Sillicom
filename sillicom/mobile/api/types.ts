export const TOPICS = ['AI', 'Web', 'Security', 'Mobile', 'Startups', 'Open Source', 'Gaming', 'Cloud'] as const;
export type Topic = typeof TOPICS[number];
export type Kind = 'news' | 'update' | 'event' | 'hackathon';
export interface Item {
  id: number; source_id: number; source: { id: number; name: string; type: string; url: string };
  type: Kind; title: string; url: string; summary: string; why_it_matters: string;
  tags: string[]; published_at: string; starts_at: string | null; ends_at: string | null;
  location: string | null; deadline: string | null; mode: string | null; team_size: string | null;
}
export interface Feed { items: Item[]; total: number; limit: number; offset: number; as_of?: string }
export function timeAgo(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 60000));
  return minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}
