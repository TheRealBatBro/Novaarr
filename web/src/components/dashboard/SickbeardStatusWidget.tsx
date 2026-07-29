import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import type { SbComingEpisodes, SbResponse } from '@/components/services/sickbeard/SickbeardShared';
import type { ServiceInstance } from '@/lib/api';

export function SickbeardStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('sickbeard');
  const Icon = getServiceIcon('sickbeard');
  const { data, isLoading } = useServiceProxy<SbResponse<SbComingEpisodes>>(instance, {
    path: '',
    query: { cmd: 'future', type: 'today|soon' },
    refetchInterval: 60_000,
  });

  if (!isLoading && !data?.ok) return null;

  const coming = data?.data?.data;
  const today = coming?.today ?? [];
  const soon = coming?.soon ?? [];
  const next = today[0] ?? soon[0];
  const upcomingCount = today.length + soon.length;

  return (
    <motion.button
      type="button"
      onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: String(instance.id) } })}
      className="mb-8 flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${definition?.brandColor}22`, color: definition?.brandColor }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {coming ? `${upcomingCount} episode${upcomingCount === 1 ? '' : 's'} airing soon` : 'Connecting…'}
          </p>
        </div>
      </div>
      {next && (
        <div className="truncate text-xs text-muted-foreground">
          Next: <span className="font-medium text-foreground">{next.show_name}</span> S{next.season}E{next.episode} · {next.airdate}
        </div>
      )}
    </motion.button>
  );
}
