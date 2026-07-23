import { apiUrl, type ServiceInstance } from '@/lib/api';

export function tracearrImageUrl(instance: ServiceInstance, posterUrl?: string | null): string | undefined {
  if (!posterUrl) return undefined;
  return apiUrl(`/api/tracearr/${instance.id}/image?path=${encodeURIComponent(posterUrl)}`);
}

/** Seconds -> "33h 48m", dropping leading zero units. */
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

/** ms -> "1h 35m" */
export function formatMsDuration(ms: number): string {
  return formatLongDuration(Math.round(ms / 1000));
}

export function trustTone(score: number): 'success' | 'amber' | 'destructive' {
  if (score >= 70) return 'success';
  if (score >= 40) return 'amber';
  return 'destructive';
}

export function trustLabel(score: number): string {
  if (score >= 70) return 'Trusted';
  if (score >= 40) return 'Watch';
  return 'Flagged';
}

export const SEVERITY_LABEL: Record<string, string> = { low: 'Low', warning: 'Warning', high: 'High' };
export const MEDIA_TYPE_LABEL: Record<string, string> = { movie: 'Movie', episode: 'Episode', track: 'Track', live: 'Live', photo: 'Photo', unknown: 'Unknown' };

export type TracearrUser = {
  id: string;
  username: string;
  displayName: string;
  thumbUrl?: string | null;
  avatarUrl?: string | null;
  role: string;
  trustScore: number;
  totalViolations: number;
  serverName: string;
  lastActivityAt?: string | null;
  sessionCount: number;
  createdAt: string;
};

export type TracearrViolation = {
  id: string;
  serverName: string;
  severity: 'low' | 'warning' | 'high';
  acknowledged: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
  rule: { id: string; type: string; name: string };
  // Optional — a session tied to a deleted/unresolved Plex account has no user to report.
  user?: { id: string; username: string; thumbUrl?: string | null; avatarUrl?: string | null };
};

export type TracearrSessionHistory = {
  id: string;
  serverName: string;
  state: 'playing' | 'paused' | 'stopped';
  mediaTitle: string;
  mediaType: 'movie' | 'episode' | 'track' | 'live' | 'photo' | 'unknown';
  showTitle?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  year?: number | null;
  posterUrl?: string | null;
  durationMs?: number | null;
  progressMs?: number | string | null;
  totalDurationMs?: number | string | null;
  startedAt: string;
  watched: boolean;
  device?: string | null;
  player?: string | null;
  platform?: string | null;
  isTranscode?: boolean | null;
  // Optional — a session tied to a deleted/unresolved Plex account has no user to report.
  user?: { id: string; username: string; thumbUrl?: string | null; avatarUrl?: string | null };
};

export function historySubtitle(item: TracearrSessionHistory): string {
  if (item.mediaType === 'episode' && item.showTitle) {
    const code = item.seasonNumber !== undefined && item.episodeNumber !== undefined ? `S${item.seasonNumber} E${String(item.episodeNumber).padStart(2, '0')}` : '';
    return [code, item.mediaTitle].filter(Boolean).join(' • ');
  }
  return item.year ? String(item.year) : '';
}

export function historyDisplayTitle(item: TracearrSessionHistory): string {
  return item.mediaType === 'episode' ? item.showTitle || item.mediaTitle : item.mediaTitle;
}
