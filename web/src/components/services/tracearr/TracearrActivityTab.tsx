import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { TautulliAreaChart, TautulliStackedBarChart } from '@/components/services/tautulli/TautulliChart';
import { TracearrDonut, TracearrHorizontalBars } from './TracearrCharts';
import type { ServiceInstance } from '@/lib/api';

type Bucket = { date: string; count: number };
type ConcurrentBucket = { date: string; total: number; direct: number; directStream: number; transcode: number };
type DowBucket = { day: number; name: string; count: number };
type HourBucket = { hour: number; count: number };
type PlatformRow = { platform: string | null; count: number };
type QualityBreakdown = { directPlay: number; directStream: number; transcode: number; total: number; directPlayPercent: number; directStreamPercent: number; transcodePercent: number };
type ActivityResponse = {
  plays: Bucket[];
  concurrent: ConcurrentBucket[];
  byDayOfWeek: DowBucket[];
  byHourOfDay: HourBucket[];
  platforms: PlatformRow[];
  quality: QualityBreakdown;
};

const PERIODS = ['week', 'month', 'year'] as const;
const PERIOD_LABEL: Record<(typeof PERIODS)[number], string> = { week: 'Week', month: 'Month', year: 'Year' };

function hourLabel(h: number): string {
  const period = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${period}`;
}

export function TracearrActivityTab({ instance }: { instance: ServiceInstance }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('week');
  const { data, isLoading } = useServiceProxy<ActivityResponse>(instance, {
    path: '/api/v1/public/activity',
    query: { period },
    refetchInterval: false,
  });

  const activity = data?.data;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[220px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!activity) return <p className="text-sm text-muted-foreground">No activity data.</p>;

  // Plays buckets are sparse (only non-zero entries); concurrent buckets are dense — use
  // concurrent's bucket list as the canonical x-axis and zero-fill plays onto it.
  const playsByDate = new Map(activity.plays.map((p) => [p.date, p.count]));
  const dateCategories = activity.concurrent.map((c) => c.date.replace(/\+00$/, '').slice(0, 10));
  const playsData = activity.concurrent.map((c) => playsByDate.get(c.date.replace(/\+00$/, '')) ?? 0);

  const quality = activity.quality;
  const donutSegments = [
    { label: 'Direct Play', value: quality.directPlay, percent: quality.directPlayPercent, color: '#22c55e' },
    { label: 'Direct Stream', value: quality.directStream, percent: quality.directStreamPercent, color: '#3b82f6' },
    { label: 'Transcode', value: quality.transcode, percent: quality.transcodePercent, color: '#f59e0b' },
  ];

  return (
    <div>
      <div className="mb-4 flex gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              period === p ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Plays Over Time</h3>
        <TautulliAreaChart categories={dateCategories} series={[{ name: 'Plays', color: '#38bdf8', data: playsData }]} />
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Concurrent Streams</h3>
        <TautulliAreaChart
          categories={dateCategories}
          series={[
            { name: 'Total', color: '#38bdf8', data: activity.concurrent.map((c) => c.total) },
            { name: 'Direct', color: '#22c55e', data: activity.concurrent.map((c) => c.direct) },
            { name: 'Transcode', color: '#f59e0b', data: activity.concurrent.map((c) => c.transcode) },
          ]}
        />
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Plays by Day</h3>
        <TautulliStackedBarChart
          categories={activity.byDayOfWeek.map((d) => d.name)}
          series={[{ name: 'Plays', color: '#38bdf8', data: activity.byDayOfWeek.map((d) => d.count) }]}
        />
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Stream Quality</h3>
        <TracearrDonut segments={donutSegments} />
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Peak Hours</h3>
        <TautulliStackedBarChart
          categories={activity.byHourOfDay.map((h) => hourLabel(h.hour))}
          series={[{ name: 'Plays', color: '#22c55e', data: activity.byHourOfDay.map((h) => h.count) }]}
        />
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Top Platforms</h3>
        <TracearrHorizontalBars rows={activity.platforms.slice(0, 8).map((p) => ({ label: p.platform ?? 'Unknown', value: p.count }))} />
      </div>
    </div>
  );
}
