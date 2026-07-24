import { createFileRoute } from '@tanstack/react-router';
import { Lightbulb, LifeBuoy, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SettingsTabs } from '@/components/settings/SettingsTabs';

export const Route = createFileRoute('/settings/about')({ component: SettingsAbout });

const REPO_URL = 'https://github.com/TheRealBatBro/Remotarr';

const CHANGELOG: { version: string; notes: string[] }[] = [
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
      <h1 className="text-2xl font-bold tracking-tight">About Remotarr</h1>
      <p className="mb-6 text-sm text-muted-foreground">Version {CHANGELOG[0].version}</p>

      <div className="mb-8 grid max-w-md gap-3">
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
      <div className="flex max-w-md flex-col gap-4">
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
