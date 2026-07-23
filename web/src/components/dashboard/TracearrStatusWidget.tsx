import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

type StatsToday = { activeStreams: number; todayPlays: number; alertsLast24h: number };

export function TracearrStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('tracearr');
  const Icon = getServiceIcon('tracearr');
  const { data, isLoading } = useServiceProxy<StatsToday>(instance, { path: '/api/v1/public/stats/today', refetchInterval: 30000 });

  if (!isLoading && !data?.ok) return null;
  const today = data?.data;

  return (
    <motion.button
      type="button"
      onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: 'tracearr' } })}
      className="mb-8 flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
    >
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
    </motion.button>
  );
}
