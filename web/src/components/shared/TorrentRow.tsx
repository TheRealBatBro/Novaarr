import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { cn } from '@/lib/utils';

export type TorrentRowAction = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export function TorrentRow({
  title,
  subtitle,
  progress,
  indeterminate,
  actions,
  selectable,
  selected,
  onToggleSelect,
  onRowClick,
}: {
  title: string;
  subtitle: string;
  progress?: number;
  indeterminate?: boolean;
  actions: TorrentRowAction[];
  /** When set, shows a checkbox for bulk multi-select instead of (or alongside) row-click. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Optional — makes the whole row clickable (e.g. to open a details view), independent of the per-action buttons. */
  onRowClick?: () => void;
}) {
  return (
    <div
      className={cn('-m-1.5 flex flex-col gap-1.5 rounded-lg p-1.5', onRowClick && 'cursor-pointer hover:bg-accent')}
      onClick={onRowClick}
    >
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelect?.()}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 shrink-0 accent-primary"
              aria-label="Select"
            />
          )}
          <span className="truncate font-medium">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="mr-1 text-xs text-muted-foreground">{subtitle}</span>
          {actions.map((a) => (
            <Button
              key={a.label}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={a.label}
              disabled={a.disabled}
              onClick={(e) => {
                e.stopPropagation();
                a.onClick();
              }}
            >
              <a.icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
      </div>
      <ProgressBar value={progress} indeterminate={indeterminate} />
    </div>
  );
}
