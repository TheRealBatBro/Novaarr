import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionBackdrop, SessionDetails } from '@/components/shared/NowPlayingCard';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import {
  plexImageUrl,
  sessionDisplayTitle,
  sessionPlayerLabel,
  sessionQualityLabel,
  sessionRemaining,
  sessionSubtitle,
  type PlexSession,
} from '@/components/services/plex/PlexShared';

type PlexSessionsResponse = { MediaContainer?: { size?: number; Metadata?: PlexSession[] } };

// No dedicated Plex screen exists (Plex only ever powered dashboard widgets before this) — this
// widget shows every active session inline, with its own stop control, rather than a
// condensed "click through for more" preview like the other status widgets.
export function PlexNowPlayingWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const qc = useQueryClient();
  const definition = getServiceDefinition('plex');
  const Icon = getServiceIcon('plex');
  const { data, isLoading } = useServiceProxy<PlexSessionsResponse>(instance, {
    path: '/status/sessions',
    refetchInterval: 10000,
  });

  const terminate = useMutation({
    mutationFn: (sessionId: string) =>
      proxyApi.call(instance.id, {
        path: '/status/sessions/terminate',
        query: { sessionId, reason: 'Stopped from Novaarr' },
      }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Failed to stop stream');
      toast.success('Stream stopped');
      qc.invalidateQueries({ queryKey: ['proxy', instance.id, '/status/sessions'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to stop stream'),
  });

  if (!isLoading && !data?.ok) return null;

  const sessions = data?.data?.MediaContainer?.Metadata ?? [];
  if (!isLoading && sessions.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${definition?.brandColor}22`, color: definition?.brandColor }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {sessions.length} active stream{sessions.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {sessions.map((s) => {
          const sessionId = s.Session?.id;
          return (
            <div key={s.ratingKey} className="relative overflow-hidden rounded-xl border border-border bg-card p-3">
              <SessionBackdrop url={plexImageUrl(instance, s.art || s.grandparentThumb || s.thumb)} />
              {/* The stop button below sits absolutely over this corner — without this padding,
                  a session's state badge ("PLAYING"/"PAUSED") or a long title runs right under
                  it instead of stopping short. */}
              <div className={cn('relative z-10', sessionId && 'pr-9')}>
                <SessionDetails
                  size="sm"
                  posterUrl={plexImageUrl(instance, s.grandparentThumb || s.thumb)}
                  title={sessionDisplayTitle(s)}
                  subtitle={sessionSubtitle(s)}
                  userLabel={s.User?.title}
                  state={s.Player?.state}
                  meta={[sessionQualityLabel(s), sessionPlayerLabel(s)].filter(Boolean).join(' · ')}
                  progressPercent={s.duration ? ((s.viewOffset ?? 0) / s.duration) * 100 : 0}
                  remaining={sessionRemaining(s)}
                />
              </div>
              {sessionId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 z-10 h-7 w-7"
                  title="Stop stream"
                  disabled={terminate.isPending && terminate.variables === sessionId}
                  onClick={() => terminate.mutate(sessionId)}
                >
                  <Square className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
