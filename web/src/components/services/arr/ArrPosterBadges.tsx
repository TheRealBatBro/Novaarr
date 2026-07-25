import { Star } from 'lucide-react';

/** Overlaid on a search-result poster: Rotten Tomatoes (top-left, only Radarr's lookup has this)
 * and IMDb (top-right) — same visual language as the dashboard carousels' rating badge. */
export function PosterRatingBadges({ imdb, rottenTomatoes }: { imdb?: number; rottenTomatoes?: number }) {
  if (imdb === undefined && rottenTomatoes === undefined) return null;
  return (
    <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between gap-1">
      {rottenTomatoes !== undefined ? (
        <span className="flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          🍅 {Math.round(rottenTomatoes)}%
        </span>
      ) : (
        <span />
      )}
      {imdb !== undefined && (
        <span className="flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
          {imdb.toFixed(1)}
        </span>
      )}
    </div>
  );
}
