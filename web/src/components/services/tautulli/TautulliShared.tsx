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

// Fields Tautulli returns identically on both `get_activity` (live sessions) and the history
// endpoint, so historySubtitle/historyDisplayTitle work unchanged on either one.
export type TautulliMediaFields = {
  media_type: string;
  title: string;
  full_title: string;
  parent_title?: string;
  grandparent_title?: string;
  media_index?: number | string;
  parent_media_index?: number | string;
  year?: number | string;
};

export function historySubtitle(item: TautulliMediaFields): string {
  if (item.media_type === 'episode') {
    const s = item.parent_media_index;
    const e = item.media_index;
    const code = s !== undefined && e !== undefined ? `${s}x${String(e).padStart(2, '0')}` : '';
    return [code, item.title].filter(Boolean).join(' • ');
  }
  return item.year ? String(item.year) : '';
}

export function historyDisplayTitle(item: TautulliMediaFields): string {
  return item.media_type === 'episode' ? item.grandparent_title || item.full_title : item.title || item.full_title;
}

export type TautulliHistoryItem = TautulliMediaFields & {
  id: number;
  date: number;
  user: string;
  friendly_name: string;
  user_thumb?: string;
  thumb?: string;
  percent_complete: number;
  watched_status: number;
};

// `get_activity` session fields actually used here — Tautulli's raw payload has many more.
export type TautulliSession = TautulliMediaFields & {
  session_key: string;
  state: string;
  user: string;
  friendly_name?: string;
  user_thumb?: string;
  progress_percent: string;
  view_offset?: string | number;
  duration?: string | number;
  thumb?: string;
  parent_thumb?: string;
  grandparent_thumb?: string;
  art?: string;
  player?: string;
  product?: string;
  platform?: string;
  video_full_resolution?: string;
  transcode_decision?: string;
};

/** Landscape fanart for the session's show/movie — falls back to a poster crop if no art is set. */
export function sessionBackdrop(instance: ServiceInstance, session: TautulliSession): string | undefined {
  return tautulliImageUrl(instance, session.art || session.grandparent_thumb || session.thumb, { width: 800 });
}

export function sessionPoster(instance: ServiceInstance, session: TautulliSession): string | undefined {
  return tautulliImageUrl(instance, session.grandparent_thumb || session.thumb, { width: 150, height: 225 });
}

export function sessionQualityLabel(session: TautulliSession): string {
  const parts: string[] = [];
  if (session.video_full_resolution) parts.push(session.video_full_resolution);
  parts.push(session.transcode_decision === 'transcode' ? 'Transcode' : 'Direct Play');
  return parts.join(' · ');
}

export function sessionPlayerLabel(session: TautulliSession): string | undefined {
  return session.player || session.product;
}

export function sessionRemaining(session: TautulliSession): string | undefined {
  const duration = Number(session.duration);
  const offset = Number(session.view_offset);
  if (!duration || Number.isNaN(offset)) return undefined;
  const remainingMs = duration - offset;
  if (remainingMs <= 0) return undefined;
  return `${formatLongDuration(Math.round(remainingMs / 1000))} left`;
}
