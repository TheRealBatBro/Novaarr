import { useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Download, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { AdminOnlyNotice } from '@/components/settings/AdminOnlyNotice';
import { backupApi } from '@/lib/api';
import { useIsSettingsAdmin } from '@/lib/queries';

export const Route = createFileRoute('/settings/backup')({ component: SettingsBackup });

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error('Backup password must be at least 6 characters');
    if (password !== confirm) return toast.error('Passwords did not match');
    setBusy(true);
    try {
      const blob = await backupApi.export(password);
      triggerDownload(blob, `remotarr-backup-${new Date().toISOString().slice(0, 10)}.rtbackup`);
      toast.success('Backup downloaded');
      onOpenChange(false);
      setPassword('');
      setConfirm('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encrypt this backup</DialogTitle>
          <DialogDescription>
            The backup contains every service's API keys and tokens in the clear, so it's encrypted with a password of
            your choice before download. You'll need this exact password to restore it later — Remotarr doesn't store
            it anywhere.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="export-password">Backup password</Label>
            <Input
              id="export-password"
              type="password"
              autoFocus
              required
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="export-confirm">Confirm password</Label>
            <Input id="export-confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="mt-1">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download encrypted backup
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RestoreDialog({ file, onOpenChange }: { file: File | null; onOpenChange: (open: boolean) => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const result = await backupApi.import(file, password);
      toast.success(
        result.credentialPreserved
          ? 'Backup restored — your existing sign-in was kept as-is'
          : 'Backup restored — signing you out so you can sign back in with it',
      );
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restore failed');
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore from backup</DialogTitle>
          <DialogDescription>
            This replaces every configured service and your dashboard layout with what's in{' '}
            <span className="font-medium text-foreground">{file?.name}</span> — this can't be undone. If this device
            already has a PIN or password set up, it's kept as-is; only a device with no credential yet adopts the
            one from the backup. Enter the password this backup was encrypted with to continue.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="restore-password">Backup password</Label>
            <Input
              id="restore-password"
              type="password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" variant="destructive" disabled={busy} className="mt-1">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Restore and overwrite everything
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SettingsBackup() {
  const isAdmin = useIsSettingsAdmin();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setRestoreFile(file);
  }

  if (!isAdmin) {
    return (
      <div>
        <SettingsTabs active="backup" />
        <AdminOnlyNotice />
      </div>
    );
  }

  return (
    <div>
      <SettingsTabs active="backup" />
      <h1 className="text-2xl font-bold tracking-tight">Backup & restore</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Everything Remotarr remembers — configured services, API keys, dashboard layout, and your sign-in credential —
        lives in one file. It's encrypted with a password of your choice before it ever leaves the server.
      </p>

      <div className="grid max-w-md gap-4">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">Download a backup</p>
              <p className="text-sm text-muted-foreground">Encrypted snapshot of the whole database as a single file.</p>
            </div>
            <Button onClick={() => setExportOpen(true)} className="shrink-0">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">Restore from a backup</p>
              <p className="text-sm text-muted-foreground">Replaces everything currently configured.</p>
            </div>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="shrink-0">
              <Upload className="h-4 w-4" />
              Restore
            </Button>
            <input ref={fileInputRef} type="file" accept=".rtbackup" className="hidden" onChange={handleFileChosen} />
          </CardContent>
        </Card>
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <RestoreDialog file={restoreFile} onOpenChange={(open) => !open && setRestoreFile(null)} />
    </div>
  );
}
