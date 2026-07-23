import { useState } from 'react';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { TautulliAreaChart, TautulliStackedBarChart, type ChartSeries } from './TautulliChart';
import type { ServiceInstance } from '@/lib/api';

type PlaysGraphResponse = { response?: { result: string; data?: { categories: string[]; series: { name: string; data: number[] }[] } } };

const TV_COLOR = '#38bdf8';
const MOVIES_COLOR = '#f59e0b';
const TOTAL_COLOR = '#94a3b8';

const RANGES = ['7', '30', '90'] as const;
const RANGE_LABEL: Record<(typeof RANGES)[number], string> = { '7': 'Last Week', '30': 'Last Month', '90': 'Last 3 Months' };

function colorFor(name: string): string {
  if (name === 'TV') return TV_COLOR;
  if (name === 'Movies') return MOVIES_COLOR;
  return TOTAL_COLOR;
}

function GraphCard({ instance, cmd, timeRange, title, subtitle, type }: { instance: ServiceInstance; cmd: string; timeRange: string; title: string; subtitle: string; type: 'area' | 'bar' }) {
  const { data, isLoading } = useServiceProxy<PlaysGraphResponse>(instance, {
    path: '/api/v2',
    query: { cmd, time_range: timeRange },
    refetchInterval: false,
  });

  const graph = data?.data?.response?.data;
  const categories = graph?.categories ?? [];
  const series: ChartSeries[] = (graph?.series ?? []).filter((s) => type === 'bar' ? s.name !== 'Total' : true).map((s) => ({ name: s.name, color: colorFor(s.name), data: s.data }));

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
      <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>
      {isLoading && <Skeleton className="h-[220px] w-full rounded-lg" />}
      {!isLoading && categories.length === 0 && <p className="text-sm text-muted-foreground">No data for this period.</p>}
      {!isLoading && categories.length > 0 && (type === 'area' ? <TautulliAreaChart categories={categories} series={series} /> : <TautulliStackedBarChart categories={categories} series={series} />)}
    </div>
  );
}

export function TautulliGraphsTab({ instance }: { instance: ServiceInstance }) {
  const [timeRange, setTimeRange] = useState<(typeof RANGES)[number]>('30');

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Visualized Stats</h2>
          <p className="text-sm text-muted-foreground">By the specified type…</p>
        </div>
        <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value as (typeof RANGES)[number])} className="w-40 shrink-0">
          {RANGES.map((r) => (
            <option key={r} value={r}>
              {RANGE_LABEL[r]}
            </option>
          ))}
        </Select>
      </div>

      <GraphCard instance={instance} cmd="get_plays_by_date" timeRange={timeRange} title="Plays by day" subtitle={`Within the past ${timeRange} days`} type="area" />
      <GraphCard instance={instance} cmd="get_plays_per_month" timeRange="6" title="Plays by month" subtitle="Within the past 6 months" type="bar" />
      <GraphCard instance={instance} cmd="get_plays_by_dayofweek" timeRange={timeRange} title="Plays by day of week" subtitle={`Within the past ${timeRange} days`} type="bar" />
    </div>
  );
}
