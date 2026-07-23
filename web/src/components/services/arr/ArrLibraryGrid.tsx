import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Star, Eye, EyeOff, CheckCircle2, Tag as TagIcon, Clock, CloudOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useServiceProxy } from '@/lib/queries';
import type { ServiceInstance } from '@/lib/api';

type LibraryImage = { coverType: string; remoteUrl?: string; url?: string };
type LibraryItem = {
  id: number;
  title: string;
  monitored: boolean;
  hasFile?: boolean; // movie
  year?: number;
  added?: string;
  physicalRelease?: string; // movie
  digitalRelease?: string; // movie
  inCinemas?: string; // movie
  firstAired?: string; // series
  sizeOnDisk?: number; // movie: top-level bytes
  tags?: number[];
  images?: LibraryImage[];
  ratings?: { value?: number; imdb?: { value?: number }; tmdb?: { value?: number } };
  movieFile?: { quality?: { quality?: { name?: string } } };
  statistics?: { percentOfEpisodes?: number; sizeOnDisk?: number; episodeFileCount?: number; totalEpisodeCount?: number };
};

type Filter = 'all' | 'missing' | 'downloaded';
type SortBy = 'added' | 'release' | 'title' | 'size';

const SORT_LABELS: Record<SortBy, string> = {
  added: 'Date added',
  release: 'Release date',
  title: 'Title',
  size: 'Size',
};

function posterUrl(item: LibraryItem): string | undefined {
  const img = item.images?.find((i) => i.coverType === 'poster');
  return img?.remoteUrl || img?.url;
}

export function isDownloaded(item: LibraryItem, kind: 'movie' | 'series'): boolean {
  if (kind === 'movie') return !!item.hasFile;
  return (item.statistics?.percentOfEpisodes ?? 0) >= 100;
}

// "Missing" means monitored, not downloaded, AND already released — an unreleased upcoming
// item isn't missing yet, it just hasn't come out (shown instead with an "in N days" badge).
export function isMissing(item: LibraryItem, kind: 'movie' | 'series'): boolean {
  if (!item.monitored || isDownloaded(item, kind)) return false;
  const release = getReleaseDate(item, kind);
  const days = daysUntil(release);
  return days === undefined || days < 0;
}

export function getSizeOnDisk(item: LibraryItem, kind: 'movie' | 'series'): number {
  return (kind === 'movie' ? item.sizeOnDisk : item.statistics?.sizeOnDisk) ?? 0;
}

function getRating(item: LibraryItem): number | undefined {
  return item.ratings?.tmdb?.value ?? item.ratings?.imdb?.value ?? item.ratings?.value;
}

