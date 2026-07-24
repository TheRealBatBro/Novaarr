import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import { rpcBody, statusLabel, type NzbGroup, type NzbStatus } from '@/components/services/nzbget/NzbgetShared';
import type { ServiceInstance } from '@/lib/api';

type NzbgetGroupsResp = { result?: NzbGroup[] };
type NzbgetStatusResp = { result?: NzbStatus };

export function NzbgetStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('nzbget');
  const Icon = getServiceIcon('nzbget');
  const { data, isLoading } = useServiceProxy<NzbgetGroupsResp>(instance, {
    path: '/jsonrpc',
    method: 'POST',
    body: rpcBody('listgroups', [0]),
    refetchInterval: 8000,
  });
  const { data: statusResp } = useServiceProxy<NzbgetStatusResp>(instance, {
    path: '/jsonrpc',
    method: 'POST',
    body: rpcBody('status'),
    refetchInterval: 8000,
  });

  if (!isLoading && !data?.ok) return null;

  const groups = data?.data?.result ?? [];
  const nzbStatus = statusResp?.data?.result;
  const speedKBs = nzbStatus?.DownloadRate !== undefined ? nzbStatus.DownloadRate / 1024 : 0;
  const first = groups[0];
  const pct = first && first.FileSizeMB > 0 ? ((first.FileSizeMB - first.RemainingSizeMB) / first.FileSizeMB) * 100 : 0;

  return (
    <motion.button
      type="button"
      onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: 'nzbget' } })}
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
            {nzbStatus ? `${nzbStatus.DownloadPaused ? 'Paused' : 'Downloading'} · ${speedKBs.toFixed(0)} KB/s · ${groups.length} in queue` : 'Connecting…'}
          </p>
        </div>
      </div>
      {first && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate pr-2">{first.NZBName}</span>
            <span className="shrink-0">{statusLabel(first.Status)}</span>
          </div>
          <ProgressBar value={pct} />
        </div>
      )}
    </motion.button>
  );
}
