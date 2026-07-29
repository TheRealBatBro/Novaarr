import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

type SabnzbdSlot = { filename: string; percentage: string; timeleft: string };
type SabnzbdQueue = { queue?: { status: string; speed: string; noofslots: number; slots: SabnzbdSlot[] } };

export function SabnzbdStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('sabnzbd');
  const Icon = getServiceIcon('sabnzbd');
  const { data, isLoading } = useServiceProxy<SabnzbdQueue>(instance, {
    path: '/api',
    query: { mode: 'queue', output: 'json' },
    refetchInterval: 8000,
  });

  if (!isLoading && !data?.ok) return null;

  const queue = data?.data?.queue;
  const speedMBs = queue ? Number(queue.speed) / 1024 : 0;
  const first = queue?.slots?.[0];
  const pct = first ? Number(first.percentage) || 0 : 0;

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
            {queue ? `${queue.status} · ${speedMBs.toFixed(1)} MB/s · ${queue.noofslots ?? 0} in queue` : 'Connecting…'}
          </p>
        </div>
      </div>
      {first && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate pr-2">{first.filename}</span>
            <span className="shrink-0">{first.timeleft}</span>
          </div>
          <ProgressBar value={pct} />
        </div>
      )}
    </motion.button>
  );
}
