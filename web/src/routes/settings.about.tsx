import { createFileRoute } from '@tanstack/react-router';
import { Lightbulb, LifeBuoy, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SettingsTabs } from '@/components/settings/SettingsTabs';

export const Route = createFileRoute('/settings/about')({ component: SettingsAbout });

const REPO_URL = 'https://github.com/TheRealBatBro/Novaarr';

const CHANGELOG: { version: string; notes: string[] }[] = [
  {
    version: '0.36.2',
    notes: [
      'Fixed "Add a passkey" actually failing with "Cannot read properties of undefined (reading \'replace\')" — the server wasn\'t passing an explicit user handle to the registration request, so the browser had nothing to encode and crashed. Passkeys should now register correctly',
    ],
  },
  {
    version: '0.36.1',
    notes: [
      'Fixed "Add a passkey" doing nothing on some browsers — it relied on a plain browser prompt() for naming the passkey, which mobile/installed-app browsers commonly block silently. Replaced with a proper in-app dialog, and failures now show an actual error instead of failing silently',
    ],
  },
  {
    version: '0.36.0',
    notes: [
      'Passkeys — sign in with your device\'s fingerprint, face, or a security key instead of typing a PIN/password, in addition to (not instead of) your existing credential. Manage them from Settings → Security',
      'Push notifications — get notified on this device when a new media request needs approval in Overseerr/Jellyseerr, without the app open. Enable from the new Settings → Notifications page',
      'New "Storage" dashboard widget — aggregated free/total disk space across every configured Sonarr/Radarr mount and SABnzbd folder, in one card',
      'Theming: pick an accent color (6 presets) and an AMOLED true-black dark mode, from the new Settings → Appearance page',
      'Pull-to-refresh on mobile — swipe down at the top of any page to refresh what\'s on screen, same gesture as native apps',
      'A proper bottom tab bar on mobile screens, alongside the existing pull-out menu',
      'Smoother shimmer loading skeletons everywhere instead of a flat pulse',
      'Tailscale support — reach this deployment over your private tailnet instead of (or alongside) a public Cloudflare Tunnel, with a live connection status card in Settings → Security. See the optional sidecar in docker-compose.yml',
    ],
  },
  {
    version: '0.35.0',
    notes: [
      'Fixed Now Playing cards still being hard to read on a wide card — the backdrop scrim\'s fade was tuned as a percentage of the card\'s width, so it barely covered anything on the full-width dashboard widget. It now stays solid through a fixed early portion regardless of card width',
      'Every service page now has a small button (top right) that opens that service\'s own native web interface in a modal, for anything Novaarr doesn\'t have a dedicated screen for. Some services (Plex is a known one) refuse to be embedded in a frame at all — a "New tab" link inside the modal covers that case',
    ],
  },
  {
    version: '0.34.2',
    notes: [
      'Fixed the "Stop stream" button overlapping the title/state text on the dashboard\'s Now Playing (Plex) widget and Tautulli\'s Now Playing tab',
    ],
  },
  {
    version: '0.34.1',
    notes: [
      'Fixed Bazarr\'s History tab crashing outright ("g.toLowerCase is not a function") — the code assumed the history row\'s action/timestamp fields were always plain strings, which isn\'t true for every Bazarr version',
      'Subtitle sync moved to where it belongs — each downloaded subtitle chip on a movie/episode page now has its own sync button (was only reachable from Bazarr\'s History tab before)',
    ],
  },
  {
    version: '0.34.0',
    notes: [
      'Bazarr now has its own page (was previously embedded-only, with no page of its own) — Wanted (search/auto-search missing subtitles for movies and episodes), History, Blacklist, and Providers (throttle status + reset), all reachable from the nav',
      'Subtitle sync: from Bazarr\'s History tab, sync a downloaded subtitle\'s timing to the actual video — the one thing you asked about that wasn\'t possible from Novaarr before',
    ],
  },
  {
    version: '0.33.0',
    notes: [
      'Fixed SABnzbd showing "NaN MB/s" — the header speed was parsing SABnzbd\'s human-formatted "speed" field (e.g. "1.2 M") as a number instead of the raw numeric "kbpersec" field',
      'SABnzbd queue items now show live Repairing/Extracting/Verifying/Moving status (with an indeterminate progress bar) instead of looking stalled at 100%, plus downloaded/total size, ETA, and priority in the detail view',
      'Radarr/Sonarr movie detail pages now show the file\'s original title, release group, edition, video/audio codec and resolution, audio languages, and embedded subtitle languages — all already present in Radarr\'s own API response, just not surfaced before',
    ],
  },
  {
    version: '0.32.1',
    notes: [
      'Fixed the favicon/app icon and manifest links being absolute ("/icon.png") instead of relative to the app\'s actual mount point — broke "Add to Home Screen" for any deployment using BASE_PATH to host at a sub-path',
    ],
  },
  {
    version: '0.32.0',
    notes: [
      'Proper PWA icon set for "Add to Home Screen" — a 192×192 icon plus a padded maskable variant (Android crops icons to a circle/squircle and only guarantees the inner ~80%, so the plain icon\'s orbit ring and sparkle would\'ve been clipped without it)',
    ],
  },
  {
    version: '0.31.0',
    notes: [
      'Renamed the project from Remotarr to Novaarr, with a new logo — same app, same data. Existing installs migrate automatically: the database, session, and saved UI preferences all carry over on upgrade',
      'New GitHub repo: github.com/TheRealBatBro/Novaarr. New Docker Hub image: therealbatbro/novaarr',
    ],
  },
  {
    version: '0.30.0',
    notes: [
      'Moved the "What should I watch?" mood wizard to its own page at Discover → What should I watch?, linked from the main Discover page',
      'Discover\'s main page is now "Similar to what you\'ve recently watched," using the same recommendation engine as the dashboard\'s "Because you watched" widget — expanded to seed from your last 10 watched movies and last 10 watched shows separately (instead of the widget\'s single mixed row of 3), shown as two 5-per-row grids of up to 10 picks each, and defaulting to your own linked Plex history',
    ],
  },
  {
    version: '0.29.0',
    notes: [
      'Redesigned Discover\'s form with a proper visual pass — a gradient header card, each question grouped into its own bordered card with an icon, checkmark badges on selected mood/occasion/chips, and a bigger gradient "Get recommendations" button',
      'Result posters now lift and get a hover glow, with a subtle gradient overlay on hover',
    ],
  },
  {
    version: '0.28.0',
    notes: [
      'Discover\'s wizard is back to a single page — every question (mood, occasion, genres, era, popularity, extra interests, language/homemade/family-friendly) is answered on one screen with no "Next" buttons',
      'Removed the "Similar to what you\'ve recently watched" section from Discover',
    ],
  },
  {
    version: '0.27.0',
    notes: [
      'Discover\'s wizard is now one question per screen (mood, occasion, genres, era, popularity, extra interests like "heist" or "based on a true story", then language/homemade/family-friendly) instead of one long form, with a step counter',
      'Discover now spans the full page width, matching Calendar and the Dashboard',
      'Renamed the recently-watched recommendations to "Similar to what you\'ve recently watched" with clear "Movies"/"TV Shows" sub-labels, and split it from the mood wizard into its own clearly divided section',
    ],
  },
  {
    version: '0.26.0',
    notes: [
      'Added a "Because you watched…" section to Discover — recommendations based on your last 10 watched movies and last 10 watched shows (via Tautulli/Tracearr), shown before you even run the wizard',
      'Discover now suggests 6 movies and 6 TV shows instead of 5',
      'Fixed "New releases" (and other filters) occasionally returning years-old titles — the fallback that loosens overly narrow searches was dropping the era filter first; it now drops popularity/rating/genre/language first and only relaxes era as an absolute last resort, plus era, rating, and language are now double-checked client-side instead of trusting Overseerr\'s filter alone',
    ],
  },
  {
    version: '0.25.0',
    notes: [
      'Added a trailer play button to the request dialog\'s header photo — same as Sonarr/Radarr\'s detail pages — covering Discover, Trakt/MDBList carousels, and Seerr\'s own trending/popular widgets',
    ],
  },
  {
    version: '0.24.0',
    notes: [
      'Discover now lets you filter by language (defaults to English) and toggle "Skip obscure/homemade titles" (on by default) to keep suggestions to real theatrical/studio releases',
    ],
  },
  {
    version: '0.23.1',
    notes: [
      'Fixed Discover returning no results for some mood/genre/era/popularity combinations — genre picks now use "any of these" logic instead of "all of these," and an overly narrow combination now automatically loosens (with a note) instead of coming back empty',
    ],
  },
  {
    version: '0.23.0',
    notes: [
      'New "Discover" page (needs Seerr): a short mood/genre wizard suggests 5 movies and 5 TV shows to watch now',
      'Recommendations skip anything already in your library, plus watched history from Tautulli and Tracearr when configured',
      'Tap a suggestion to see details and request it, reusing the same request dialog as Seerr search',
    ],
  },
  {
    version: '0.22.0',
    notes: [
      'New "Now Playing (Plex)" dashboard widget — shows active Plex sessions with a stop control, no Tautulli required',
      'qBittorrent now shows upload speed alongside download speed, plus a toggle for alternative (throttled) speed limits',
      'Sonarr/Radarr Server tab now shows disk space per root folder and any active health warnings',
      'Tautulli\'s Now Playing sessions can be stopped directly from Remotarr',
      'Prowlarr Server tab now breaks indexer stats down per-indexer instead of only an aggregate total',
      'New "Wanted Subtitles" dashboard widget for Bazarr, showing the total count of movies/episodes missing subtitles',
    ],
  },
  {
    version: '0.21.0',
    notes: [
      'Added optional TOTP two-factor authentication (Settings > Security) — an authenticator-app code required after your PIN/password, with backup codes for recovery',
      'Added optional Cloudflare Access SSO — sign in via Cloudflare\'s own login instead of (or alongside) the app\'s PIN/password; see README for setup',
      'New/changed PINs now require 6-8 digits instead of 4-8 — a 4-digit PIN is only 10,000 combinations',
      'The brute-force lockout now caps at 24 hours instead of 15 minutes for a deployment reachable from the internet',
      'CI now scans every built image for known vulnerabilities before it publishes',
    ],
  },
  {
    version: '0.20.1',
    notes: [
      'Settings > Security, Backup, Audit, and About now fill the available width instead of being capped to a narrow column',
    ],
  },
  {
    version: '0.20.0',
    notes: [
      'Added an admin-only Audit log (Settings > Audit) tracking sign-ins, user management, and service/access-role changes — never logs credential values, only that they changed',
    ],
  },
  {
    version: '0.19.0',
    notes: [
      'Removed Wake-on-LAN — a leftover feature that let any signed-in member send a magic packet to any address with no permission check',
      'Service API keys and passwords are now encrypted at rest (AES-256-GCM) instead of stored as plain JSON',
      'The backend proxy now resolves DNS itself and refuses to connect to loopback, link-local, or cloud metadata addresses — including through a redirect',
      'Added session revocation: Settings > Security has a "Sign out everywhere else" action, and a password/PIN change now signs out every existing session automatically',
      'Bumped a few backend dependencies to their latest patched versions',
      'The Docker container now runs read-only, drops all Linux capabilities, and sets no-new-privileges',
    ],
  },
  {
    version: '0.18.2',
    notes: [
      'The "Search Seerr" dashboard widget now searches automatically as you type instead of needing a button press, and shows the real error when the Seerr instance is unreachable instead of a misleading "No results"',
    ],
  },
  {
    version: '0.18.1',
    notes: [
      'Fixed Seerr requests always being attributed to the admin account instead of the requesting member\'s linked Seerr account',
    ],
  },
  {
    version: '0.18.0',
    notes: [
      'Added an "Ignore certificate errors" option for services with a local/remote URL, to support self-signed certs (e.g. Plex over a local IP)',
      'Saving a service instance now tests the connection first and blocks the save on failure, with a "Save anyway" override',
    ],
  },
  {
    version: '0.17.0',
    notes: [
      'Settings > Security now shows a live Cloudflare Tunnel status card, for deployments using the optional cloudflared sidecar in docker-compose.yml to expose Remotarr without port-forwarding',
    ],
  },
  {
    version: '0.16.2',
    notes: ['Backfilled this changelog through v0.16.1 — every release now updates it going forward'],
  },
  {
    version: '0.16.1',
    notes: ['Settings > Services now groups every instance of a service into one card with a built-in "Add another instance" action, instead of a separate floating link'],
  },
  {
    version: '0.16.0',
    notes: [
      'Added MDBList as an alternative to Trakt for the Trending/Most Anticipated dashboard widgets, for deployments where Trakt’s API is unreachable',
    ],
  },
  {
    version: '0.15.0',
    notes: ['Access roles can grant Calendar data from a specific Sonarr/Radarr instance independently of that instance’s own page'],
  },
  {
    version: '0.14.2',
    notes: ['Fixed an access role widget grant also silently exposing that widget’s underlying service page'],
  },
  {
    version: '0.14.1',
    notes: ['Access roles’ widget picker now shows which service each widget belongs to'],
  },
  {
    version: '0.14.0',
    notes: ['Access roles can grant individual dashboard widgets, not just entire services'],
  },
  {
    version: '0.13.0',
    notes: ['Admins can create named access roles to restrict a member to specific services'],
  },
  {
    version: '0.12.0',
    notes: [
      'Admins can link a household member’s account to Plex/Emby/Jellyfin, with Overseerr/Ombi auto-matched from that',
      'Fixed a menu-visibility setting that was also silently disabling sign-in for every deployment',
    ],
  },
  {
    version: '0.11.0',
    notes: [
      'Multi-instance support: any service can now be configured more than once (e.g. two Sonarr instances)',
      'Direct Emby and Jellyfin dashboard widgets',
      'Multi-user login with Admin/Member roles, opt-in from Settings > Security',
      'New integrations: rTorrent/ruTorrent, qBittorrent, Lidarr, Readarr, Deluge, Transmission, Sick Beard, Ombi, µTorrent, NZBGet, Jackett, NZBHydra2, and full Unraid support',
      'Torrent file upload added to every torrent client',
      'Calendar redesigned as a full-width month grid',
      'Add series/movie search now shows ratings, runtime, and full titles, with a wider layout on desktop',
    ],
  },
  {
    version: '0.10.0',
    notes: [
      'Now Playing (Tautulli) and Streaming Activity (Tracearr) redesigned with a fanart backdrop behind each session, plus episode code, quality/player info, and time remaining',
      'The same richer session card now appears on the Tautulli and Tracearr service pages, not just the dashboard widgets',
      'Fixed Tracearr’s live session always showing "Unknown user" instead of the real username and avatar',
    ],
  },
  {
    version: '0.9.0',
    notes: [
      'Direct Plex integration: Recently Added, Collections, and Library Stats widgets, alongside a Recently Added feed sourced from Tautulli',
      '"Because you watched" now seeds recommendations from several recent watches (not just the last one), with a per-Plex-user filter, a configurable cache schedule, and a manual refresh button',
      'Universal search now also finds titles you don’t have yet, not just your existing library — pick one to add it in a couple of taps',
      'Fixed trailer playback (was failing due to the app’s own privacy headers)',
      'Fixed several dashboard bugs: new widgets landing at the very bottom instead of a sensible position, disabled widgets reappearing, scroll position carrying over between tabs and on browser back/forward',
      'Fixed mobile timeouts caused by too many simultaneous background requests to the same service',
      'Settings sub-navigation redesigned as a segmented control and wraps properly on narrow screens',
      'Security: added a Content-Security-Policy, a working robots.txt and security.txt, confirmed HSTS/X-Content-Type-Options',
    ],
  },
  {
    version: '0.8.0',
    notes: [
      'Sonarr show pages: latest season listed first, episode air dates, decluttered episode rows',
      'Episodes are now clickable — a dialog shows the episode overview, still image, and the downloaded release name',
      'Season rows show an expand/collapse chevron',
      'Sonarr and Radarr detail pages: a play button on the banner opens the trailer, and the Details card is collapsible',
      'Command palette (Cmd/Ctrl+K) can now search movies and TV shows already in your library, not just jump between services',
      'Fixed page navigation not scrolling back to the top',
      'Added this About page, with feature-request and support links',
    ],
  },
  {
    version: '0.7.0',
    notes: ['Manual import lets you pick exactly which movie, or which series and episode(s), a file matches before importing it'],
  },
  {
    version: '0.6.0',
    notes: ['Fixed Trakt posters occasionally going blank on flaky connections', 'Fixed the queue item dialog overflowing on mobile'],
  },
  {
    version: '0.5.0',
    notes: [
      'Queue items in Sonarr/Radarr are now clickable, with manual import and remove actions',
      'Per-service refresh intervals are configurable from Settings > Dashboard',
      'Dashboard widget caching fixes and a manual refresh action',
    ],
  },
  {
    version: '0.4.0',
    notes: ['Custom display names are honored everywhere a service name is shown', 'Query cache persists to IndexedDB for instant loads on return visits'],
  },
  {
    version: '0.3.0',
    notes: ['Encrypted backup & restore for your whole configuration', 'Hardened sign-in against brute-force attempts', 'Automatic Docker image builds on every push'],
  },
  {
    version: '0.2.0',
    notes: ['Reverse-proxy support (subdomain or sub-path)', 'Full Prowlarr integration', 'Flattened, drag-to-reorder navigation with live health status'],
  },
  {
    version: '0.1.0',
    notes: ['Initial release'],
  },
];

function LinkCard({ icon: Icon, title, description, href }: { icon: typeof Lightbulb; title: string; description: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      <Card className="transition-colors hover:bg-accent">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </a>
  );
}

function SettingsAbout() {
  return (
    <div>
      <SettingsTabs active="about" />
      <h1 className="text-2xl font-bold tracking-tight">About Novaarr</h1>
      <p className="mb-6 text-sm text-muted-foreground">Version {CHANGELOG[0].version}</p>

      <div className="mb-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <LinkCard
          icon={Lightbulb}
          title="Request a feature"
          description="Open a feature request on GitHub"
          href={`${REPO_URL}/issues/new?labels=enhancement&title=Feature%20request%3A%20`}
        />
        <LinkCard
          icon={LifeBuoy}
          title="Get support"
          description="Run into a problem? Open a support issue on GitHub"
          href={`${REPO_URL}/issues/new?labels=question&title=Support%3A%20`}
        />
      </div>

      <h2 className="mb-3 text-lg font-bold tracking-tight">What's new</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CHANGELOG.map((entry) => (
          <div key={entry.version} className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-semibold">v{entry.version}</p>
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {entry.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
