import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { ombiStatusLabel, TMDB_BACKDROP, TMDB_IMAGE } from './OmbiShared';
import type { OmbiCombinedResult } from './OmbiSearch';

export function OmbiRequestDialog({ instance, result, onClose }: { instance: ServiceInstance; result: OmbiCombinedResult; onClose: () => void }) {
  const qc = useQueryClient();
  const [requestAll, setRequestAll] = useState(true);

  const alreadyHandled = result.available || result.approved || result.requested || !!result.denied;
  const status = alreadyHandled ? ombiStatusLabel({ approved: !!result.approved, available: !!result.available, denied: result.denied }) : null;
  const year = (result.releaseDate ?? result.firstAired)?.slice(0, 4);

  const request = useMutation({
    mutationFn: () =>
      result.mediaType === 'movie'
        ? proxyApi.call(instance.id, {
            path: '/api/v1/Request/movie',
            method: 'POST',
            body: { theMovieDbId: result.id, languageCode: 'en', is4kRequest: false },
          })
        : proxyApi.call(instance.id, {
            path: '/api/v2/Requests/tv',
            method: 'POST',
            body: { theMovieDbId: result.id, languageCode: 'en', requestAll, latestSeason: !requestAll, firstSeason: false, seasons: [] },
          }),
    onSuccess: (res: any) => {
      const failed = !res.ok || res.data?.result === false || res.data?.isError;
      if (failed) return toast.error(res.data?.errorMessage || res.data?.message || res.error || 'Request failed');
      toast.success('Request sent');
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Request failed'),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <div className="relative h-36 w-full overflow-hidden rounded-t-xl bg-muted">
          {result.backdropPath && <img src={`${TMDB_BACKDROP}${result.backdropPath}`} alt="" className="h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-black/30" />
        </div>

        <div className="relative -mt-10 flex items-end gap-3 px-4">
          <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted shadow-lg ring-2 ring-card">
            {result.posterPath && <img src={`${TMDB_IMAGE}${result.posterPath}`} alt={result.title} className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h2 className="truncate text-lg font-bold leading-tight">{result.title}</h2>
            {year && <p className="truncate text-xs text-muted-foreground">{year}</p>}
          </div>
        </div>

        <div className="px-4 pb-4 pt-3">
          {result.overview && <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{result.overview}</p>}

          {status && (
            <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">{status.label}</div>
          )}

          {!alreadyHandled && result.mediaType === 'tv' && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <span className="font-medium">Request all seasons</span>
              <Switch checked={requestAll} onCheckedChange={setRequestAll} aria-label="Request all seasons" />
            </div>
          )}

          {!alreadyHandled && (
            <Button className="w-full" disabled={request.isPending} onClick={() => request.mutate()}>
              {request.isPending ? 'Requesting…' : 'Request'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
