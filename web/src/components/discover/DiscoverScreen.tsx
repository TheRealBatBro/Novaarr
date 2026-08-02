import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Sparkles, ArrowRight, User, Star } from 'lucide-react';
import { useServices, useAuthStatus } from '@/lib/queries';
import { useUiStore } from '@/stores/useUiStore';
import { Select } from '@/components/ui/select';
import { useTautulliUsers, useExpandedWatchRecommendations, type CarouselItem } from '@/lib/dashboardWidgets';
import { OverseerrRequestDialog } from '@/components/services/overseerr/OverseerrRequestDialog';

// Discover's landing page is an expansion of the dashboard's "Because you watched X & N more"
// widget, not a copy of it (useExpandedWatchRecommendations in dashboardWidgets.ts) — same
// underlying engine (Tautulli watch history → TMDB id → Overseerr's /recommendations), but
// widened from the widget's single mixed carousel (top 3 watches) to two separate pools of up
// to 10 recommendations each, seeded from the last 10 distinct watched movies and last 10
// distinct watched shows. Defaults to the Remotarr account's own linked Plex history rather
// than "everyone's," since this is a personal discovery page, not a shared dashboard widget —
// still overridable via the picker for a household member without their own Remotarr login.
export function DiscoverScreen() {
  const { data: instances = [] } = useServices();
  const overseerr = instances.find((i) => i.serviceId === 'overseerr' && i.enabled);
  const tautulli = instances.find((i) => i.serviceId === 'tautulli' && i.enabled);

  const users = useTautulliUsers(tautulli);
  const { plexRecommendationUserId, setPlexRecommendationUserId, plexRecommendationRefreshMinutes } = useUiStore();
  const { data: authStatus } = useAuthStatus();

  const myPlexLink = authStatus?.user?.links?.find((l) => instances.find((i) => i.id === l.instanceId)?.serviceId === 'plex');
  const autoUser = myPlexLink
    ? users.find((u) => [u.username, u.friendly_name].some((n) => n && myPlexLink.externalName && n.toLowerCase() === myPlexLink.externalName!.toLowerCase()))
    : undefined;
  const activeUserId = plexRecommendationUserId && users.some((u) => String(u.user_id) === plexRecommendationUserId)
    ? plexRecommendationUserId
    : autoUser
      ? String(autoUser.user_id)
      : undefined;

  const result = useExpandedWatchRecommendations(tautulli, overseerr, activeUserId, plexRecommendationRefreshMinutes);
  const [openItem, setOpenItem] = useState<CarouselItem | null>(null);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner">
            <Sparkles className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Discover</h1>
            <p className="mt-1 text-sm text-muted-foreground">Similar to what you've recently watched, based on your Tautulli history.</p>
          </div>
        </div>
        <Link
          to="/discover/what-to-watch"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          What should I watch? <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {!tautulli || !overseerr ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-card/40 py-24 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground/40" />
          <h2 className="text-xl font-bold">Discover needs Tautulli and Seerr configured</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            These recommendations are seeded from your Plex watch history via Tautulli, then resolved to TMDB recommendations via Seerr —
            add and enable both in Settings → Services to use it.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {users.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Based on watch history for</span>
              <Select
                className="h-8 w-44 text-xs"
                value={plexRecommendationUserId ?? (autoUser ? String(autoUser.user_id) : '')}
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

          {!result.isLoading && result.movies.length === 0 && result.shows.length === 0 && !result.error ? (
            <p className="rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              Not enough watch history yet to base recommendations on.
            </p>
          ) : result.error && result.movies.length === 0 && result.shows.length === 0 ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
              Couldn't load recommendations — {result.error}
            </p>
          ) : (
            <>
              <RecommendationGrid
                heading={result.movieSeed ? `Because you watched ${result.movieSeed.title}${result.movieSeed.extraCount > 0 ? ` & ${result.movieSeed.extraCount} more` : ''}` : 'Movies'}
                items={result.movies}
                isLoading={result.isLoading}
                onPick={setOpenItem}
              />
              <RecommendationGrid
                heading={result.showSeed ? `Because you watched ${result.showSeed.title}${result.showSeed.extraCount > 0 ? ` & ${result.showSeed.extraCount} more` : ''}` : 'TV Shows'}
                items={result.shows}
                isLoading={result.isLoading}
                onPick={setOpenItem}
              />
            </>
          )}
        </div>
      )}

      {openItem?.overseerrDetail && overseerr && (
        <OverseerrRequestDialog
          instance={overseerr}
          mediaType={openItem.overseerrDetail.mediaType}
          tmdbId={openItem.overseerrDetail.tmdbId}
          fallbackTitle={openItem.title}
          fallbackPoster={openItem.imageUrl}
          onClose={() => setOpenItem(null)}
        />
      )}
    </div>
  );
}

// Five per row, wrapping onto a second row for the full 10 — a grid rather than the dashboard's
// horizontal-scroll carousel, since this page has the room and isn't competing with a dozen
// other widgets for vertical space.
function RecommendationGrid({ heading, items, isLoading, onPick }: { heading: string; items: CarouselItem[]; isLoading: boolean; onPick: (item: CarouselItem) => void }) {
  if (!isLoading && items.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold tracking-tight">{heading}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-2xl bg-muted" />)
          : items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted-foreground">{item.title}</div>
                  )}
                  {item.rating !== undefined && (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      {item.rating}
                    </span>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-semibold leading-tight">{item.title}</p>
                  {item.subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>}
                </div>
              </button>
            ))}
      </div>
    </div>
  );
}
