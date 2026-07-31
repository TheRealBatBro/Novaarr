import { useState } from 'react';
import { Plus, X, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { ServiceDefinition } from '@/lib/serviceRegistry';
import { servicesApi, type ServiceInstance, type ServiceInstanceInput } from '@/lib/api';
import { useCreateService, useUpdateService } from '@/lib/queries';

export function ServiceInstanceForm({
  definition,
  existing,
  onDone,
}: {
  definition: ServiceDefinition;
  existing?: ServiceInstance;
  onDone: () => void;
}) {
  const [displayName, setDisplayName] = useState(existing?.displayName ?? definition.displayName);
  const [localUrl, setLocalUrl] = useState(existing?.localUrl ?? '');
  const [remoteUrl, setRemoteUrl] = useState(existing?.remoteUrl ?? '');
  const [preferredMode, setPreferredMode] = useState(existing?.preferredMode ?? 'auto');
  const [credentials, setCredentials] = useState<Record<string, string>>(existing?.credentials ?? {});
  const [wolMac, setWolMac] = useState(existing?.wolMac ?? '');
  const [wolBroadcast, setWolBroadcast] = useState(existing?.wolBroadcast ?? '');
  const [headerRows, setHeaderRows] = useState<{ key: string; value: string }[]>(
    existing?.customHeaders ? Object.entries(existing.customHeaders).map(([key, value]) => ({ key, value })) : [],
  );
  const [ignoreCertErrors, setIgnoreCertErrors] = useState(existing?.ignoreCertErrors ?? false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'failed'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  const create = useCreateService();
  const update = useUpdateService();
  const busy = create.isPending || update.isPending || testState === 'testing';
  const isFixedBaseUrl = !!definition.fixedBaseUrl;

  function buildInput(): ServiceInstanceInput {
    return {
      displayName,
      // Always re-sync to the registry's current authType, not just on first creation — a
      // service's auth mechanism is a property of its type, not user-editable instance data,
      // so a later registry correction (e.g. Tracearr moving off a placeholder 'none' auth)
      // must reach already-configured instances too, not just brand-new ones.
      authType: definition.authType,
      localUrl: isFixedBaseUrl ? definition.fixedBaseUrl : localUrl || undefined,
      remoteUrl: isFixedBaseUrl ? undefined : remoteUrl || undefined,
      preferredMode: (isFixedBaseUrl ? 'local' : preferredMode) as 'auto' | 'local' | 'remote',
      credentials,
      wolMac: isFixedBaseUrl ? undefined : wolMac || undefined,
      wolBroadcast: isFixedBaseUrl ? undefined : wolBroadcast || undefined,
      customHeaders: isFixedBaseUrl
        ? undefined
        : Object.fromEntries(headerRows.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value])),
      ignoreCertErrors: isFixedBaseUrl ? undefined : ignoreCertErrors,
    };
  }

  async function save(input: ServiceInstanceInput) {
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, input });
        toast.success(`${displayName} updated`);
      } else {
        await create.mutateAsync({ serviceId: definition.id, ...input });
        toast.success(`${displayName} added`);
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleSubmit(e: React.FormEvent, skipTest = false) {
    e.preventDefault();
    const input = buildInput();

    if (skipTest) {
      setTestState('idle');
      await save(input);
      return;
    }

    setTestState('testing');
    setTestError(null);
    try {
      const result = await servicesApi.test({
        ...input,
        serviceId: definition.id,
        testPath: definition.healthCheck?.path,
        testMethod: definition.healthCheck?.method,
        testQuery: definition.healthCheck?.query,
        testBody: definition.healthCheck?.body,
      });
      if (!result.ok) {
        setTestState('failed');
        setTestError(result.error || 'Connection test failed');
        return;
      }
    } catch (err) {
      setTestState('failed');
      setTestError(err instanceof Error ? err.message : 'Connection test failed');
      return;
    }
    setTestState('idle');
    await save(input);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="displayName">Display name</Label>
        <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </div>

      {!isFixedBaseUrl && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="localUrl">Local URL</Label>
            <Input
              id="localUrl"
              placeholder="http://192.168.1.50:8989"
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="remoteUrl">Remote URL (optional)</Label>
            <Input
              id="remoteUrl"
              placeholder="https://sonarr.mydomain.com"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="preferredMode">Connection preference</Label>
            <Select id="preferredMode" value={preferredMode} onChange={(e) => setPreferredMode(e.target.value)}>
              <option value="auto">Auto (prefer local)</option>
              <option value="local">Always local</option>
              <option value="remote">Always remote</option>
            </Select>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={ignoreCertErrors}
              onChange={(e) => setIgnoreCertErrors(e.target.checked)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                Ignore certificate errors
              </span>
              <span className="text-xs text-muted-foreground">
                Allow self-signed or invalid HTTPS certificates — needed for services reached over a local IP (e.g. Plex).
              </span>
            </span>
          </label>
        </>
      )}

      {definition.fields.map((field) => (
        <div className="grid gap-1.5" key={field.key}>
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input
            id={field.key}
            type={field.type === 'password' ? 'password' : 'text'}
            placeholder={field.placeholder}
            required={field.required}
            value={credentials[field.key] ?? ''}
            onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))}
          />
          {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
        </div>
      ))}

      {!isFixedBaseUrl && (
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="wolMac">Wake-on-LAN MAC (optional)</Label>
            <Input id="wolMac" placeholder="AA:BB:CC:DD:EE:FF" value={wolMac} onChange={(e) => setWolMac(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wolBroadcast">Broadcast address</Label>
            <Input
              id="wolBroadcast"
              placeholder="255.255.255.255"
              value={wolBroadcast}
              onChange={(e) => setWolBroadcast(e.target.value)}
            />
          </div>
        </div>
      )}

      {!isFixedBaseUrl && (
        <div className="grid gap-1.5">
          <Label>Custom headers (optional)</Label>
          <p className="text-xs text-muted-foreground">
            Sent with every request to this service — e.g. a Tailscale Serve/Funnel auth header or a reverse-proxy secret.
          </p>
          {headerRows.map((row, i) => (
            <div className="flex gap-2" key={i}>
              <Input
                placeholder="Header-Name"
                value={row.key}
                onChange={(e) => setHeaderRows((rows) => rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
              />
              <Input
                placeholder="value"
                value={row.value}
                onChange={(e) => setHeaderRows((rows) => rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove header"
                onClick={() => setHeaderRows((rows) => rows.filter((_, j) => j !== i))}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setHeaderRows((rows) => [...rows, { key: '', value: '' }])}>
            <Plus className="h-3.5 w-3.5" /> Add header
          </Button>
        </div>
      )}

      {testState === 'failed' && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">Connection test failed</p>
          <p className="mt-0.5">{testError}</p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={(e) => handleSubmit(e, true)} disabled={busy}>
            Save anyway
          </Button>
        </div>
      )}

      <Button type="submit" disabled={busy} className="mt-2">
        {testState === 'testing' ? 'Testing connection…' : existing ? 'Save changes' : 'Add service'}
      </Button>
    </form>
  );
}
