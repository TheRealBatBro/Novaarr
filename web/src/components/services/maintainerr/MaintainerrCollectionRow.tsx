import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Power, Trash2, Play, Clock, EyeOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { useServiceProxy } from '@/lib/queries';
import { cn } from '@/lib/utils';
import {
  unwrapPage,
  mediaLabel,
  type MaintainerrCollection,
  type MaintainerrMediaItem,
  type MaintainerrExclusion,
  type MaintainerrLogEntry,
} from './MaintainerrTypes';

function Badge({ active }: { active: boolean }) {
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', active ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground')}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

const TABS = ['media', 'exclusions', 'logs'] as const;

export function MaintainerrCollectionRow({ instance, collection }: { instance: ServiceInstance; collection: MaintainerrCollection }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]>('media');

  // Every write below touches data this same screen already has cached under other proxy query
  // keys (the collections list's counts, the media list, exclusions) — invalidating everything
  // under ['proxy', instance.id] is simpler and safer than tracking each affected key by hand.
  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
  }

  const toggleActive = useMutation({
    mutationFn: () => proxyApi.call(instance.id, { path: `/api/collections/${collection.isActive ? 'deactivate' : 'activate'}/${collection.id}`, method: 'GET' }),
    onSuccess: () => {
      toast.success(collection.isActive ? 'Collection deactivated' : 'Collection activated');
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update collection'),
  });

  const removeCollection = useMutation({
    mutationFn: () => proxyApi.call(instance.id, { path: '/api/collections/removeCollection', method: 'POST', body: { collectionId: collection.id } }),
    onSuccess: () => {
      toast.success('Collection removed');
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to remove collection'),
  });

  const mediaQuery = useServiceProxy<unknown>(instance, {
    path: `/api/collections/media/${collection.id}/content/0`,
    query: { size: '25' },
    enabled: expanded && tab === 'media',
    refetchInterval: false,
  });
  const exclusionsQuery = useServiceProxy<unknown>(instance, {
    path: `/api/collections/exclusions/${collection.id}/content/0`,
    query: { size: '25' },
    enabled: expanded && tab === 'exclusions',
    refetchInterval: false,
  });
  const logsQuery = useServiceProxy<unknown>(instance, {
    path: `/api/collections/logs/${collection.id}/content/0`,
    query: { size: '25' },
    enabled: expanded && tab === 'logs',
    refetchInterval: false,
  });

  const handleMedia = useMutation({
    mutationFn: (mediaId: string) => proxyApi.call(instance.id, { path: '/api/collections/media/handle', method: 'POST', body: { collectionId: collection.id, mediaId } }),
    onSuccess: () => {
      toast.success('Handled — that item\'s rule action ran now');
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to handle item'),
  });

  const postponeMedia = useMutation({
    mutationFn: (mediaId: string) => proxyApi.call(instance.id, { path: '/api/collections/media/postpone', method: 'POST', body: { collectionId: collection.id, mediaId, days: 7 } }),
    onSuccess: () => {
      toast.success('Postponed 7 days');
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to postpone item'),
  });

  const excludeMedia = useMutation({
    mutationFn: (mediaId: string) => proxyApi.call(instance.id, { path: '/api/rules/exclusion', method: 'POST', body: { mediaId, collectionId: collection.id, action: 0 } }),
    onSuccess: () => {
      toast.success('Excluded — this item will be skipped from now on');
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to exclude item'),
  });

  const removeExclusion = useMutation({
    mutationFn: (exclusionId: number) => proxyApi.call(instance.id, { path: `/api/rules/exclusion/${exclusionId}`, method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Exclusion removed');
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to remove exclusion'),
  });

  const mediaItems = mediaQuery.data?.ok ? unwrapPage<MaintainerrMediaItem>(mediaQuery.data.data) : [];
  const exclusionItems = exclusionsQuery.data?.ok ? unwrapPage<MaintainerrExclusion>(exclusionsQuery.data.data) : [];
  const logItems = logsQuery.data?.ok ? unwrapPage<MaintainerrLogEntry>(logsQuery.data.data) : [];

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 p-3">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{collection.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {collection.mediaCount} media matched
              {collection.deleteAfterDays > 0 ? ` · removes ${collection.deleteAfterDays}d after being flagged` : ''}
              {collection.handledMediaAmount > 0 ? ` · ${collection.handledMediaAmount} handled so far` : ''}
            </p>
          </div>
        </button>
        <Badge active={collection.isActive} />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={collection.isActive ? 'Deactivate' : 'Activate'} disabled={toggleActive.isPending} onClick={() => toggleActive.mutate()}>
          <Power className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          title="Remove collection"
          disabled={removeCollection.isPending}
          onClick={() => removeCollection.mutate()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border p-3">
          <div className="mb-3 flex gap-1.5">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                  tab === t ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'media' && (
            <div className="flex flex-col gap-1.5">
              {mediaQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : mediaItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No media matched by this collection's rule (yet).</p>
              ) : (
                mediaItems.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{mediaLabel(m)}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        Added {new Date(m.addDate).toLocaleDateString()}
                        {m.isManual ? ' · manually added' : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Handle now" disabled={handleMedia.isPending} onClick={() => handleMedia.mutate(m.mediaServerId)}>
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Postpone 7 days" disabled={postponeMedia.isPending} onClick={() => postponeMedia.mutate(m.mediaServerId)}>
                        <Clock className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Exclude" disabled={excludeMedia.isPending} onClick={() => excludeMedia.mutate(m.mediaServerId)}>
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'exclusions' && (
            <div className="flex flex-col gap-1.5">
              {exclusionsQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : exclusionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing excluded from this collection.</p>
              ) : (
                exclusionItems.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                    <p className="truncate text-xs font-medium">{mediaLabel(e)}</p>
                    <Button variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0" title="Remove exclusion" disabled={removeExclusion.isPending} onClick={() => removeExclusion.mutate(e.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'logs' && (
            <div className="flex flex-col gap-1">
              {logsQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : logItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity logged yet.</p>
              ) : (
                logItems.map((l) => (
                  <div key={l.id} className="rounded-lg px-2.5 py-1 text-xs">
                    <span className="mr-2 text-muted-foreground">{new Date(l.timestamp).toLocaleString()}</span>
                    {l.message}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
