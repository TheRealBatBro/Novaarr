import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link2, X } from 'lucide-react';
import { usersApi, type AppUser, type ServiceInstance } from '@/lib/api';
import { useServices } from '@/lib/queries';
import { LINKABLE_SOURCES, fetchLinkableAccounts, findDerivedMatches, type LinkableAccount } from '@/lib/accountLinking';
import { getServiceIcon } from '@/lib/serviceIcons';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

function InstanceRow({
  instance,
  linkedExternalId,
  allInstances,
  userId,
}: {
  instance: ServiceInstance;
  linkedExternalId?: string;
  allInstances: ServiceInstance[];
  userId: number;
}) {
  const qc = useQueryClient();
  const [accounts, setAccounts] = useState<LinkableAccount[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLinkableAccounts(instance).then((list) => {
      if (!cancelled) {
        setAccounts(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [instance.id]);

  const link = useMutation({
    mutationFn: async (account: LinkableAccount) => {
      await usersApi.upsertLink(userId, instance.id, { externalId: account.id, externalName: account.name });
      const derived = await findDerivedMatches(allInstances, account.name);
      for (const match of derived) {
        await usersApi.upsertLink(userId, match.instance.id, { externalId: match.externalId, externalName: match.externalName, auto: true });
      }
      return derived;
    },
    onSuccess: (derived) => {
      qc.invalidateQueries({ queryKey: ['user-links', userId] });
      if (derived.length > 0) toast.success(`Also linked ${derived.map((d) => d.instance.displayName).join(', ')} automatically`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to link account'),
  });

  const unlink = useMutation({
    mutationFn: () => usersApi.removeLink(userId, instance.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-links', userId] }),
  });

  const Icon = getServiceIcon(instance.serviceId);
  const brandColor = getServiceDefinition(instance.serviceId)?.brandColor;

  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${brandColor}22`, color: brandColor }}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="w-24 shrink-0 truncate text-sm">{instance.displayName}</p>
      <Select
        className="h-9 flex-1 text-sm"
        disabled={loading || link.isPending}
        value={linkedExternalId ?? ''}
        onChange={(e) => {
          const account = accounts?.find((a) => a.id === e.target.value);
          if (account) link.mutate(account);
        }}
      >
        <option value="">{loading ? 'Loading…' : 'Not linked'}</option>
        {accounts?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      {linkedExternalId && (
        <button type="button" onClick={() => unlink.mutate()} aria-label={`Unlink ${instance.displayName}`} className="shrink-0 text-muted-foreground hover:text-destructive">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Lets an admin connect a household member's account to their identity on Plex/Emby/Jellyfin —
 * Overseerr/Ombi links are then derived automatically by matching usernames (see
 * lib/accountLinking.ts), since those two are typically just synced from the same Plex users. */
export function UserLinksEditor({ user }: { user: AppUser }) {
  const { data: instances = [] } = useServices();
  const { data: links = [] } = useQuery({ queryKey: ['user-links', user.id], queryFn: () => usersApi.links(user.id) });
  const candidates = instances.filter((i) => LINKABLE_SOURCES.includes(i.serviceId) && i.enabled);
  const derivedLinks = links.filter((l) => !candidates.some((c) => c.id === l.instanceId));

  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">Configure Plex, Emby, or Jellyfin first to link accounts here.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" /> Linked accounts
      </div>
      {candidates.map((instance) => (
        <InstanceRow
          key={instance.id}
          instance={instance}
          linkedExternalId={links.find((l) => l.instanceId === instance.id)?.externalId}
          allInstances={instances}
          userId={user.id}
        />
      ))}
      {derivedLinks.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Also connected: {derivedLinks.map((l) => `${instances.find((i) => i.id === l.instanceId)?.displayName ?? 'a service'} (${l.externalName})`).join(', ')}
        </p>
      )}
    </div>
  );
}
