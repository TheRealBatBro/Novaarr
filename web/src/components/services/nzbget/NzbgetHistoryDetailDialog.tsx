import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { NzbHistoryItem } from './NzbgetShared';
import { statusLabel } from './NzbgetShared';

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDateTime(unixSeconds?: number): string {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatSpeed(mb?: number, seconds?: number): string {
  if (!mb || !seconds) return '—';
  return `${((mb * 1024) / seconds).toFixed(0)} KB/s`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium">{value}</span>
    </div>
  );
}

export function NzbgetHistoryDetailDialog({ item, onClose }: { item: NzbHistoryItem; onClose: () => void }) {
  const failed = /FAILURE|FAILED/i.test(item.Status ?? '');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg min-w-0">
        <DialogHeader className="min-w-0">
          <DialogTitle className="break-words pr-6">{item.Name ?? item.NZBName ?? 'Unknown'}</DialogTitle>
        </DialogHeader>

        <span className={cn('w-fit rounded-full px-2 py-0.5 text-xs font-medium', failed ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success')}>
          {statusLabel(item.Status)}
        </span>

        <div className="mt-1 min-w-0">
          <Row label="Completed" value={formatDateTime(item.HistoryTime)} />
          <Row label="Size" value={item.FileSizeMB ? `${item.FileSizeMB} MB` : '—'} />
          <Row label="Category" value={item.Category || '—'} />
          <Row label="Path" value={item.DestDir || '—'} />
          <Row label="Download time" value={formatDuration(item.DownloadTimeSec)} />
          <Row label="Average speed" value={formatSpeed(item.DownloadedSizeMB, item.DownloadTimeSec)} />
          {item.ParStatus && <Row label="Par status" value={item.ParStatus} />}
          {item.UnpackStatus && <Row label="Unpack status" value={item.UnpackStatus} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
