import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import { JACKETT_INDEXERS_PATH, type JackettIndexer } from '@/components/services/jackett/JackettApi';
import type { ServiceInstance } from '@/lib/api';

export function JackettStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('jackett');
  const Icon = getServiceIcon('jackett');
  const { data, isLoading } = useServiceProxy<JackettIndexer[]>(instance, {
    path: JACKETT_INDEXERS_PATH,
    query: { configured: 'true' },
    refetchInterval: 60_000,
  });

  if (!isLoading && !data?.ok) return null;

  const indexers = data?.ok && Array.isArray(data.data) ? data.data : [];
  const errorCount = indexers.filter((ix) => !!ix.last_error).length;
  const blockedByLogin = data?.ok && typeof data.data === 'string';

  return (
    <motion.button
      type="button"
      onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: 'jackett' } })}
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
          {isLoading ? 'Connecting…' : blockedByLogin ? 'Sign-in required for indexer list' : `${indexers.length} indexer${indexers.length === 1 ? '' : 's'} configured`}
        </p>
      </div>
      {errorCount > 0 && (
        <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
          {errorCount} error{errorCount === 1 ? '' : 's'}
        </span>
      )}
    </motion.button>
  );
}
