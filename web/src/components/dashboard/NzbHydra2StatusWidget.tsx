import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

// Same best-effort field reading as NzbHydra2IndexersTab — see that file's comment for why.
type NzbHydra2IndexerStat = { state?: string };

function isEnabled(ix: NzbHydra2IndexerStat): boolean {
  return !ix.state || ix.state.toUpperCase() === 'ENABLED';
}

export function NzbHydra2StatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('nzbhydra2');
  const Icon = getServiceIcon('nzbhydra2');
  const { data, isLoading } = useServiceProxy<NzbHydra2IndexerStat[]>(instance, { path: 'stats/indexers', refetchInterval: 60_000 });

  if (!isLoading && !data?.ok) return null;

  const indexers = data?.ok && Array.isArray(data.data) ? data.data : [];
  const enabledCount = indexers.filter(isEnabled).length;

  return (
    <motion.button
      type="button"
      onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: 'nzbhydra2' } })}
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
    </motion.button>
  );
}