function getReleaseDate(item: LibraryItem, kind: 'movie' | 'series'): string | undefined {
  return kind === 'movie' ? item.physicalRelease || item.digitalRelease || item.inCinemas : item.firstAired;
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '';
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function formatAdded(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function monthGroupKey(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function daysUntil(iso?: string): number | undefined {
  if (!iso) return undefined;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function countdownLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export function ArrLibraryGrid({
  instance,
  path,
  kind,
  onSelect,
  onAdd,
}: {
  instance: ServiceInstance;
  path: string;
  kind: 'movie' | 'series';
  onSelect?: (id: number) => void;
  onAdd?: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('added');
  const { data, isLoading } = useServiceProxy<LibraryItem[]>(instance, { path, refetchInterval: 60_000 });

  const items = data?.data ?? [];

  const counts = useMemo(() => {
    let missing = 0;
    let downloaded = 0;
    for (const item of items) {
      if (isDownloaded(item, kind)) downloaded++;
      else if (isMissing(item, kind)) missing++;
    }
    return { all: items.length, missing, downloaded };
  }, [items, kind]);

  const filtered = items
    .filter((item) => {
      if (filter === 'all') return true;
      return filter === 'downloaded' ? isDownloaded(item, kind) : isMissing(item, kind);
    })
    .filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()));

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortBy === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'size') {
      list.sort((a, b) => getSizeOnDisk(b, kind) - getSizeOnDisk(a, kind));
    } else if (sortBy === 'release') {
      list.sort((a, b) => (getReleaseDate(b, kind) || '').localeCompare(getReleaseDate(a, kind) || ''));
    } else {
      list.sort((a, b) => (b.added || '').localeCompare(a.added || ''));
    }
    return list;
  }, [filtered, sortBy, kind]);

  const isDateSort = sortBy === 'added' || sortBy === 'release';
  const groups = useMemo(() => {
    if (!isDateSort) return [{ label: undefined as string | undefined, items: sorted }];
    const out: { label: string | undefined; items: LibraryItem[] }[] = [];
    for (const item of sorted) {
      const key = monthGroupKey(sortBy === 'release' ? getReleaseDate(item, kind) : item.added) ?? 'Unknown date';
      const last = out[out.length - 1];
      if (last && last.label === key) last.items.push(item);
      else out.push({ label: key, items: [item] });
    }
    return out;
  }, [sorted, isDateSort, sortBy, kind]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex gap-4">
          {(['all', 'missing', 'downloaded'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'relative pb-2 text-sm font-medium capitalize transition-colors',
                filter === f ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f}
              <span className="ml-1 text-xs text-muted-foreground">{counts[f]}</span>
              {filter === f && <motion.span layoutId="arr-tab-underline" className="absolute inset-x-0 -bottom-[9px] h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full border border-primary bg-primary/15 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
          >
            + Add {kind === 'movie' ? 'movie' : 'series'}
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search the ${items.length} ${kind === 'movie' ? 'movies' : 'series'} in your library…`}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="w-40 shrink-0">
          {(Object.keys(SORT_LABELS) as SortBy[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && sorted.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}

      {!isLoading &&
        sorted.length > 0 &&
        groups.map((group, gi) => (
          <div key={group.label ?? gi} className="mb-5">
            {group.label && (
              <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                {group.label}
                <span className="text-xs font-normal text-muted-foreground">
                  {group.items.length} {kind === 'movie' ? 'movie' : 'series'}
                  {group.items.length === 1 ? '' : kind === 'movie' ? 's' : ''}
                </span>
              </h3>
            )}
            <motion.div
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
            >
              {group.items.map((item) => {
                const url = posterUrl(item);
                const downloaded = isDownloaded(item, kind);
                const size = getSizeOnDisk(item, kind);
                const rating = getRating(item);
                const quality = item.movieFile?.quality?.quality?.name;
                const added = formatAdded(item.added);
                const episodesAvailable = item.statistics?.episodeFileCount;
                const episodesTotal = item.statistics?.totalEpisodeCount;
                const episodesMissing =
                  episodesTotal !== undefined && episodesAvailable !== undefined ? episodesTotal - episodesAvailable : undefined;
                const days = downloaded ? undefined : daysUntil(getReleaseDate(item, kind));
                const upcoming = days !== undefined && days >= 0;
                const missingBadge = !downloaded && item.monitored && !upcoming;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect?.(item.id)}
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="flex gap-3 rounded-xl border border-border bg-card p-2.5 text-left shadow-sm transition-colors hover:border-primary hover:shadow-md"
                  >
                    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {url ? (
                        <img src={url} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">
                          {item.title}
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold leading-tight">{item.title}</p>
                        {added && <span className="shrink-0 pl-2 text-xs tabular-nums text-muted-foreground">Added {added}</span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {upcoming && (
                          <span className="flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
                            <Clock className="h-2.5 w-2.5" /> {countdownLabel(days!)}
                          </span>
                        )}
                        {missingBadge && (
                          <span className="flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 font-medium text-destructive">
                            <CloudOff className="h-2.5 w-2.5" /> Missing
                          </span>
                        )}
                        {item.year && <span>{item.year}</span>}
                        {rating !== undefined && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {rating.toFixed(1)}
                            </span>
                          </>
                        )}
                        {quality && (
                          <>
                            <span>·</span>
                            <span className="rounded bg-accent px-1.5 py-0.5 font-medium">{quality}</span>
                          </>
                        )}
                        {downloaded && size > 0 && (
                          <span className="flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 font-medium text-success">
                            {formatSize(size)}
                          </span>
                        )}
                      </div>

                      {kind === 'series' && episodesAvailable !== undefined && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{episodesAvailable} available</span>
                          <span>{episodesMissing} missing</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-0.5">
                        {item.monitored ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />}
                        <CheckCircle2 className={cn('h-3.5 w-3.5', downloaded ? 'text-success' : 'text-muted-foreground/30')} />
                        {!!item.tags?.length && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <TagIcon className="h-3 w-3" /> {item.tags.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        ))}
    </div>
  );
}
