import { BASE_PATH } from './api';

type IconProps = { className?: string };
type Icon = (props: IconProps) => JSX.Element;

function svg(props: IconProps, children: JSX.Element) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className}>
      {children}
    </svg>
  );
}

// Real brand logos (from the community-maintained dashboard-icons project) for every service
// that has one — only µTorrent and NEWZnab lack a published logo there, so those two keep a
// simple hand-drawn glyph below rather than a generic placeholder.
function logo(file: string): Icon {
  return (p) => <img src={`${BASE_PATH}/icons/${file}.svg`} alt="" className={p.className} style={{ objectFit: 'contain' }} />;
}

const Utorrent: Icon = (p) =>
  svg(
    p,
    <>
      <path d="M7 3v9a5 5 0 0010 0V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 3h3.2M13.8 3H17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7 7.5h3.2M13.8 7.5H17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </>,
  );

const Newznab: Icon = (p) =>
  svg(
    p,
    <>
      <circle cx="6" cy="18" r="2" fill="currentColor" />
      <path d="M4 11a9 9 0 019 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 5a15 15 0 0115 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>,
  );

// No published logo in the dashboard-icons set at hand-authoring time — a simple play-mark-in-an-
// arc glyph, same treatment as the µTorrent/NEWZnab hand-drawn fallbacks above.
const Plex: Icon = (p) =>
  svg(
    p,
    <>
      <path d="M12 3a9 9 0 100 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 8l5 4-5 4V8z" fill="currentColor" />
    </>,
  );

// No published logo in the dashboard-icons set at hand-authoring time — a simple list/ranking
// glyph, same treatment as the other hand-drawn fallbacks above.
const Mdblist: Icon = (p) =>
  svg(
    p,
    <>
      <circle cx="5" cy="6" r="1.4" fill="currentColor" />
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="5" cy="18" r="1.4" fill="currentColor" />
      <path d="M9 6h10M9 12h10M9 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>,
  );

// No published logo in the dashboard-icons set at hand-authoring time — a simple broom glyph
// (cleanup/maintenance), same treatment as the other hand-drawn fallbacks above.
const Maintainerr: Icon = (p) =>
  svg(
    p,
    <>
      <path d="M14 3l-7 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9.5 12.5L5 21l3.2-1.4L11 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 4.5L18 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 22h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>,
  );

const Fallback: Icon = (p) => svg(p, <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />);

const REGISTRY: Record<string, Icon> = {
  sabnzbd: logo('sabnzbd'),
  nzbget: logo('nzbget'),
  deluge: logo('deluge'),
  transmission: logo('transmission'),
  utorrent: Utorrent,
  qbittorrent: logo('qbittorrent'),
  rutorrent: logo('rutorrent'),
  sonarr: logo('sonarr'),
  radarr: logo('radarr'),
  lidarr: logo('lidarr'),
  readarr: logo('readarr'),
  bazarr: logo('bazarr'),
  sickbeard: logo('sickbeard'),
  newznab: Newznab,
  jackett: logo('jackett'),
  nzbhydra2: logo('nzbhydra2'),
  prowlarr: logo('prowlarr'),
  unraid: logo('unraid'),
  overseerr: logo('overseerr'),
  ombi: logo('ombi'),
  tautulli: logo('tautulli'),
  tracearr: logo('tracearr'),
  trakt: logo('trakt'),
  plex: Plex,
  emby: logo('emby'),
  jellyfin: logo('jellyfin'),
  mdblist: Mdblist,
  maintainerr: Maintainerr,
};

export function getServiceIcon(serviceId: string): Icon {
  return REGISTRY[serviceId] ?? Fallback;
}
