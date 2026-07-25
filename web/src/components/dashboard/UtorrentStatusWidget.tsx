import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import { formatSpeed, parseTorrent, statusLabel, type UtorrentListResponse } from '@/components/services/utorrent/UtorrentShared';
import type { ServiceInstance } from '@/lib/api';

export function UtorrentStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('utorrent');
  const Icon = getServiceIcon('utorrent');
  const { data, isLoading } = useServiceProxy<UtorrentListResponse>(instance, {
    path: '/gui/',
    query: { list: '1' },
    refetchInterval: 8000,
  });

  if (!isLoading && !data?.ok) return null;

  const torrents = (data?.data?.torrents ?? []).map(parseTorrent);
  const totalDlSpeed = torrents.reduce((sum, t) => sum + t.dlSpeed, 0);
  const active = torrents.find((t) => t.dlSpeed > 0) ?? torrents[0];

  return (
    <motion.button
      type="button"
      onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: 'utorrent' } })}
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
            {data ? `${formatSpeed(totalDlSpeed) || '0 B/s'} · ${torrents.length} torrent${torrents.length === 1 ? '' : 's'}` : 'Connecting…'}
          </p>
        </div>
      </div>
      {active && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate pr-2">{active.name}</span>
            <span className="shrink-0">{statusLabel(active.status)}</span>
          </div>
          <ProgressBar value={active.progressPct} />
        </div>
      )}
    </motion.button>
  );
}
