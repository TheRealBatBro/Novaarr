import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function ProgressBar({
  value,
  indeterminate,
  className,
}: {
  value?: number;
  indeterminate?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      {indeterminate ? (
        <motion.div
          className="h-full w-1/3 rounded-full bg-primary"
          animate={{ x: ['-120%', '340%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        />
      )}
    </div>
  );
}
