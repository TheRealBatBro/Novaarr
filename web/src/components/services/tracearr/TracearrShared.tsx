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
  resolution?: string | null;
  // The live-streams endpoint (/api/v1/public/streams) puts these at the top level; the history
  // endpoint (/api/v1/public/history) nests the same info under `user` instead — a session tied
  // to a deleted/unresolved Plex account has neither.
  username?: string | null;
  userThumb?: string | null;
  userAvatarUrl?: string | null;
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

export function sessionUserLabel(item: TracearrSessionHistory): string {
  return item.user?.username || item.username || 'Unknown user';
}

export function sessionUserAvatar(item: TracearrSessionHistory): string | null | undefined {
  return item.user?.avatarUrl || item.userAvatarUrl || item.user?.thumbUrl || item.userThumb;
}

export function sessionQualityLabel(item: TracearrSessionHistory): string {
  return [item.resolution, item.isTranscode ? 'Transcode' : 'Direct Play'].filter(Boolean).join(' · ');
}

export function sessionPlayerLabel(item: TracearrSessionHistory): string | undefined {
  return item.player || item.device || undefined;
}

export function sessionRemaining(item: TracearrSessionHistory): string | undefined {
  const progress = Number(item.progressMs ?? 0);
  const total = Number(item.totalDurationMs ?? item.durationMs ?? 0);
  if (!total) return undefined;
  const remainingMs = total - progress;
  if (remainingMs <= 0) return undefined;
  return `${formatMsDuration(remainingMs)} left`;
}
