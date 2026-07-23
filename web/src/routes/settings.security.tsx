import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Hash, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { useAuthStatus } from '@/lib/queries';
import { authApi, type AuthMode } from '@/lib/api';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/settings/security')({ component: SettingsSecurity });

function validateCredential(mode: AuthMode, value: string): string | null {
  if (mode === 'pin') {
    if (!/^\d{4,8}$/.test(value)) return 'PIN must be 4-8 digits';
  } else if (value.length < 6 || value.length > 128) {
    return 'Password must be 6-128 characters';
  }
  return null;
}

function SettingsSecurity() {
  const { data } = useAuthStatus();
  const qc = useQueryClient();
  const currentMode = data?.authMode ?? 'pin';

  const [current, setCurrent] = useState('');
  const [newMode, setNewMode] = useState<AuthMode>(currentMode);
  const [newCredential, setNewCredential] = useState('');
  const [confirmCredential, setConfirmCredential] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateCredential(newMode, newCredential);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (newCredential !== confirmCredential) {
      toast.error(newMode === 'pin' ? 'PINs did not match' : 'Passwords did not match');
      return;
    }
    setBusy(true);
    try {
      await authApi.changeCredential(current, newMode, newCredential);
      await qc.invalidateQueries({ queryKey: ['auth', 'status'] });
      toast.success(newMode === 'pin' ? 'PIN updated' : 'Password updated');
      setCurrent('');
      setNewCredential('');
      setConfirmCredential('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SettingsTabs active="security" />
      <h1 className="text-2xl font-bold tracking-tight">Security</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        You currently sign in with a {currentMode === 'pin' ? 'PIN code' : 'password'}. Change it or switch to the other method below.
      </p>

      <Card className="max-w-md">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="current">Current {currentMode === 'pin' ? 'PIN' : 'password'}</Label>
              <Input
                id="current"
                type="password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Sign in with</Label>
              <div className="flex gap-1.5">
                {(['pin', 'password'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNewMode(m)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      newMode === m ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {m === 'pin' ? <Hash className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                    {m === 'pin' ? 'PIN code' : 'Password'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="newCredential">New {newMode === 'pin' ? 'PIN' : 'password'}</Label>
              <Input
                id="newCredential"
                type="password"
                placeholder={newMode === 'pin' ? '4-8 digits' : 'At least 6 characters'}
                required
                value={newCredential}
                onChange={(e) => setNewCredential(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="confirmCredential">Confirm new {newMode === 'pin' ? 'PIN' : 'password'}</Label>
              <Input
                id="confirmCredential"
                type="password"
                required
                value={confirmCredential}
                onChange={(e) => setConfirmCredential(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={busy} className="mt-2">
              Update
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
