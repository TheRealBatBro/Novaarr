import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { SessionBackdrop, SessionDetails } from '@/components/shared/NowPlayingCard';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import {
  tracearrImageUrl,
  sessionBackdropUrl,
  historyDisplayTitle,
  historySubtitle,
  sessionUserLabel,
  sessionUserAvatar,
  sessionQualityLabel,
  sessionPlayerLabel,
  sessionRemaining,
  type TracearrSessionHistory,
} from '@/components/services/tracearr/TracearrShared';
import type { ServiceInstance } from '@/lib/api';

type StatsToday = { activeStreams: number; todayPlays: number; alertsLast24h: number };
type StreamsResponse = { data?: TracearrSessionHistory[] };

export function TracearrStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('tracearr');
  const Icon = getServiceIcon('tracearr');
  const { data, isLoading } = useServiceProxy<StatsToday>(instance, { path: '/api/v1/public/stats/today', refetchInterval: 30000 });
  const { data: streamsResp } = useServiceProxy<StreamsResponse>(instance, { path: '/api/v1/public/streams', refetchInterval: 10000 });

  if (!isLoading && !data?.ok) return null;
  const today = data?.data;
  const first = streamsResp?.data?.data?.[0];
  const progress = Number(first?.progressMs ?? 0);
  const total = Number(first?.totalDurationMs ?? first?.durationMs ?? 0);
  const pct = total > 0 ? Math.min(100, (progress / total) * 100) : 0;

  return (
    <motion.button
      type="button"
      onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: 'tracearr' } })}
      className="relative mb-8 flex w-full flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
    >
      {first && <SessionBackdrop url={sessionBackdropUrl(instance, first)} />}
      <div className="relative z-10 flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${definition?.brandColor}22`, color: definition?.brandColor }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {today ? `${today.activeStreams} active · ${today.todayPlays} plays today` : 'Connecting…'}
          </p>
        </div>
        {today !== undefined && today.alertsLast24h > 0 && (
          <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
            {today.alertsLast24h} alert{today.alertsLast24h === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {first && (
        <div className="relative z-10">
          <SessionDetails
            size="sm"
            posterUrl={tracearrImageUrl(instance, first.posterUrl)}
            title={historyDisplayTitle(first)}
            subtitle={historySubtitle(first)}
            userLabel={sessionUserLabel(first)}
            userAvatarUrl={sessionUserAvatar(first)}
            state={first.state}
            meta={[sessionQualityLabel(first), sessionPlayerLabel(first)].filter(Boolean).join(' · ')}
            progressPercent={pct}
            remaining={sessionRemaining(first)}
          />
        </div>
      )}
    </motion.button>
  );
}
