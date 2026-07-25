import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot, type ServiceStatus } from '@/components/dashboard/StatusDot';
import { WolButton } from '@/components/shared/WolButton';
import { useServiceProxy } from '@/lib/queries';
import { getServiceIcon } from '@/lib/serviceIcons';
import { cn } from '@/lib/utils';
import { useResetScrollOnChange } from '@/lib/useResetScrollOnChange';
import type { ServiceInstance } from '@/lib/api';
import { SickbeardShowDialog } from './SickbeardShowDialog';
import { statusTone, type SbComingEpisodes, type SbHistoryItem, type SbResponse, type SbShow } from './SickbeardShared';

const Icon = getServiceIcon('sickbeard');
const TABS = ['shows', 'coming', 'history'] as const;
type Tab = (typeof TABS)[number];

const TONE_CLASS: Record<string, string> = {
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  destructive: 'bg-destructive/15 text-destructive',
};

const COMING_GROUP_LABEL: Record<string, string> = { missed: 'Missed', today: 'Today', soon: 'Soon', later: 'Later' };

export function SickbeardScreen({ instance }: { instance: ServiceInstance }) {
  const [tab, setTab] = useState<Tab>('shows');
  useResetScrollOnChange(tab);
  const [openShow, setOpenShow] = useState<SbShow | null>(null);

  const { data, isLoading } = useServiceProxy<SbResponse<Record<string, SbShow>>>(instance, {
    path: '',
    query: { cmd: 'shows', sort: 'name' },
    refetchInterval: 30_000,
  });
  const { data: comingResp, isLoading: comingLoading } = useServiceProxy<SbResponse<SbComingEpisodes>>(instance, {
    path: '',
    query: { cmd: 'future' },
    refetchInterval: 60_000,
    enabled: tab === 'coming',
  });
  const { data: historyResp, isLoading: historyLoading } = useServiceProxy<SbResponse<SbHistoryItem[]>>(instance, {
    path: '',
    query: { cmd: 'history', limit: '50' },
    refetchInterval: 30_000,
    enabled: tab === 'history',
  });

  const status: ServiceStatus = isLoading ? 'unknown' : data?.ok && data.data?.result === 'success' ? 'online' : 'offline';
  const denied = data?.ok && data.data?.result === 'denied';
  const shows = Object.values(data?.data?.data ?? {}).sort((a, b) => a.show_name.localeCompare(b.show_name));
  const coming = comingResp?.data?.data;
  const history = historyResp?.data?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#6fbe4422', color: '#6fbe44' }}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{instance.displayName}</h1>
            <StatusDot status={status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {denied ? 'API key rejected or API disabled in Sick Beard' : status === 'offline' ? 'Unreachable' : `${shows.length} shows`}
          </p>
        </div>
        <WolButton wolMac={instance.wolMac} wolBroadcast={instance.wolBroadcast} className="ml-auto" />
      </div>

      <div className="mb-4 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
              tab === t ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {t === 'coming' ? 'Coming Episodes' : t}
          </button>
        ))}
      </div>

      {tab === 'shows' && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            {!isLoading && shows.length === 0 && <p className="text-sm text-muted-foreground">{denied ? 'Check the API key and that "Use API" is enabled in Sick Beard.' : 'No shows found.'}</p>}
            {shows.map((show) => (
              <button
                key={show.tvdbid}
                type="button"
                onClick={() => setOpenShow(show)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{show.show_name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('rounded-full px-1.5 py-0.5 font-medium', show.status === 'Continuing' ? TONE_CLASS.success : TONE_CLASS.muted)}>
                      {show.status}
                    </span>
                    {show.network && <span>{show.network}</span>}
                    {show.next_ep_airdate && <span>· Next: {show.next_ep_airdate}</span>}
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'coming' && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4">
            {comingLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            {!comingLoading && (['missed', 'today', 'soon', 'later'] as const).map((group) => {
              const items = coming?.[group] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{COMING_GROUP_LABEL[group]}</p>
                  <div className="flex flex-col gap-1.5">
                    {items.map((ep, i) => (
                      <div key={`${ep.tvdbid}-${ep.season}-${ep.episode}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {ep.show_name} <span className="font-normal text-muted-foreground">S{ep.season}E{ep.episode}</span>
                          </p>
                          {ep.ep_name && <p className="truncate text-xs text-muted-foreground">{ep.ep_name}</p>}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{ep.airdate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {!comingLoading && Object.values(coming ?? {}).every((v) => !v || v.length === 0) && (
              <p className="text-sm text-muted-foreground">No upcoming episodes.</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            {historyLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            {!historyLoading && history.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
            {history.map((item, i) => {
              const tone = statusTone(item.status);
              return (
                <div key={`${item.tvdbid}-${item.date}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {item.show_name} <span className="font-normal text-muted-foreground">S{item.season}E{item.episode}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{item.date}</p>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium', TONE_CLASS[tone])}>{item.status}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {openShow && <SickbeardShowDialog instance={instance} show={openShow} onClose={() => setOpenShow(null)} />}
    </div>
  );
}
