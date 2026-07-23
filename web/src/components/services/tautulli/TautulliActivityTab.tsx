import { Tv } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Sparkline } from '@/components/shared/Sparkline';
import { useServiceProxy } from '@/lib/queries';
import { useRollingHistory } from '@/lib/useRollingHistory';
import type { ServiceInstance } from '@/lib/api';

type TautulliSession = { session_key: string; user: string; full_title: string; progress_percent: string; state: string };
type TautulliActivity = { response?: { result: string; data?: { stream_count?: string; sessions?: TautulliSession[] } } };

export function TautulliActivityTab({ instance }: { instance: ServiceInstance }) {
  const { data, isLoading, dataUpdatedAt } = useServiceProxy<TautulliActivity>(instance, {
    path: '/api/v2',
    query: { cmd: 'get_activity' },
    refetchInterval: 10000,
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
        <CardContent className="flex flex-col gap-4">
          {sessions.map((s) => (
            <div key={s.session_key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate pr-4 font-medium">{s.full_title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {s.user} · {s.state}
                </span>
              </div>
              <ProgressBar value={Number(s.progress_percent) || 0} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
