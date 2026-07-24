import { useState } from 'react';
import { User, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useServices } from '@/lib/queries';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import {
  useRadarrCarousel,
  useSonarrRecentCarousel,
  useSonarrUpcomingCarousel,
  useOverseerrCarousel,
  useTraktCarousel,
  useTautulliRecentCarousel,
  usePlexRecommendationsCarousel,
  useTautulliUsers,
  WIDGET_CATALOG,
  type WidgetSource,
} from '@/lib/dashboardWidgets';
import { useUiStore } from '@/stores/useUiStore';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ServiceInstance } from '@/lib/api';
import { DashboardCarousel } from './DashboardCarousel';
import { SabnzbdStatusWidget } from './SabnzbdStatusWidget';
import { OverseerrSearchWidget } from './OverseerrSearchWidget';
import { TautulliStatusWidget } from './TautulliStatusWidget';
import { TracearrStatusWidget } from './TracearrStatusWidget';
import { TracearrViolationsWidget } from './TracearrViolationsWidget';

type SourceProps = {
  instance: ServiceInstance;
  overseerr?: ServiceInstance;
  sourceId: string;
  title: string;
  sourceLabel: string;
  sourceColor: string;
};

function RadarrUpcoming({ instance, overseerr, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useRadarrCarousel(instance, 'upcoming');
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} sourceInstance={instance} overseerrInstance={overseerr} {...result} />;
}
function RadarrRecent({ instance, overseerr, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useRadarrCarousel(instance, 'recent');
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} sourceInstance={instance} overseerrInstance={overseerr} {...result} />;
}
function SonarrUpcoming({ instance, overseerr, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useSonarrUpcomingCarousel(instance);
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} sourceInstance={instance} overseerrInstance={overseerr} {...result} />;
}
function SonarrRecent({ instance, overseerr, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useSonarrRecentCarousel(instance);
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} sourceInstance={instance} overseerrInstance={overseerr} {...result} />;
}
function OverseerrTrending({ instance, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useOverseerrCarousel(instance, '/api/v1/discover/trending');
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} overseerrInstance={instance} {...result} />;
}
function OverseerrPopularMovies({ instance, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useOverseerrCarousel(instance, '/api/v1/discover/movies');
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} overseerrInstance={instance} {...result} />;
}
function OverseerrPopularTv({ instance, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useOverseerrCarousel(instance, '/api/v1/discover/tv');
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} overseerrInstance={instance} {...result} />;
}
function OverseerrUpcomingMovies({ instance, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useOverseerrCarousel(instance, '/api/v1/discover/movies/upcoming');
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} overseerrInstance={instance} {...result} />;
}
function TraktAnticipatedMovies({ instance, overseerr, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useTraktCarousel(instance, overseerr, '/movies/anticipated', 'movie');
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} overseerrInstance={overseerr} {...result} />;
}
function TraktTrendingMovies({ instance, overseerr, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useTraktCarousel(instance, overseerr, '/movies/trending', 'movie');
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} overseerrInstance={overseerr} {...result} />;
}
function TraktAnticipatedShows({ instance, overseerr, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useTraktCarousel(instance, overseerr, '/shows/anticipated', 'tv');
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} overseerrInstance={overseerr} {...result} />;
}
function TraktTrendingShows({ instance, overseerr, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useTraktCarousel(instance, overseerr, '/shows/trending', 'tv');
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} overseerrInstance={overseerr} {...result} />;
}
function TautulliRecent({ instance, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useTautulliRecentCarousel(instance);
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} {...result} />;
}
function TautulliRecommendations({ instance, overseerr, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const [refreshing, setRefreshing] = useState(false);
  const users = useTautulliUsers(instance);
  const { plexRecommendationUserId, setPlexRecommendationUserId, plexRecommendationRefreshMinutes } = useUiStore();
  const activeUserId = plexRecommendationUserId && users.some((u) => String(u.user_id) === plexRecommendationUserId) ? plexRecommendationUserId : undefined;
  const { refetch, ...result } = usePlexRecommendationsCarousel(instance, overseerr, activeUserId, plexRecommendationRefreshMinutes);
  const heading = result.seed ? `Because you watched ${result.seed.title}${result.seed.extraCount > 0 ? ` & ${result.seed.extraCount} more` : ''}` : title;

  // Mirrors DashboardCarousel's own hide condition — otherwise the header row above it would
  // render alone with no carousel beneath once the carousel decides there's nothing to show.
  if (!result.isLoading && result.items.length === 0 && !result.error) return null;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
      toast.success('Recommendations refreshed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh recommendations"
          title="Refresh recommendations"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
        {users.length > 0 && (
          <>
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Recommend for</span>
            <Select
              className="h-8 w-44 text-xs"
              value={plexRecommendationUserId ?? ''}
              onChange={(e) => setPlexRecommendationUserId(e.target.value || null)}
            >
              <option value="">Everyone's history</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.friendly_name || u.username}
                </option>
              ))}
            </Select>
          </>
        )}
      </div>
      <DashboardCarousel
        title={heading}
        sourceId={sourceId}
        sourceLabel={sourceLabel}
        sourceColor={sourceColor}
        overseerrInstance={overseerr}
        {...result}
      />
    </div>
  );
}

