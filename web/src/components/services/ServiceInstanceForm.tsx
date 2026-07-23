import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { ServiceDefinition } from '@/lib/serviceRegistry';
import type { ServiceInstance } from '@/lib/api';
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

  const create = useCreateService();
  const update = useUpdateService();
  const busy = create.isPending || update.isPending;
  const isFixedBaseUrl = !!definition.fixedBaseUrl;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
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
    };
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

      <Button type="submit" disabled={busy} className="mt-2">
        {existing ? 'Save changes' : 'Add service'}
      </Button>
    </form>
  );
}
