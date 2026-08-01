import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getServiceIcon } from '@/lib/serviceIcons';
import { cn } from '@/lib/utils';
import { useResetScrollOnChange } from '@/lib/useResetScrollOnChange';
import type { ServiceInstance } from '@/lib/api';
import { UnraidSystemTab } from './UnraidSystemTab';
import { UnraidArrayTab } from './UnraidArrayTab';
import { UnraidDockerTab } from './UnraidDockerTab';
import { UnraidVmsTab } from './UnraidVmsTab';
import { UnraidNotificationsDialog, useUnraidUnreadCount } from './UnraidNotificationsDialog';

const Icon = getServiceIcon('unraid');
const TABS = ['system', 'array', 'docker', 'vms'] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = { system: 'System', array: 'Array', docker: 'Docker', vms: 'VMs' };

export function UnraidScreen({ instance }: { instance: ServiceInstance }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('system');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  useResetScrollOnChange(tab);
  const unread = useUnraidUnreadCount(instance);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#f15a2c22', color: '#f15a2c' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
          <p className="text-sm text-muted-foreground">Server management</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="icon" className="relative" aria-label="Notifications" onClick={() => setNotificationsOpen(true)}>
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
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

      {tab === 'system' && <UnraidSystemTab instance={instance} />}
      {tab === 'array' && <UnraidArrayTab instance={instance} />}
      {tab === 'docker' && <UnraidDockerTab instance={instance} />}
      {tab === 'vms' && <UnraidVmsTab instance={instance} />}

      <UnraidNotificationsDialog instance={instance} open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </div>
  );
}
