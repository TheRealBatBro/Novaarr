import { motion } from 'framer-motion';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useBazarrWantedCount } from '@/components/services/arr/BazarrSubtitles';
import type { ServiceInstance } from '@/lib/api';

export function BazarrWantedWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const definition = getServiceDefinition('bazarr');
  const Icon = getServiceIcon('bazarr');
  const { count, isLoading, ok } = useBazarrWantedCount(instance);

  if (!isLoading && !ok) return null;

  return (
    <motion.div
      className="mb-8 flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
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
          {count === undefined ? 'Loading…' : count === 0 ? 'Nothing wanted' : `${count} item${count === 1 ? '' : 's'} missing subtitles`}
        </p>
      </div>
      {count !== undefined && count > 0 && (
        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-sm font-bold tabular-nums text-primary">{count}</span>
      )}
    </motion.div>
  );
}
