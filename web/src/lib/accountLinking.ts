import { proxyApi, type ServiceInstance } from './api';

export type LinkableAccount = { id: string; name: string };

// Plex/Emby/Jellyfin are the actual streaming accounts an admin picks directly — Overseerr and
// Ombi accounts are then derived automatically (below) by matching usernames, since both are
// typically provisioned by syncing the same Plex users rather than being a separate identity an
// admin would otherwise have to look up by hand.
export const LINKABLE_SOURCES = ['plex', 'emby', 'jellyfin'];
export const DERIVED_SOURCES = ['overseerr', 'ombi'];

export async function fetchLinkableAccounts(instance: ServiceInstance): Promise<LinkableAccount[]> {
  try {
    if (instance.serviceId === 'plex') {
      const res = await proxyApi.call<{ MediaContainer?: { Account?: { id: number; name?: string; title?: string }[] } }>(instance.id, {
        path: '/accounts',
        timeoutMs: 10_000,
      });
      const accounts = res.ok ? res.data?.MediaContainer?.Account ?? [] : [];
      return accounts.map((a) => ({ id: String(a.id), name: a.name || a.title || `Account ${a.id}` }));
    }
    // Emby/Jellyfin
    const res = await proxyApi.call<{ Id: string; Name: string }[]>(instance.id, { path: '/Users', timeoutMs: 10_000 });
    const users = res.ok && Array.isArray(res.data) ? res.data : [];
    return users.map((u) => ({ id: u.Id, name: u.Name }));
  } catch {
    return [];
  }
}

export type DerivedMatch = { instance: ServiceInstance; externalId: string; externalName: string };

/** Given a chosen Plex/Emby/Jellyfin account name, best-effort match it against any configured
 * Overseerr/Ombi instance's own user list by username — both commonly sync their users from Plex. */
export async function findDerivedMatches(instances: ServiceInstance[], chosenName: string): Promise<DerivedMatch[]> {
  const matches: DerivedMatch[] = [];
  const norm = chosenName.toLowerCase();

  const overseerr = instances.find((i) => i.serviceId === 'overseerr' && i.enabled);
  if (overseerr) {
    try {
      const res = await proxyApi.call<{ results?: { id: number; username?: string; plexUsername?: string; displayName?: string }[] }>(
        overseerr.id,
        { path: '/api/v1/user', query: { take: '100' }, timeoutMs: 10_000 },
      );
      const found = (res.ok ? res.data?.results ?? [] : []).find((u) =>
        [u.plexUsername, u.username, u.displayName].some((v) => v && v.toLowerCase() === norm),
      );
      if (found) {
        matches.push({ instance: overseerr, externalId: String(found.id), externalName: found.displayName || found.username || found.plexUsername || chosenName });
      }
    } catch {
      // best-effort — no match rather than a broken step
    }
  }

  const ombi = instances.find((i) => i.serviceId === 'ombi' && i.enabled);
  if (ombi) {
    try {
      const res = await proxyApi.call<{ id: string; userName?: string }[]>(ombi.id, { path: '/api/v1/Identity/Users', timeoutMs: 10_000 });
      const found = (res.ok && Array.isArray(res.data) ? res.data : []).find((u) => u.userName?.toLowerCase() === norm);
      if (found) matches.push({ instance: ombi, externalId: String(found.id), externalName: found.userName || chosenName });
    } catch {
      // best-effort
    }
  }

  return matches;
}
