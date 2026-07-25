import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { proxyApi, type ServiceInstance } from '@/lib/api';
import { appendBody } from './NzbgetShared';
import { fileToBase64 } from '@/lib/utils';

export function NzbgetAddDialog({ instance, open, onOpenChange }: { instance: ServiceInstance; open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['proxy', instance.id] });
  }

  const addUrl = useMutation({
    mutationFn: (nzbUrl: string) => proxyApi.call<number>(instance.id, { path: '/jsonrpc', method: 'POST', body: appendBody('', nzbUrl) }),
    onSuccess: (res) => {
      if (!res.ok || (res.data ?? 0) <= 0) return toast.error(res.error || 'Failed to add');
      toast.success('NZB added to queue');
      invalidate();
      setUrl('');
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add'),
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return proxyApi.call<number>(instance.id, { path: '/jsonrpc', method: 'POST', body: appendBody(file.name, base64) });
    },
    onSuccess: (res) => {
      if (!res.ok || (res.data ?? 0) <= 0) return toast.error(res.error || 'Upload failed');
      toast.success('NZB uploaded to queue');
      invalidate();
      if (fileInputRef.current) fileInputRef.current.value = '';
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Upload failed'),
  });

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    addUrl.mutate(url.trim());
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile.mutate(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add NZB</DialogTitle>
          <DialogDescription>Download an NZB file from a URL, or upload one from this device.</DialogDescription>
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
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/release.nzb" className="flex-1" />
            <Button type="submit" disabled={addUrl.isPending || !url.trim()}>
              <Link2 className="h-3.5 w-3.5" /> Add
            </Button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-6">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">Choose a .nzb file from this device</p>
            <input ref={fileInputRef} type="file" accept=".nzb" onChange={handleFileChange} className="hidden" />
            <Button variant="outline" disabled={uploadFile.isPending} onClick={() => fileInputRef.current?.click()}>
              {uploadFile.isPending ? 'Uploading…' : 'Choose file'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
