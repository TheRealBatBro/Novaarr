import { createFileRoute, Link } from '@tanstack/react-router';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServices, resolveServiceParam } from '@/lib/queries';
import { GenericServiceScreen } from '@/components/services/generic/GenericServiceScreen';
import { SabnzbdScreen } from '@/components/services/sabnzbd/SabnzbdScreen';
import { ArrQueueScreen } from '@/components/services/arr/ArrQueueScreen';
import { QBittorrentScreen } from '@/components/services/qbittorrent/QBittorrentScreen';
import { TransmissionScreen } from '@/components/services/transmission/TransmissionScreen';
import { NzbgetScreen } from '@/components/services/nzbget/NzbgetScreen';
import { DelugeScreen } from '@/components/services/deluge/DelugeScreen';
import { IndexerSearchScreen } from '@/components/services/indexer/IndexerSearchScreen';
import { OverseerrScreen } from '@/components/services/overseerr/OverseerrScreen';
import { TautulliScreen } from '@/components/services/tautulli/TautulliScreen';
import { TracearrScreen } from '@/components/services/tracearr/TracearrScreen';
import { ProwlarrScreen } from '@/components/services/prowlarr/ProwlarrScreen';
import { NzbHydra2Screen } from '@/components/services/nzbhydra2/NzbHydra2Screen';
import { UnraidScreen } from '@/components/services/unraid/UnraidScreen';
import { JackettScreen } from '@/components/services/jackett/JackettScreen';
import { SickbeardScreen } from '@/components/services/sickbeard/SickbeardScreen';
import { OmbiScreen } from '@/components/services/ombi/OmbiScreen';
import { UtorrentScreen } from '@/components/services/utorrent/UtorrentScreen';
import { RutorrentScreen } from '@/components/services/rutorrent/RutorrentScreen';
import { BazarrScreen } from '@/components/services/bazarr/BazarrScreen';
import { OpenInFrameButton } from '@/components/services/OpenInFrameButton';

export const Route = createFileRoute('/service/$serviceId')({ component: ServiceDetail });

const ARR_V3 = new Set(['sonarr', 'radarr']);
const ARR_V1 = new Set(['lidarr', 'readarr']);
const TORZNAB = new Set(['newznab']);

function ServiceDetail() {
  const { serviceId } = Route.useParams();
  const { data: instances = [] } = useServices();
  // `serviceId` is dual-mode: a numeric instance row id (multiple instances of one service) or
  // the plain serviceId string (old links, and the common still-only-one-instance case).
  const instance = resolveServiceParam(instances, serviceId);
  const definition = getServiceDefinition(instance?.serviceId ?? serviceId);

  if (!definition) {
    return <p className="text-muted-foreground">Unknown service “{serviceId}”.</p>;
  }

  if (definition.hideFromNav) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="mb-2 text-lg font-semibold">{definition.displayName} has no page of its own</p>
        <p className="text-sm text-muted-foreground">
          {definition.displayName} powers features embedded in other screens instead. Manage its connection from{' '}
          <Link to="/settings/services" className="text-primary underline">
            Settings → Services
          </Link>
          .
        </p>
      </div>
    );
  }

  const screen = resolveScreen();
  return (
    <>
      {screen}
      {instance && <OpenInFrameButton instance={instance} />}
    </>
  );

  function resolveScreen() {
    if (instance && definition.hasDetailScreen) {
      if (definition.id === 'sabnzbd') return <SabnzbdScreen instance={instance} />;
      if (definition.id === 'nzbget') return <NzbgetScreen instance={instance} />;
      if (definition.id === 'qbittorrent') return <QBittorrentScreen instance={instance} />;
      if (definition.id === 'transmission') return <TransmissionScreen instance={instance} />;
      if (definition.id === 'deluge') return <DelugeScreen instance={instance} />;
      if (definition.id === 'overseerr') return <OverseerrScreen instance={instance} />;
      if (definition.id === 'tautulli') return <TautulliScreen instance={instance} />;
      if (definition.id === 'tracearr') return <TracearrScreen instance={instance} />;
      if (definition.id === 'prowlarr') return <ProwlarrScreen instance={instance} />;
      if (definition.id === 'nzbhydra2') return <NzbHydra2Screen instance={instance} />;
      if (definition.id === 'unraid') return <UnraidScreen instance={instance} />;
      if (definition.id === 'jackett') return <JackettScreen instance={instance} />;
      if (definition.id === 'sickbeard') return <SickbeardScreen instance={instance} />;
      if (definition.id === 'ombi') return <OmbiScreen instance={instance} />;
      if (definition.id === 'utorrent') return <UtorrentScreen instance={instance} />;
      if (definition.id === 'rutorrent') return <RutorrentScreen instance={instance} />;
      if (definition.id === 'bazarr') return <BazarrScreen instance={instance} />;
      if (ARR_V3.has(definition.id)) return <ArrQueueScreen definition={definition} instance={instance} apiVersion="v3" />;
      if (ARR_V1.has(definition.id)) return <ArrQueueScreen definition={definition} instance={instance} apiVersion="v1" />;
      if (TORZNAB.has(definition.id)) return <IndexerSearchScreen definition={definition} instance={instance} />;
    }
    return <GenericServiceScreen definition={definition} instance={instance} />;
  }
}
