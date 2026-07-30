import { User } from 'lucide-react';
import { useServices } from '@/lib/queries';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import {
  useRadarrCarousel,
  useSonarrRecentCarousel,
  useSonarrUpcomingCarousel,
  useOverseerrCarousel,
  useTraktCarousel,
  useTautulliRecentCarousel,
  useTautulliRecentlyAddedCarousel,
  usePlexRecommendationsCarousel,
  usePlexRecentlyAddedCarousel,
  usePlexCollectionsCarousel,
  useEmbyfinRecentlyAddedCarousel,
  useEmbyfinCollectionsCarousel,
  useTautulliUsers,
  WIDGET_CATALOG,
  parseWidgetKey,
  type WidgetSource,
  type EmbyfinKind,
} from '@/lib/dashboardWidgets';
import { useUiStore } from '@/stores/useUiStore';
import { Select } from '@/components/ui/select';
import type { ServiceInstance } from '@/lib/api';
import { DashboardCarousel } from './DashboardCarousel';
import { SabnzbdStatusWidget } from './SabnzbdStatusWidget';
import { OverseerrSearchWidget } from './OverseerrSearchWidget';
import { TautulliStatusWidget } from './TautulliStatusWidget';
import { TracearrStatusWidget } from './TracearrStatusWidget';
import { TracearrViolationsWidget } from './TracearrViolationsWidget';
import { PlexLibraryStatsWidget } from './PlexLibraryStatsWidget';
import { EmbyfinLibraryStatsWidget } from './EmbyfinLibraryStatsWidget';
import { ProwlarrStatusWidget } from './ProwlarrStatusWidget';
import { NzbHydra2StatusWidget } from './NzbHydra2StatusWidget';
import { UnraidStatusWidget } from './UnraidStatusWidget';
import { JackettStatusWidget } from './JackettStatusWidget';
import { NzbgetStatusWidget } from './NzbgetStatusWidget';
import { SickbeardStatusWidget } from './SickbeardStatusWidget';
import { OmbiStatusWidget } from './OmbiStatusWidget';
import { UtorrentStatusWidget } from './UtorrentStatusWidget';
import { DelugeStatusWidget } from './DelugeStatusWidget';
import { TransmissionStatusWidget } from './TransmissionStatusWidget';
import { QBittorrentStatusWidget } from './QBittorrentStatusWidget';
import { RutorrentStatusWidget } from './RutorrentStatusWidget';

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
function TautulliRecentlyAdded({ instance, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useTautulliRecentlyAddedCarousel(instance);
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} {...result} />;
}
function PlexRecentlyAdded({ instance, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = usePlexRecentlyAddedCarousel(instance);
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} {...result} />;
}
function PlexCollections({ instance, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = usePlexCollectionsCarousel(instance);
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} {...result} />;
}
function EmbyfinRecentlyAdded({ instance, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useEmbyfinRecentlyAddedCarousel(instance, sourceId as EmbyfinKind);
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} {...result} />;
}
function EmbyfinCollections({ instance, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const result = useEmbyfinCollectionsCarousel(instance, sourceId as EmbyfinKind);
  return <DashboardCarousel title={title} sourceId={sourceId} sourceLabel={sourceLabel} sourceColor={sourceColor} {...result} />;
}
function TautulliRecommendations({ instance, overseerr, sourceId, title, sourceLabel, sourceColor }: SourceProps) {
  const users = useTautulliUsers(instance);
  const { plexRecommendationUserId, setPlexRecommendationUserId, plexRecommendationRefreshMinutes } = useUiStore();
  const activeUserId = plexRecommendationUserId && users.some((u) => String(u.user_id) === plexRecommendationUserId) ? plexRecommendationUserId : undefined;
  const result = usePlexRecommendationsCarousel(instance, overseerr, activeUserId, plexRecommendationRefreshMinutes);
  const heading = result.seed ? `Because you watched ${result.seed.title}${result.seed.extraCount > 0 ? ` & ${result.seed.extraCount} more` : ''}` : title;

  // Mirrors DashboardCarousel's own hide condition — otherwise the user-picker row above it
  // would render alone with no carousel beneath once the carousel decides there's nothing to show.
  if (!result.isLoading && result.items.length === 0 && !result.error) return null;

  return (
    <div>
      {users.length > 0 && (
        <div className="mb-2 flex items-center justify-end gap-2">
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
        </div>
      )}
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
  'tautulli-recently-added': TautulliRecentlyAdded,
  'plex-recently-added': PlexRecentlyAdded,
  'plex-collections': PlexCollections,
  'emby-recently-added': EmbyfinRecentlyAdded,
  'emby-collections': EmbyfinCollections,
  'jellyfin-recently-added': EmbyfinRecentlyAdded,
  'jellyfin-collections': EmbyfinCollections,
};

export function DashboardWidget({ widgetKey }: { widgetKey: string }) {
  const { baseKey, instanceId } = parseWidgetKey(widgetKey);
  const def = WIDGET_CATALOG.find((w) => w.key === baseKey);
  const { data: instances = [] } = useServices();

  if (!def) return null;

  const bySource: Record<WidgetSource, ServiceInstance[]> = {
    radarr: [], sonarr: [], overseerr: [], trakt: [], sabnzbd: [], tautulli: [], tracearr: [], plex: [],
    emby: [], jellyfin: [],
    prowlarr: [], nzbhydra2: [], unraid: [], jackett: [], nzbget: [], sickbeard: [], ombi: [], utorrent: [],
    deluge: [], transmission: [], qbittorrent: [], rutorrent: [],
  };
  for (const i of instances) {
    if (i.serviceId in bySource) bySource[i.serviceId as WidgetSource].push(i);
  }
  // An `@instanceId`-suffixed key (see instanceWidgetCatalog) targets that specific instance;
  // a plain key keeps today's exact behavior — the first/default instance of the source.
  const instance = instanceId !== undefined ? instances.find((i) => i.id === instanceId) : bySource[def.source][0];
  if (!instance || !instance.enabled) return null;

  if (def.kind === 'status') {
    if (def.source === 'sabnzbd') return <SabnzbdStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'tautulli') return <TautulliStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'tracearr') return <TracearrStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'prowlarr') return <ProwlarrStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'nzbhydra2') return <NzbHydra2StatusWidget instance={instance} title={def.title} />;
    if (def.source === 'jackett') return <JackettStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'nzbget') return <NzbgetStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'unraid') return <UnraidStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'sickbeard') return <SickbeardStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'ombi') return <OmbiStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'utorrent') return <UtorrentStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'deluge') return <DelugeStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'transmission') return <TransmissionStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'qbittorrent') return <QBittorrentStatusWidget instance={instance} title={def.title} />;
    if (def.source === 'rutorrent') return <RutorrentStatusWidget instance={instance} title={def.title} />;
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

  if (def.kind === 'stats') {
    if (def.source === 'plex') return <PlexLibraryStatsWidget instance={instance} title={def.title} />;
    if (def.source === 'emby' || def.source === 'jellyfin') return <EmbyfinLibraryStatsWidget instance={instance} title={def.title} kind={def.source} />;
    return null;
  }

  const Component = WIDGET_COMPONENTS[baseKey];
  if (!Component) return null;

  const sourceDef = getServiceDefinition(def.source);
  return (
    <Component
      instance={instance}
      overseerr={bySource.overseerr[0]}
      sourceId={def.source}
      title={def.title}
      sourceLabel={`From ${instance.displayName}`}
      sourceColor={sourceDef?.brandColor ?? '#888'}
    />
  );
}
