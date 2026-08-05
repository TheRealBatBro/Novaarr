import { useState } from 'react';
import { Maximize2, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ServiceInstance } from '@/lib/api';

// A floating button on every service page that opens the service's own native web UI in a
// modal iframe — for the (many) admin/config screens Novaarr doesn't reimplement. This loads
// browser-to-service directly (not through the /api/proxy backend, which exists to dodge CORS
// for our own fetch calls, not to serve as an iframe host), so it needs whichever URL the user's
// own browser can actually reach — same preferredMode-aware choice GenericServiceScreen's "Open"
// link already makes, just embedded instead of a new tab.
//
// Not guaranteed to work for every service: some set X-Frame-Options/frame-ancestors and refuse
// to be framed at all (Plex is a known example) — the "Open in new tab" fallback inside the
// dialog covers that case without needing to detect it up front.
export function OpenInFrameButton({ instance }: { instance: ServiceInstance }) {
  const [open, setOpen] = useState(false);
  const url = instance.preferredMode === 'remote' ? instance.remoteUrl || instance.localUrl : instance.localUrl || instance.remoteUrl;
  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Open ${instance.displayName}'s own interface`}
        aria-label={`Open ${instance.displayName}'s own interface`}
        className="fixed right-4 top-20 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition-colors hover:bg-accent hover:text-foreground"
      >
        <Maximize2 className="h-4 w-4" />
      </button>

      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="flex h-[90vh] w-[95vw] max-w-6xl flex-col gap-0 p-0">
            <DialogHeader className="flex-row items-center justify-between gap-2 border-b border-border p-3 pr-12">
              <DialogTitle className="min-w-0 truncate text-sm font-medium">{instance.displayName} — own interface</DialogTitle>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" /> New tab
              </a>
            </DialogHeader>
            <iframe src={url} title={instance.displayName} className="h-full w-full flex-1 border-0" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