const WIDGET_COMPONENTS: Record<string, (props: SourceProps) => JSX.Element> = {
  'radarr-upcoming': RadarrUpcoming,
  'radarr-recent': RadarrRecent,
  'sonarr-upcoming': SonarrUpcoming,
  'sonarr-recent': SonarrRecent,
  'overseerr-trending': OverseerrTrending,
  'overseerr-popular-movies': OverseerrPopularMovies,
  'overseerr-popular-tv': OverseerrPopularTv,
  'overseerr-upcoming-movies': OverseerrUpcomingMovies,
  'trakt-anticipated-movies': TraktAnticipatedMovies,
  'trakt-trending-movies': TraktTrendingMovies,
  'trakt-anticipated-shows': TraktAnticipatedShows,
  'trakt-trending-shows': TraktTrendingShows,
  'tautulli-recent': TautulliRecent,
  'tautulli-recommendations': TautulliRecommendations,
};

export function DashboardWidget({ widgetKey }: { widgetKey: string }) {
  const def = WIDGET_CATALOG.find((w) => w.key === widgetKey);
  const { data: instances = [] } = useServices();

  if (!def) return null;

  const bySource: Record<WidgetSource, ServiceInstance | undefined> = {
    radarr: instances.find((i) => i.serviceId === 'radarr'),
    sonarr: instances.find((i) => i.serviceId === 'sonarr'),
    overseerr: instances.find((i) => i.serviceId === 'overseerr'),
    trakt: instances.find((i) => i.serviceId === 'trakt'),
    sabnzbd: instances.find((i) => i.serviceId === 'sabnzbd'),
    tautulli: instances.find((i) => i.serviceId === 'tautulli'),
    tracearr: instances.find((i) => i.serviceId === 'tracearr'),
  };
  const instance = bySource[def.source];
  if (!instance || !instance.enabled) return null;

  if (def.kind === 'status') {
    if (def.source === 'sabnzbd') return <SabnzbdStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'tautulli') return <TautulliStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'tracearr') return <TracearrStatusWidget instance={instance} title={def.title} />;
    return null;
  }

  if (def.kind === 'search') {
    if (def.source === 'overseerr') return <OverseerrSearchWidget instance={instance} title={def.title} />;
    return null;
  }

  if (def.kind === 'violations') {
    if (def.source === 'tracearr') return <TracearrViolationsWidget instance={instance} title={def.title} />;
    return null;
  }

  const Component = WIDGET_COMPONENTS[widgetKey];
  if (!Component) return null;

  const sourceDef = getServiceDefinition(def.source);
  return (
    <Component
      instance={instance}
      overseerr={bySource.overseerr}
      sourceId={def.source}
      title={def.title}
      sourceLabel={`From ${instance.displayName}`}
      sourceColor={sourceDef?.brandColor ?? '#888'}
    />
  );
}
