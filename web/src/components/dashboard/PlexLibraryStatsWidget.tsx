import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Film, Tv, Music, Folder, RefreshCw } from 'lucide-react';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { usePlexLibraryStats } from '@/lib/dashboardWidgets';
import { cn } from '@/lib/utils';
import type { ServiceInstance } from '@/lib/api';

const TYPE_ICON: Record<string, typeof Film> = { movie: Film, show: Tv, artist: Music };

export function PlexLibraryStatsWidget({ instance, title }: { instance: ServiceInstance; title: string }) {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const definition = getServiceDefinition('plex');
  const Icon = getServiceIcon('plex');
  const { stats, isLoading, error, refetch } = usePlexLibraryStats(instance);

  if (!isLoading && stats.length === 0 && !error) return null;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
      toast.success(`${title} refreshed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate({ to: '/service/$serviceId', params: { serviceId: 'plex' } })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${definition?.brandColor}22`, color: definition?.brandColor }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <p className="truncate text-sm font-semibold">{title}</p>
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label={`Refresh ${title}`}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {error && stats.length === 0 ? (
        <p className="text-sm text-destructive">Couldn't load — {error}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((s) => {
            const StatIcon = TYPE_ICON[s.type] ?? Folder;
            return (
              <div key={s.key} className="rounded-xl border border-border bg-background/40 p-3">
                <StatIcon className="mb-1 h-4 w-4 text-muted-foreground" />
                <p className="truncate text-xs text-muted-foreground">{s.title}</p>
                <p className="text-lg font-semibold tabular-nums">{s.count.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
