import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type SabnzbdHistorySlot = {
  nzo_id: string;
  name?: string;
  nzb_name?: string;
  status: string;
  size?: string;
  bytes?: number;
  category?: string;
  storage?: string;
  download_time?: number;
  completed?: number;
  fail_message?: string;
  stage_log?: { name: string; actions?: string[] }[];
};

function stripHtml(s: string): string {
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
}

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

function formatSpeed(bytes?: number, seconds?: number): string {
  if (!bytes || !seconds) return '—';
  const mbps = bytes / 1024 / 1024 / seconds;
  return `${mbps.toFixed(1)} MB/s`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium">{value}</span>
    </div>
  );
}

function StageSection({ label, log }: { label: string; log?: { name: string; actions?: string[] } }) {
  if (!log?.actions?.length) return null;
  return (
    <div className="mt-3 min-w-0">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {log.actions.map((a, i) => (
        <p key={i} className="whitespace-pre-line break-words text-sm">
          {stripHtml(a)}
        </p>
      ))}
    </div>
  );
}

export function SabnzbdHistoryDetailDialog({ slot, onClose }: { slot: SabnzbdHistorySlot; onClose: () => void }) {
  const failed = slot.status === 'Failed';
  const repair = slot.stage_log?.find((s) => s.name === 'Repair');
  const unpack = slot.stage_log?.find((s) => s.name === 'Unpack');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg min-w-0">
        <DialogHeader className="min-w-0">
          <DialogTitle className="break-words pr-6">{slot.name ?? slot.nzb_name ?? 'Unknown'}</DialogTitle>
        </DialogHeader>

        <span
          className={cn(
            'w-fit rounded-full px-2 py-0.5 text-xs font-medium',
            failed ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success',
          )}
        >
          {slot.status}
        </span>
        {failed && slot.fail_message && <p className="min-w-0 break-words text-sm text-destructive">{slot.fail_message}</p>}

        <div className="mt-1 min-w-0">
          <Row label="Completed" value={formatDateTime(slot.completed)} />
          <Row label="Size" value={slot.size ?? '—'} />
          <Row label="Category" value={slot.category ?? '—'} />
          <Row label="Path" value={slot.storage ?? '—'} />
          <Row label="Download time" value={formatDuration(slot.download_time)} />
          <Row label="Average speed" value={formatSpeed(slot.bytes, slot.download_time)} />
        </div>

        <StageSection label="Repair" log={repair} />
        <StageSection label="Unpack" log={unpack} />
      </DialogContent>
    </Dialog>
  );
}
