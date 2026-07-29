import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

type ProwlarrIndexer = { id: number; enable: boolean };
type ProwlarrHealth = { type: 'ok' | 'notice' | 'warning' | 'error' };

export function ProwlarrStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('prowlarr');
  const Icon = getServiceIcon('prowlarr');
  const { data, isLoading } = useServiceProxy<ProwlarrIndexer[]>(instance, { path: '/api/v1/indexer', refetchInterval: 60_000 });
  const { data: healthResp } = useServiceProxy<ProwlarrHealth[]>(instance, { path: '/api/v1/health', refetchInterval: 30_000 });

  if (!isLoading && !data?.ok) return null;

  const indexers = data?.ok && Array.isArray(data.data) ? data.data : [];
  const enabledCount = indexers.filter((ix) => ix.enable).length;
  const issues = healthResp?.ok && Array.isArray(healthResp.data) ? healthResp.data.filter((h) => h.type !== 'ok').length : 0;

  return (
    <motion.button
      type="button"
      onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: String(instance.id) } })}
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
          {isLoading ? 'Connecting…' : `${indexers.length} indexer${indexers.length === 1 ? '' : 's'} · ${enabledCount} enabled`}
        </p>
      </div>
      {issues > 0 && (
        <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
          {issues} issue{issues === 1 ? '' : 's'}
        </span>
      )}
    </motion.button>
  );
}
