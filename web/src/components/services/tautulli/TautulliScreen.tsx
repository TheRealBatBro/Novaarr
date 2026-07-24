import { useState } from 'react';
import { WolButton } from '@/components/shared/WolButton';
import { getServiceIcon } from '@/lib/serviceIcons';
import { cn } from '@/lib/utils';
import { useResetScrollOnChange } from '@/lib/useResetScrollOnChange';
import type { ServiceInstance } from '@/lib/api';
import { TautulliActivityTab } from './TautulliActivityTab';
import { TautulliUsersTab } from './TautulliUsersTab';
import { TautulliHistoryTab } from './TautulliHistoryTab';
import { TautulliStatsTab } from './TautulliStatsTab';
import { TautulliGraphsTab } from './TautulliGraphsTab';

const Icon = getServiceIcon('tautulli');
const TABS = ['activity', 'users', 'history', 'stats', 'graphs'] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = { activity: 'Activity', users: 'Users', history: 'History', stats: 'Stats', graphs: 'Graphs' };

export function TautulliScreen({ instance }: { instance: ServiceInstance }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('activity');
  useResetScrollOnChange(tab);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#daa52022', color: '#daa520' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
          <p className="text-sm text-muted-foreground">Server activity & stats</p>
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

      {tab === 'activity' && <TautulliActivityTab instance={instance} />}
      {tab === 'users' && <TautulliUsersTab instance={instance} />}
      {tab === 'history' && <TautulliHistoryTab instance={instance} />}
      {tab === 'stats' && <TautulliStatsTab instance={instance} />}
      {tab === 'graphs' && <TautulliGraphsTab instance={instance} />}
    </div>
  );
}
