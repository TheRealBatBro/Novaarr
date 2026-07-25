import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import type { OmbiRequestCount } from '@/components/services/ombi/OmbiShared';
import type { ServiceInstance } from '@/lib/api';

export function OmbiStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('ombi');
  const Icon = getServiceIcon('ombi');
  const { data, isLoading } = useServiceProxy<OmbiRequestCount>(instance, {
    path: '/api/v1/Request/count',
    refetchInterval: 15000,
  });

  if (!isLoading && !data?.ok) return null;

  const count = data?.data;

  return (
    <motion.button
      type="button"
      onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: 'ombi' } })}
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
            {count ? `${count.pending} pending · ${count.approved} approved · ${count.available} available` : 'Connecting…'}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
