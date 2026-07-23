import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, User } from 'lucide-react';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServiceProxy } from '@/lib/queries';
import { cn, timeAgo } from '@/lib/utils';
import { SEVERITY_LABEL, type TracearrViolation } from '@/components/services/tracearr/TracearrShared';
import type { ServiceInstance } from '@/lib/api';

type ViolationsResponse = { data?: TracearrViolation[] };

const SEVERITY_TONE: Record<string, string> = {
  high: 'bg-destructive/15 text-destructive',
  warning: 'bg-amber-500/15 text-amber-500',
  low: 'bg-primary/15 text-primary',
};

export function TracearrViolationsWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const definition = getServiceDefinition('tracearr');
  const Icon = getServiceIcon('tracearr');
  const { data, isLoading } = useServiceProxy<ViolationsResponse>(instance, {
    path: '/api/v1/public/violations',
    query: { pageSize: '3', acknowledged: 'false' },
    refetchInterval: (instance.refreshIntervalMinutes ?? 15) * 60_000,
  });

  if (!isLoading && !data?.ok) return null;
  const violations = data?.data?.data ?? [];

  return (
    <div className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <button
        type="button"
        onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: 'tracearr' } })}
        className="mb-3 flex w-full items-center gap-3 text-left"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${definition?.brandColor}22`, color: definition?.brandColor }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <p className="truncate text-sm font-semibold">{title}</p>
      </button>

      {violations.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-muted-foreground/50" />
          No unacknowledged violations
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {violations.map((v) => (
            <div key={v.id} className="flex items-center gap-2.5 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                {v.user?.avatarUrl ? <img src={v.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <User className="h-3.5 w-3.5 text-muted-foreground" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-tight">{v.rule.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {v.user?.username ?? 'Unknown user'} · {timeAgo(v.createdAt)}
                </p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', SEVERITY_TONE[v.severity])}>{SEVERITY_LABEL[v.severity]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
