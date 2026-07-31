import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Hash, KeyRound, Users, Cloud, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { useAuthStatus, useIsSettingsAdmin, useCloudflareTunnelStatus } from '@/lib/queries';
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

function EnableMultiUserCard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords did not match');
      return;
    }
    setBusy(true);
    try {
      await authApi.enableMultiUser(username, password);
      await qc.invalidateQueries({ queryKey: ['auth', 'status'] });
      toast.success('Multi-user mode enabled — you’re signed in as the first admin');
      navigate({ to: '/settings/users' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to enable multi-user mode');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Multi-user mode</p>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Give each household member their own username, password, and dashboard layout instead of one shared{' '}
          {'PIN or password'}. This can’t be undone from here — the shared credential above stops being checked once you switch.
        </p>
        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Switch to multi-user mode
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="mu-username">Your admin username</Label>
              <Input id="mu-username" required value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mu-password">Your admin password</Label>
              <Input id="mu-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mu-confirm">Confirm password</Label>
              <Input id="mu-confirm" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                Create admin & switch
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function CloudflareTunnelCard() {
  const { data, isLoading } = useCloudflareTunnelStatus(true);

  const state = isLoading ? 'loading' : !data?.configured ? 'not-configured' : data.connected ? 'connected' : 'disconnected';
  const dotColor = state === 'connected' ? 'bg-green-500' : state === 'disconnected' ? 'bg-amber-500' : 'bg-muted-foreground/40';
  const label =
    state === 'loading' ? 'Checking…' : state === 'connected' ? 'Connected' : state === 'disconnected' ? 'Not connected' : 'Not set up';

  return (
    <Card className="max-w-md">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Cloud className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Cloudflare Tunnel</p>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', dotColor)} />
          <p className="text-sm font-medium">{label}</p>
          {data?.hostname && state === 'connected' && (
            <a
              href={`https://${data.hostname}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {data.hostname} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {state === 'not-configured' ? (
          <p className="text-sm text-muted-foreground">
            Expose this deployment to the internet without port-forwarding, using a Cloudflare Tunnel sidecar container. Uncomment the{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">cloudflared</code> service in <code className="rounded bg-muted px-1 py-0.5 text-xs">docker-compose.yml</code> to set it up — this card starts reporting its status automatically once it's running.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Managed by the <code className="rounded bg-muted px-1 py-0.5 text-xs">cloudflared</code> container in your{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">docker-compose.yml</code> — this is a read-only status view, not a
            control. Change the tunnel itself from Cloudflare's dashboard.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsSecurity() {
  const { data } = useAuthStatus();
  const isAdmin = useIsSettingsAdmin();
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

  if (data?.multiUser) {
    return (
      <div>
        <SettingsTabs active="security" />
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          This deployment uses multi-user sign-in. Manage accounts under{' '}
          <span className="font-medium text-foreground">Settings → Users</span>.
        </p>
        {isAdmin && (
          <div className="mt-6">
            <CloudflareTunnelCard />
          </div>
        )}
      </div>
    );
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

      <div className="mt-6 flex max-w-md flex-col gap-6">
        <EnableMultiUserCard />
        {isAdmin && <CloudflareTunnelCard />}
      </div>
    </div>
  );
}
