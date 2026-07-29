import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { ARRAY_QUERY, DOCKER_QUERY, NOTIFICATIONS_QUERY, useUnraidQuery, gqlData, kbToBytes } from '@/components/services/unraid/UnraidApi';
import type { ServiceInstance } from '@/lib/api';

type ArrayData = { array?: { capacity?: { kilobytes?: { used?: string; total?: string } } } };
type DockerData = { docker?: { containers?: { state?: string }[] } };
type NotificationsData = { notifications?: { overview?: { unread?: { total?: number } } } };

export function UnraidStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('unraid');
  const Icon = getServiceIcon('unraid');
  const { data, isLoading } = useUnraidQuery<ArrayData>(instance, ARRAY_QUERY, { refetchInterval: 60_000 });
  const { data: dockerResp } = useUnraidQuery<DockerData>(instance, DOCKER_QUERY, { refetchInterval: 30_000 });
  const { data: notifResp } = useUnraidQuery<NotificationsData>(instance, NOTIFICATIONS_QUERY, { refetchInterval: 60_000 });

  if (!isLoading && !data?.ok) return null;

  const cap = gqlData(data)?.array?.capacity?.kilobytes;
  const used = kbToBytes(cap?.used);
  const total = kbToBytes(cap?.total);
  const pct = total > 0 ? Math.round((used / total) * 100) : undefined;
  const containers = gqlData(dockerResp)?.docker?.containers ?? [];
  const running = containers.filter((c) => (c.state ?? '').toLowerCase() === 'running').length;
  const unread = gqlData(notifResp)?.notifications?.overview?.unread?.total ?? 0;

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
          {isLoading ? 'Connecting…' : [pct !== undefined ? `Array ${pct}%` : null, `${running} container${running === 1 ? '' : 's'} running`].filter(Boolean).join(' · ')}
        </p>
      </div>
      {unread > 0 && (
        <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
          {unread} notification{unread === 1 ? '' : 's'}
        </span>
      )}
    </motion.button>
  );
}
