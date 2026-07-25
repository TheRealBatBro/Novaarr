import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { cn } from '@/lib/utils';
import { statusTone, type SbResponse, type SbSeasons, type SbShow } from './SickbeardShared';

const TONE_CLASS: Record<string, string> = {
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  destructive: 'bg-destructive/15 text-destructive',
};

export function SickbeardShowDialog({ instance, show, onClose }: { instance: ServiceInstance; show: SbShow; onClose: () => void }) {
  const qc = useQueryClient();
  const [season, setSeason] = useState<string | null>(null);
  const [searchingEp, setSearchingEp] = useState<string | null>(null);

  const { data, isLoading } = useServiceProxy<SbResponse<SbSeasons>>(instance, {
    path: '',
    query: { cmd: 'show.seasons', tvdbid: String(show.tvdbid) },
    refetchInterval: false,
    timeoutMs: 20_000,
  });

  const seasons = data?.data?.data ?? {};
  const seasonKeys = useMemo(() => Object.keys(seasons).sort((a, b) => Number(b) - Number(a)), [seasons]);
  const activeSeason = season && seasons[season] ? season : seasonKeys[0];
  const episodes = activeSeason ? seasons[activeSeason] : undefined;
  const episodeKeys = episodes ? Object.keys(episodes).sort((a, b) => Number(a) - Number(b)) : [];

  // episode.search runs synchronously server-side and can take a while — Sick Beard's own
  // docs warn the response is delayed until the search actually finishes.
  const search = useMutation({
    mutationFn: (epNum: string) =>
      proxyApi.call(instance.id, {
        path: '',
        query: { cmd: 'episode.search', tvdbid: String(show.tvdbid), season: activeSeason ?? '', episode: epNum },
        timeoutMs: 30_000,
      }),
    onMutate: (epNum) => setSearchingEp(epNum),
    onSuccess: (res: any) => {
      if (res?.data?.result === 'success') toast.success(res.data.message || 'Search complete');
      else toast.error(res?.data?.message || 'Search failed');
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Search failed'),
    onSettled: () => setSearchingEp(null),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{show.show_name}</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && seasonKeys.length === 0 && <p className="text-sm text-muted-foreground">No season data.</p>}

        {!isLoading && seasonKeys.length > 0 && (
          <>
            <Select value={activeSeason} onChange={(e) => setSeason(e.target.value)} className="mb-2 w-40">
              {seasonKeys.map((s) => (
                <option key={s} value={s}>
                  {s === '0' ? 'Specials' : `Season ${s}`}
                </option>
              ))}
            </Select>

            <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
              {episodeKeys.map((epNum) => {
                const ep = episodes![epNum];
                const tone = statusTone(ep.status);
                const busy = search.isPending && searchingEp === epNum;
                return (
                  <div key={epNum} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                    <span className="w-8 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">{epNum}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ep.name || `Episode ${epNum}`}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className={cn('rounded-full px-1.5 py-0.5 font-medium', TONE_CLASS[tone])}>{ep.status}</span>
                        {ep.airdate && ep.airdate !== '0000-00-00' && <span className="text-muted-foreground">{ep.airdate}</span>}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => search.mutate(epNum)}>
                      <Search className="h-3.5 w-3.5" /> {busy ? 'Searching…' : 'Search'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
