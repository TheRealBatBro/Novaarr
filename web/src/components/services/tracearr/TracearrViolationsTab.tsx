import { useState } from 'react';
import { AlertTriangle, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { cn, timeAgo } from '@/lib/utils';
import { SEVERITY_LABEL, type TracearrViolation } from './TracearrShared';
import type { ServiceInstance } from '@/lib/api';

type ViolationsResponse = { data?: TracearrViolation[]; meta?: { total: number } };

const SEVERITIES = ['all', 'high', 'warning', 'low'] as const;
const STATUSES = ['all', 'pending', 'acknowledged'] as const;

const SEVERITY_TONE: Record<string, string> = {
  high: 'bg-destructive/15 text-destructive',
  warning: 'bg-amber-500/15 text-amber-500',
  low: 'bg-primary/15 text-primary',
};

function FilterRow<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="w-14 shrink-0 text-sm text-muted-foreground">{label}:</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
              value === o ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TracearrViolationsTab({ instance }: { instance: ServiceInstance }) {
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('all');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');

  const { data, isLoading } = useServiceProxy<ViolationsResponse>(instance, {
    path: '/api/v1/public/violations',
    query: {
      pageSize: '50',
      ...(severity !== 'all' ? { severity } : {}),
      ...(status !== 'all' ? { acknowledged: String(status === 'acknowledged') } : {}),
    },
    refetchInterval: false,
  });

  const violations = data?.data?.data ?? [];
  const total = data?.data?.meta?.total ?? violations.length;

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
        Rule Violations <span className="rounded-full bg-muted px-2 py-0.5 text-sm font-medium text-muted-foreground">{total}</span>
      </h2>

      <FilterRow label="Severity" options={SEVERITIES} value={severity} onChange={setSeverity} />
      <FilterRow label="Status" options={STATUSES} value={status} onChange={setStatus} />

      <div className="mt-4 flex flex-col gap-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        {!isLoading && violations.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No violations found.</p>
          </div>
        )}
        {violations.map((v) => (
          <div key={v.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
                {v.user?.avatarUrl ? <img src={v.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4 text-muted-foreground" />}
              </div>
              <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card', v.acknowledged ? 'bg-success' : 'bg-primary')} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{v.rule.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {v.user?.username ?? 'Unknown user'} · {v.serverName}
              </p>
              <p className="text-xs text-muted-foreground">{timeAgo(v.createdAt)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', SEVERITY_TONE[v.severity])}>{SEVERITY_LABEL[v.severity]}</span>
              {v.acknowledged && <span className="text-xs font-medium text-success">Acknowledged</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
