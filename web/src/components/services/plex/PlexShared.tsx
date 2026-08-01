import { apiUrl, type ServiceInstance } from '@/lib/api';

export function plexImageUrl(instance: ServiceInstance, thumbPath?: string): string | undefined {
  if (!thumbPath) return undefined;
  return apiUrl(`/api/plex/${instance.id}/image?${new URLSearchParams({ path: thumbPath })}`);
}

// `/status/sessions` Metadata fields actually used here — Plex's raw payload has many more.
export type PlexSession = {
  ratingKey: string;
  type: 'movie' | 'episode' | 'track';
  title: string;
  grandparentTitle?: string;
  parentIndex?: number;
  index?: number;
  year?: number;
  thumb?: string;
  grandparentThumb?: string;
  art?: string;
  duration?: number;
  viewOffset?: number;
  User?: { title?: string; thumb?: string };
  Player?: { title?: string; product?: string; state?: string };
  Session?: { id?: string };
  Media?: { videoResolution?: string }[];
  TranscodeSession?: { videoDecision?: string };
};

export function sessionDisplayTitle(s: PlexSession): string {
  return s.type === 'episode' ? s.grandparentTitle || s.title : s.title;
}

export function sessionSubtitle(s: PlexSession): string {
  if (s.type === 'episode') {
    const code = s.parentIndex !== undefined && s.index !== undefined ? `S${s.parentIndex}E${String(s.index).padStart(2, '0')}` : '';
    return [code, s.title].filter(Boolean).join(' • ');
  }
  return s.year ? String(s.year) : '';
}

export function sessionQualityLabel(s: PlexSession): string {
  const parts: string[] = [];
  const resolution = s.Media?.[0]?.videoResolution;
  if (resolution) parts.push(`${resolution}p`.replace('4kp', '4k'));
  parts.push(s.TranscodeSession ? 'Transcode' : 'Direct Play');
  return parts.join(' · ');
}

export function sessionPlayerLabel(s: PlexSession): string | undefined {
  return s.Player?.title || s.Player?.product;
}

export function sessionRemaining(s: PlexSession): string | undefined {
  if (!s.duration || s.viewOffset === undefined) return undefined;
  const remainingMs = s.duration - s.viewOffset;
  if (remainingMs <= 0) return undefined;
  const totalMinutes = Math.round(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours ? `${hours}h ` : ''}${minutes}m left`;
}
