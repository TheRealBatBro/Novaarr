import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type ServiceStatus = 'online' | 'offline' | 'unknown' | 'off';

const COLOR: Record<ServiceStatus, string> = {
  online: 'bg-success',
  offline: 'bg-destructive',
  unknown: 'bg-muted-foreground',
  off: 'bg-muted-foreground/50',
};

export function StatusDot({ status }: { status: ServiceStatus }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === 'online' && (
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-success"
          animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', COLOR[status])} />
    </span>
  );
}
