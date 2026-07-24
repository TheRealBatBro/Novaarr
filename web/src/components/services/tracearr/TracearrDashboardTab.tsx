import { AlertTriangle, Play, Clock, Users, Monitor } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionBackdrop, SessionDetails } from '@/components/shared/NowPlayingCard';
import { useServiceProxy } from '@/lib/queries';
import {
  tracearrImageUrl,
  historyDisplayTitle,
  historySubtitle,
  sessionUserLabel,
  sessionUserAvatar,
  sessionQualityLabel,
  sessionPlayerLabel,
  sessionRemaining,
  type TracearrSessionHistory,
} from './TracearrShared';
import type { ServiceInstance } from '@/lib/api';

type StatsToday = { activeStreams: number; todayPlays: number; watchTimeHours: number; alertsLast24h: number; activeUsersToday: number };
type StreamsResponse = { data?: TracearrSessionHistory[] };

function StatTile({ icon: Icon, value, label }: { icon: typeof Play; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xl font-bold leading-tight tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function TracearrDashboardTab({ instance }: { instance: ServiceInstance }) {
  const { data: todayResp, isLoading: todayLoading } = useServiceProxy<StatsToday>(instance, { path: '/api/v1/public/stats/today', refetchInterval: 30000 });
  const { data: streamsResp, isLoading: streamsLoading } = useServiceProxy<StreamsResponse>(instance, { path: '/api/v1/public/streams', refetchInterval: 10000 });

  const today = todayResp?.data;
  const streams = streamsResp?.data?.data ?? [];

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">Today</h2>

      {todayLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-2">
          <StatTile icon={AlertTriangle} value={today?.alertsLast24h ?? 0} label="Alerts" />
          <StatTile icon={Play} value={today?.todayPlays ?? 0} label="Plays" />
          <StatTile icon={Clock} value={`${Math.round((today?.watchTimeHours ?? 0) * 10) / 10}h`} label="Watch Time" />
          <StatTile icon={Users} value={today?.activeUsersToday ?? 0} label="Unique Users" />
        </div>
      )}

      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">Now Playing</h2>

      {streamsLoading && <Skeleton className="h-40 w-full rounded-xl" />}

      {!streamsLoading && streams.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Monitor className="h-6 w-6 text-muted-foreground" />
          </span>
          <p className="font-semibold">No active streams</p>
          <p className="text-sm text-muted-foreground">Active streams will appear here when users start watching</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {streams.map((s) => {
          const progress = Number(s.progressMs ?? 0);
          const total = Number(s.totalDurationMs ?? s.durationMs ?? 0);
          const pct = total > 0 ? Math.min(100, (progress / total) * 100) : 0;
          return (
            <div key={s.id} className="relative overflow-hidden rounded-xl border border-border bg-card p-3">
              <SessionBackdrop url={tracearrImageUrl(instance, s.posterUrl)} />
              <div className="relative z-10">
                <SessionDetails
                  posterUrl={tracearrImageUrl(instance, s.posterUrl)}
                  title={historyDisplayTitle(s)}
                  subtitle={historySubtitle(s)}
                  userLabel={sessionUserLabel(s)}
                  userAvatarUrl={sessionUserAvatar(s)}
                  state={s.state}
                  meta={[sessionQualityLabel(s), sessionPlayerLabel(s)].filter(Boolean).join(' · ')}
                  progressPercent={pct}
                  remaining={sessionRemaining(s)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
