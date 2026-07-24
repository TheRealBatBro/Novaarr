import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { SessionBackdrop, SessionDetails } from '@/components/shared/NowPlayingCard';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import {
  historyDisplayTitle,
  historySubtitle,
  sessionBackdrop,
  sessionPlayerLabel,
  sessionPoster,
  sessionQualityLabel,
  sessionRemaining,
  type TautulliSession,
} from '@/components/services/tautulli/TautulliShared';
import type { ServiceInstance } from '@/lib/api';

type TautulliActivity = { response?: { result: string; data?: { stream_count?: string; sessions?: TautulliSession[] } } };

export function TautulliStatusWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('tautulli');
  const Icon = getServiceIcon('tautulli');
  const { data, isLoading } = useServiceProxy<TautulliActivity>(instance, { path: '/api/v2', query: { cmd: 'get_activity' }, refetchInterval: 10000 });

  if (!isLoading && !(data?.ok && data.data?.response?.result === 'success')) return null;

  const activity = data?.data?.response?.data;
  const sessions = activity?.sessions ?? [];
  const first = sessions[0];

  return (
    <motion.button
      type="button"
      onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: 'tautulli' } })}
      className="relative mb-8 flex w-full flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
    >
      {first && <SessionBackdrop url={sessionBackdrop(instance, first)} />}
      <div className="relative z-10 flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${definition?.brandColor}22`, color: definition?.brandColor }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {sessions.length === 0 ? 'No active streams' : `${sessions.length} active stream${sessions.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
      {first && (
        <div className="relative z-10">
          <SessionDetails
            size="sm"
            posterUrl={sessionPoster(instance, first)}
            title={historyDisplayTitle(first)}
            subtitle={historySubtitle(first)}
            userLabel={first.friendly_name || first.user}
            state={first.state}
            meta={[sessionQualityLabel(first), sessionPlayerLabel(first)].filter(Boolean).join(' · ')}
            progressPercent={Number(first.progress_percent) || 0}
            remaining={sessionRemaining(first)}
          />
        </div>
      )}
    </motion.button>
  );
}
