import { Tv, Square } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/shared/Sparkline';
import { SessionBackdrop, SessionDetails } from '@/components/shared/NowPlayingCard';
import { useServiceProxy } from '@/lib/queries';
import { useRollingHistory } from '@/lib/useRollingHistory';
import {
  historyDisplayTitle,
  historySubtitle,
  sessionBackdrop,
  sessionPlayerLabel,
  sessionPoster,
  sessionQualityLabel,
  sessionRemaining,
  type TautulliSession,
} from './TautulliShared';
import { proxyApi, type ServiceInstance } from '@/lib/api';

type TautulliActivity = { response?: { result: string; data?: { stream_count?: string; sessions?: TautulliSession[] } } };

export function TautulliActivityTab({ instance }: { instance: ServiceInstance }) {
  const qc = useQueryClient();
  const { data, isLoading, dataUpdatedAt } = useServiceProxy<TautulliActivity>(instance, {
    path: '/api/v2',
    query: { cmd: 'get_activity' },
    refetchInterval: 10000,
  });

  const terminate = useMutation({
    mutationFn: (sessionKey: string) =>
      proxyApi.call(instance.id, {
        path: '/api/v2',
        query: { cmd: 'terminate_session', session_key: sessionKey, message: 'Stopped from Novaarr' },
      }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Failed to stop stream');
      toast.success('Stream stopped');
      qc.invalidateQueries({ queryKey: ['proxy', instance.id, '/api/v2', { cmd: 'get_activity' }] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to stop stream'),
  });

  const activityOk = data?.ok && data.data?.response?.result === 'success';
  const activity = data?.data?.response?.data;
  const sessions = activity?.sessions ?? [];
  const streamCount = activityOk ? Number(activity?.stream_count ?? 0) : undefined;
  const history = useRollingHistory(streamCount, dataUpdatedAt);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Tv className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">No active streams.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Active streams</p>
          <Sparkline data={history} color="#daa520" formatValue={(v) => `${v.toFixed(0)} stream${v === 1 ? '' : 's'}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Now Playing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sessions.map((s) => (
            <div key={s.session_key} className="relative overflow-hidden rounded-xl border border-border bg-card p-3">
              <SessionBackdrop url={sessionBackdrop(instance, s)} />
              {/* The stop button below sits absolutely over this corner — without this padding,
                  a session's state badge or a long title runs right under it. */}
              <div className="relative z-10 pr-9">
                <SessionDetails
                  posterUrl={sessionPoster(instance, s)}
                  title={historyDisplayTitle(s)}
                  subtitle={historySubtitle(s)}
                  userLabel={s.friendly_name || s.user}
                  state={s.state}
                  meta={[sessionQualityLabel(s), sessionPlayerLabel(s)].filter(Boolean).join(' · ')}
                  progressPercent={Number(s.progress_percent) || 0}
                  remaining={sessionRemaining(s)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 z-10 h-7 w-7"
                title="Stop stream"
                disabled={terminate.isPending && terminate.variables === s.session_key}
                onClick={() => terminate.mutate(s.session_key)}
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
