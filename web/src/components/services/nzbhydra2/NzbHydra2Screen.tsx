import { useState } from 'react';
import { getServiceIcon } from '@/lib/serviceIcons';
import { cn } from '@/lib/utils';
import { useResetScrollOnChange } from '@/lib/useResetScrollOnChange';
import type { ServiceInstance } from '@/lib/api';
import { NzbHydra2IndexersTab } from './NzbHydra2IndexersTab';
import { NzbHydra2SearchTab } from './NzbHydra2SearchTab';

const Icon = getServiceIcon('nzbhydra2');
const TABS = ['search', 'indexers'] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = { search: 'Search', indexers: 'Indexers' };

export function NzbHydra2Screen({ instance }: { instance: ServiceInstance }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('search');
  useResetScrollOnChange(tab);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#4caf5022', color: '#4caf50' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
          <p className="text-sm text-muted-foreground">Indexer manager</p>
        </div>
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

      {tab === 'search' && <NzbHydra2SearchTab instance={instance} />}
      {tab === 'indexers' && <NzbHydra2IndexersTab instance={instance} />}
    </div>
  );
}
