import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Archive, Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, timeAgo } from '@/lib/utils';
import { type ServiceInstance } from '@/lib/api';
import { NOTIFICATIONS_QUERY, NOTIFICATIONS_ARCHIVE, useUnraidQuery, gqlData, unraidMutate } from './UnraidApi';

type Notification = { id: string; title?: string; subject?: string; description?: string; importance?: string; timestamp?: string };
type NotificationsData = {
  notifications?: {
    overview?: { unread?: { info?: number; warning?: number; alert?: number; total?: number } };
    list?: Notification[];
  };
};

const IMPORTANCE_TONE: Record<string, string> = {
  ALERT: 'bg-destructive/15 text-destructive',
  WARNING: 'bg-amber-500/15 text-amber-500',
  INFO: 'bg-primary/15 text-primary',
};

export function useUnraidUnreadCount(instance: ServiceInstance) {
  const { data } = useUnraidQuery<NotificationsData>(instance, NOTIFICATIONS_QUERY, { refetchInterval: 30_000 });
  return gqlData(data)?.notifications?.overview?.unread?.total ?? 0;
}

export function UnraidNotificationsDialog({ instance, open, onOpenChange }: { instance: ServiceInstance; open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useUnraidQuery<NotificationsData>(instance, NOTIFICATIONS_QUERY, { refetchInterval: open ? 15_000 : false });
  const list = gqlData(data)?.notifications?.list ?? [];

  const archive = useMutation({
    mutationFn: (ids: string[]) => unraidMutate(instance, NOTIFICATIONS_ARCHIVE, { ids }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || 'Failed to archive');
      qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to archive'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </span>
            {list.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={archive.isPending}
                onClick={() => archive.mutate(list.map((n) => n.id))}
              >
                <Archive className="h-3.5 w-3.5" /> Archive all
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          {!isLoading && list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No unread notifications.</p>}
          {!isLoading &&
            list.map((n) => (
              <div key={n.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{n.title ?? n.subject ?? 'Notification'}</p>
                    {n.importance && (
                      <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase', IMPORTANCE_TONE[n.importance] ?? 'bg-muted text-muted-foreground')}>
                        {n.importance}
                      </span>
                    )}
                  </div>
                  {n.description && <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>}
                  {n.timestamp && <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.timestamp)}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label="Archive"
                  disabled={archive.isPending}
                  onClick={() => archive.mutate([n.id])}
                >
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
