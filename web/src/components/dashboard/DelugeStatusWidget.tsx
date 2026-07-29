import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import { DELUGE_FIELDS, formatSpeed, type DelugeResponse } from '@/components/services/deluge/DelugeShared';
import type { ServiceInstance } from '@/lib/api';

export function DelugeStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('deluge');
  const Icon = getServiceIcon('deluge');
  const { data, isLoading } = useServiceProxy<DelugeResponse>(instance, {
    path: '/json',
    body: { method: 'core.get_torrents_status', params: [{}, DELUGE_FIELDS] },
    refetchInterval: 8000,
  });

  if (!isLoading && !data?.ok) return null;

  const torrents = Object.values(data?.data?.result ?? {});
  const totalDlSpeed = torrents.reduce((sum, t) => sum + t.download_payload_rate, 0);
  const active = torrents.find((t) => t.download_payload_rate > 0) ?? torrents[0];

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
            {data ? `${formatSpeed(totalDlSpeed) || '0 KB/s'} · ${torrents.length} torrent${torrents.length === 1 ? '' : 's'}` : 'Connecting…'}
          </p>
        </div>
      </div>
      {active && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate pr-2">{active.name}</span>
            <span className="shrink-0">{active.state === 'Paused' ? 'Paused' : active.state}</span>
          </div>
          <ProgressBar value={active.progress} />
        </div>
      )}
    </motion.button>
  );
}
