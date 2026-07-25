import { useRef, useState } from 'react';
import { Link2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Shared magnet/URL + file-upload dialog for every torrent client screen — mirrors the
 * link/upload toggle already used by SABnzbd/NZBGet's NZB add dialogs. Each screen supplies its
 * own add-by-URL and add-by-file mutations since every client's actual request shape differs. */
export function AddTorrentDialog({
  open,
  onOpenChange,
  onAddUrl,
  onAddFile,
  urlPending,
  filePending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddUrl: (url: string) => void;
  onAddFile: (file: File) => void;
  urlPending: boolean;
  filePending: boolean;
}) {
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    onAddUrl(url.trim());
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onAddFile(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add torrent</DialogTitle>
          <DialogDescription>Add a magnet link or URL, or upload a .torrent file from this device.</DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex gap-1.5">
          {(['url', 'upload'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                mode === m ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {m === 'url' ? 'Link' : 'Upload'}
            </button>
          ))}
        </div>

        {mode === 'url' ? (
          <form onSubmit={handleUrlSubmit} className="flex gap-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Magnet link or .torrent URL" className="flex-1" autoFocus />
            <Button type="submit" disabled={urlPending || !url.trim()}>
              <Link2 className="h-3.5 w-3.5" /> Add
            </Button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-6">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">Choose a .torrent file from this device</p>
            <input ref={fileInputRef} type="file" accept=".torrent" onChange={handleFileChange} className="hidden" />
            <Button variant="outline" disabled={filePending} onClick={() => fileInputRef.current?.click()}>
              {filePending ? 'Uploading…' : 'Choose file'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
