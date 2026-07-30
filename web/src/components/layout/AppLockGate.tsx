import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Hash, KeyRound } from 'lucide-react';
import { authApi, type AuthMode } from '@/lib/api';
import { useAuthStatus } from '@/lib/queries';
import { useAuthBypass } from '@/lib/visibility';
import { Button } from '@/components/ui/button';
import { PinPad } from './PinPad';
import { PasswordEntry } from './PasswordEntry';
import { UsernamePasswordEntry } from './UsernamePasswordEntry';

function ModePicker({ onChoose }: { onChoose: (mode: AuthMode) => void }) {
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-6 text-center">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Lock this app</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose how you want to unlock the dashboard on this device.</p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Button variant="outline" className="h-16 justify-start gap-3 px-4" onClick={() => onChoose('pin')}>
          <Hash className="h-5 w-5 shrink-0" />
          <div className="text-left">
            <p className="font-medium leading-tight">PIN code</p>
            <p className="text-xs text-muted-foreground">4-8 digits, tap to enter</p>
          </div>
        </Button>
        <Button variant="outline" className="h-16 justify-start gap-3 px-4" onClick={() => onChoose('password')}>
          <KeyRound className="h-5 w-5 shrink-0" />
          <div className="text-left">
            <p className="font-medium leading-tight">Password</p>
            <p className="text-xs text-muted-foreground">Any length, typed</p>
          </div>
        </Button>
      </div>
    </div>
  );
}

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const authBypass = useAuthBypass();
  const { data, isLoading } = useAuthStatus();
  const qc = useQueryClient();
  const [chosenMode, setChosenMode] = useState<AuthMode | null>(null);
  const [pendingFirst, setPendingFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSetup(mode: AuthMode, value: string) {
    if (!pendingFirst) {
      setPendingFirst(value);
      setError(null);
      return;
    }
    if (value !== pendingFirst) {
      setError(mode === 'pin' ? 'PINs did not match — try again' : 'Passwords did not match — try again');
      setPendingFirst(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authApi.setup(mode, value);
      await qc.invalidateQueries({ queryKey: ['auth', 'status'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setPendingFirst(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(value: string) {
    setBusy(true);
    setError(null);
    try {
      await authApi.login(value);
      await qc.invalidateQueries({ queryKey: ['auth', 'status'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Incorrect credential');
    } finally {
      setBusy(false);
    }
  }

  async function handleMultiUserLogin(username: string, password: string) {
    setBusy(true);
    setError(null);
    try {
      await authApi.loginMultiUser(username, password);
      await qc.invalidateQueries({ queryKey: ['auth', 'status'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Incorrect username or password');
    } finally {
      setBusy(false);
    }
  }

  // Dev/testing deployment (SHOW_ALL_SERVICES=true, see middleware/auth.js) — skip the lock
  // screen entirely so whoever is building/testing the app never gets locked out of their own
  // instance. A real deployment still requires the PIN/password set up below.
  if (authBypass) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // A session token signed before a deployment switched into multi-user mode carries no
  // {userId, role} — still a validly-signed JWT (so `authenticated` is true), but meaningless
  // once roles matter. Fall through to the multi-user login below instead of granting access
  // with no resolved identity.
  const staleSimpleModeSession = data?.multiUser && data.authenticated && !data.user;

  if (data?.authenticated && !staleSimpleModeSession) {
    return <>{children}</>;
  }

  // Multi-user mode's sign-in is username+password, resolved server-side to an account — never
  // the setup/PIN/password flow below, which only applies to simple mode's single shared credential.
  if (data?.multiUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <UsernamePasswordEntry title="Sign in" error={error} busy={busy} onComplete={handleMultiUserLogin} />
      </div>
    );
  }

  const setupMode = !data?.hasCredential;

  if (setupMode && !chosenMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <ModePicker onChoose={setChosenMode} />
      </div>
    );
  }

  const mode = (setupMode ? chosenMode! : data!.authMode!) as AuthMode;
  const modeLabel = mode === 'pin' ? 'PIN' : 'password';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
      {mode === 'pin' ? (
        <PinPad
          key={pendingFirst ? 'confirm' : 'create'}
          title={setupMode ? (pendingFirst ? 'Confirm your PIN' : 'Create a PIN') : 'Enter your PIN'}
          subtitle={
            setupMode
              ? pendingFirst
                ? 'Enter it once more to confirm'
                : 'This locks the dashboard on this server — not a security boundary, just a convenience lock'
              : undefined
          }
          error={error}
          busy={busy}
          onComplete={(value) => (setupMode ? handleSetup('pin', value) : handleLogin(value))}
        />
      ) : (
        <PasswordEntry
          key={pendingFirst ? 'confirm' : 'create'}
          title={setupMode ? (pendingFirst ? 'Confirm your password' : 'Create a password') : 'Enter your password'}
          subtitle={
            setupMode
              ? pendingFirst
                ? 'Enter it once more to confirm'
                : 'This locks the dashboard on this server — not a security boundary, just a convenience lock'
              : undefined
          }
          error={error}
          busy={busy}
          onComplete={(value) => (setupMode ? handleSetup('password', value) : handleLogin(value))}
        />
      )}

      {setupMode && !pendingFirst && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setChosenMode(null)}
        >
          Use a {mode === 'pin' ? 'password' : 'PIN'} instead
        </button>
      )}
    </div>
  );
}
