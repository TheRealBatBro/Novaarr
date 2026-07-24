import { useState } from 'react';
import { WolButton } from '@/components/shared/WolButton';
import { getServiceIcon } from '@/lib/serviceIcons';
import { cn } from '@/lib/utils';
import { useResetScrollOnChange } from '@/lib/useResetScrollOnChange';
import type { ServiceInstance } from '@/lib/api';
import { TracearrDashboardTab } from './TracearrDashboardTab';
import { TracearrActivityTab } from './TracearrActivityTab';
import { TracearrUsersTab } from './TracearrUsersTab';
import { TracearrViolationsTab } from './TracearrViolationsTab';
import { TracearrHistoryTab } from './TracearrHistoryTab';

const Icon = getServiceIcon('tracearr');
const TABS = ['dashboard', 'activity', 'users', 'violations', 'history'] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = {
  dashboard: 'Dashboard',
  activity: 'Activity',
  users: 'Users',
  violations: 'Violations',
  history: 'History',
};

export function TracearrScreen({ instance }: { instance: ServiceInstance }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('dashboard');
  useResetScrollOnChange(tab);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#2196f322', color: '#2196f3' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
          <p className="text-sm text-muted-foreground">Streaming access manager</p>
        </div>
        <WolButton wolMac={instance.wolMac} wolBroadcast={instance.wolBroadcast} className="ml-auto" />
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              tab === t ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <TracearrDashboardTab instance={instance} />}
      {tab === 'activity' && <TracearrActivityTab instance={instance} />}
      {tab === 'users' && <TracearrUsersTab instance={instance} />}
      {tab === 'violations' && <TracearrViolationsTab instance={instance} />}
      {tab === 'history' && <TracearrHistoryTab instance={instance} />}
    </div>
  );
}
