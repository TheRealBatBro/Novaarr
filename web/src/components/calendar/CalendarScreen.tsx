import { CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy, useServices } from '@/lib/queries';

type SonarrCalItem = {
  id: number;
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  airDateUtc: string;
  hasFile: boolean;
  series?: { title: string };
};

type RadarrCalItem = {
  id: number;
  title: string;
  hasFile: boolean;
  inCinemas?: string;
  physicalRelease?: string;
  digitalRelease?: string;
};

type CalEntry = {
  key: string;
  date: string;
  title: string;
  subtitle: string;
  hasFile: boolean;
  color: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateHeader(dateStr: string): string {
  const today = isoDate(new Date());
  const tomorrow = isoDate(new Date(Date.now() + DAY_MS));
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function CalendarScreen() {
  const { data: instances = [], isLoading: instancesLoading } = useServices();
  const sonarr = instances.find((i) => i.serviceId === 'sonarr');
  const radarr = instances.find((i) => i.serviceId === 'radarr');

  const start = isoDate(new Date());
  const end = isoDate(new Date(Date.now() + 13 * DAY_MS));

  const sonarrQuery = useServiceProxy<SonarrCalItem[]>(sonarr, {
    path: '/api/v3/calendar',
    query: { start, end, includeSeries: 'true' },
    refetchInterval: 60_000,
  });
  const radarrQuery = useServiceProxy<RadarrCalItem[]>(radarr, {
    path: '/api/v3/calendar',
    query: { start, end },
    refetchInterval: 60_000,
  });

  const isLoading = instancesLoading || (!!sonarr && sonarrQuery.isLoading) || (!!radarr && radarrQuery.isLoading);

  const entries: CalEntry[] = [];
  for (const ep of sonarrQuery.data?.data ?? []) {
    entries.push({
      key: `s-${ep.id}`,
      date: (ep.airDateUtc ?? '').slice(0, 10),
      title: ep.series?.title ?? 'Unknown series',
      subtitle: `S${ep.seasonNumber}E${ep.episodeNumber} · ${ep.title}`,
      hasFile: ep.hasFile,
      color: '#365fe0',
    });
  }
  for (const movie of radarrQuery.data?.data ?? []) {
    const date = movie.digitalRelease ?? movie.physicalRelease ?? movie.inCinemas;
    if (!date) continue;
    entries.push({
      key: `r-${movie.id}`,
      date: date.slice(0, 10),
      title: movie.title,
      subtitle: movie.digitalRelease ? 'Digital release' : movie.physicalRelease ? 'Physical release' : 'In cinemas',
      hasFile: movie.hasFile,
      color: '#f5b942',
    });
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));

  const groups: { date: string; items: CalEntry[] }[] = [];
  for (const entry of entries) {
    const group = groups[groups.length - 1];
    if (group && group.date === entry.date) group.items.push(entry);
    else groups.push({ date: entry.date, items: [entry] });
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <CalendarDays className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Upcoming episodes &amp; releases, next 2 weeks</p>
        </div>
      </div>

      {!sonarr && !radarr && !instancesLoading && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Add Sonarr or Radarr in Settings to see upcoming episodes and movie releases here.
          </CardContent>
        </Card>
      )}

      {(sonarr || radarr) && isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {(sonarr || radarr) && !isLoading && groups.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Nothing airing or releasing in the next two weeks.</CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.date}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{dateHeader(group.date)}</h2>
            <div className="flex flex-col gap-2">
              {group.items.map((item) => (
                <div key={item.key} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                  <div className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                  {item.hasFile && <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">Have it</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
