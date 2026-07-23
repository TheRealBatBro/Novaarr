import { apiUrl, type ServiceInstance } from '@/lib/api';

export function tautulliImageUrl(instance: ServiceInstance, img?: string, opts?: { width?: number; height?: number }): string | undefined {
  if (!img) return undefined;
  const params = new URLSearchParams({ img });
  if (opts?.width) params.set('width', String(opts.width));
  if (opts?.height) params.set('height', String(opts.height));
  return apiUrl(`/api/tautulli/${instance.id}/image?${params.toString()}`);
}

/** Seconds -> "70d 4h 32m", dropping leading zero units. */
export function formatLongDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

export type TautulliHistoryItem = {
  id: number;
  date: number;
  user: string;
  friendly_name: string;
  user_thumb?: string;
  media_type: 'movie' | 'episode' | 'track' | 'clip';
  title: string;
  full_title: string;
  parent_title?: string;
  grandparent_title?: string;
  year?: number;
  media_index?: number | string;
  parent_media_index?: number | string;
  thumb?: string;
  percent_complete: number;
  watched_status: number;
};

export function historySubtitle(item: TautulliHistoryItem): string {
  if (item.media_type === 'episode') {
    const s = item.parent_media_index;
    const e = item.media_index;
    const code = s !== undefined && e !== undefined ? `${s}x${String(e).padStart(2, '0')}` : '';
    return [code, item.title].filter(Boolean).join(' • ');
  }
  return item.year ? String(item.year) : '';
}

export function historyDisplayTitle(item: TautulliHistoryItem): string {
  return item.media_type === 'episode' ? item.grandparent_title || item.full_title : item.title || item.full_title;
}
