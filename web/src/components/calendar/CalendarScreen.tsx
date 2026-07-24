import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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

const SONARR_COLOR = '#365fe0';
const RADARR_COLOR = '#f5b942';

function isoDate(d: Date): string {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return tz.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** The 6x7 grid of dates a month view needs — the Sunday on/before the 1st through the Saturday
 * on/after the last day, so partial leading/trailing weeks from adjacent months fill the grid. */
function monthGrid(viewMonth: Date): Date[] {
  const first = startOfMonth(viewMonth);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

export function CalendarScreen() {
  const { data: instances = [], isLoading: instancesLoading } = useServices();
  const sonarr = instances.find((i) => i.serviceId === 'sonarr');
  const radarr = instances.find((i) => i.serviceId === 'radarr');

  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(isoDate(today));

  const grid = useMemo(() => monthGrid(viewMonth), [viewMonth]);
  const rangeStart = isoDate(grid[0]);
  const rangeEnd = isoDate(grid[grid.length - 1]);

  const sonarrQuery = useServiceProxy<SonarrCalItem[]>(sonarr, {
    path: '/api/v3/calendar',
    query: { start: rangeStart, end: rangeEnd, includeSeries: 'true' },
    refetchInterval: 60_000,
  });
  const radarrQuery = useServiceProxy<RadarrCalItem[]>(radarr, {
    path: '/api/v3/calendar',
    query: { start: rangeStart, end: rangeEnd },
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
      color: SONARR_COLOR,
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
      color: RADARR_COLOR,
    });
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));

  const byDate = new Map<string, CalEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.date);
    if (list) list.push(entry);
    else byDate.set(entry.date, [entry]);
  }

  const selectedItems = byDate.get(selectedDate) ?? [];
  const todayIso = isoDate(today);
  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function goToToday() {
    setViewMonth(startOfMonth(today));
    setSelectedDate(todayIso);
  }

  function shiftMonth(delta: number) {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <CalendarDays className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Upcoming episodes &amp; releases</p>
        </div>
      </div>

      {!sonarr && !radarr && !instancesLoading && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Add Sonarr or Radarr in Settings to see upcoming episodes and movie releases here.
          </CardContent>
        </Card>
      )}

      {(sonarr || radarr) && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="w-40 text-center text-sm font-semibold">{monthLabel}</p>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className="mb-4 h-80 w-full rounded-xl" />
          ) : (
            <div className="mb-4 rounded-xl border border-border bg-card p-2">
              <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-medium text-muted-foreground">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {grid.map((d) => {
                  const iso = isoDate(d);
                  const inMonth = d.getMonth() === viewMonth.getMonth();
                  const isToday = iso === todayIso;
                  const isSelected = iso === selectedDate;
                  const dayEntries = byDate.get(iso) ?? [];
                  const colors = [...new Set(dayEntries.map((e) => e.color))].slice(0, 3);
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedDate(iso)}
                      className={cn(
                        'flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-sm transition-colors',
                        !inMonth && 'text-muted-foreground/40',
                        inMonth && !isToday && !isSelected && 'hover:bg-accent',
                        isToday && 'bg-primary text-primary-foreground font-semibold',
                        !isToday && isSelected && 'border-2 border-primary font-semibold',
                      )}
                    >
                      <span>{d.getDate()}</span>
                      <span className="flex h-1.5 items-center gap-0.5">
                        {colors.map((c) => (
                          <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isToday ? 'currentColor' : c }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {selectedDate === todayIso
              ? 'Today'
              : new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </h2>
          <div className="flex flex-col gap-2">
            {!isLoading && selectedItems.length === 0 && (
              <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">Nothing airing or releasing this day.</p>
            )}
            {selectedItems.map((item) => (
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
        </>
      )}
    </div>
  );
}
