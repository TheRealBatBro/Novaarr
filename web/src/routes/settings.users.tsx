import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShieldCheck, User as UserIcon, KeySquare } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { usersApi, accessRolesApi, type AppUser, type AccessRole } from '@/lib/api';
import { useAuthStatus, useServices } from '@/lib/queries';
import { UserLinksEditor } from '@/components/settings/UserLinksEditor';

export const Route = createFileRoute('/settings/users')({ component: SettingsUsers });

function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: usersApi.list });
}

function useAccessRoles() {
  return useQuery({ queryKey: ['access-roles'], queryFn: accessRolesApi.list });
}

function UserForm({ existing, onClose }: { existing?: AppUser; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: roles = [] } = useAccessRoles();
  const [username, setUsername] = useState(existing?.username ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>(existing?.role ?? 'member');
  const [accessRoleId, setAccessRoleId] = useState<number | null>(existing?.accessRoleId ?? null);

  const save = useMutation({
    mutationFn: () =>
      existing
        ? usersApi.update(existing.id, { username, role, accessRoleId, ...(password ? { password } : {}) })
        : usersApi.create(username, password, role).then((u) => (accessRoleId ? usersApi.update(u.id, { accessRoleId }) : u)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(existing ? 'User updated' : 'User created');
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save'),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input id="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">{existing ? 'New password (leave blank to keep current)' : 'Password'}</Label>
        <Input
          id="password"
          type="password"
          required={!existing}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="role">Role</Label>
        <Select id="role" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
      {role === 'member' && (
        <div className="grid gap-1.5">
          <Label htmlFor="accessRole">Access role</Label>
          <Select
            id="accessRole"
            value={accessRoleId ?? ''}
            onChange={(e) => setAccessRoleId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Full access (default)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">Restricts which service pages and dashboard widgets this person can see and use.</p>
        </div>
      )}
      <Button type="submit" disabled={save.isPending} className="mt-1">
        {existing ? 'Save changes' : 'Create user'}
      </Button>
    </form>
  );
}

function AccessRoleForm({ existing, onClose }: { existing?: AccessRole; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: instances = [] } = useServices();
  const [name, setName] = useState(existing?.name ?? '');
  const [instanceIds, setInstanceIds] = useState<Set<number>>(new Set(existing?.serviceInstanceIds ?? []));

  const save = useMutation({
    mutationFn: () =>
      existing
        ? accessRolesApi.update(existing.id, { name, instanceIds: [...instanceIds] })
        : accessRolesApi.create(name, [...instanceIds]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-roles'] });
      toast.success(existing ? 'Role updated' : 'Role created');
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save'),
  });

  function toggle(id: number) {
    setInstanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="roleName">Role name</Label>
        <Input id="roleName" required placeholder="e.g. Kids" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label>Allowed services</Label>
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
          {instances.length === 0 && <p className="p-2 text-sm text-muted-foreground">Configure a service first.</p>}
          {instances.map((i) => (
            <label key={i.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
              <input type="checkbox" checked={instanceIds.has(i.id)} onChange={() => toggle(i.id)} />
              {i.displayName}
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={save.isPending} className="mt-1">
        {existing ? 'Save changes' : 'Create role'}
      </Button>
    </form>
  );
}

function SettingsUsers() {
  const { data: authStatus } = useAuthStatus();
  const { data: users = [], isLoading } = useUsers();
  const { data: roles = [] } = useAccessRoles();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AppUser | 'new' | null>(null);
  const [editingRole, setEditingRole] = useState<AccessRole | 'new' | null>(null);
  const isAdmin = authStatus?.user?.role === 'admin';
  const roleName = (id?: number | null) => roles.find((r) => r.id === id)?.name;

  const remove = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User removed');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove user'),
  });

  const removeRole = useMutation({
    mutationFn: (id: number) => accessRolesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-roles'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Role removed');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove role'),
  });

  return (
    <div>
      <SettingsTabs active="users" />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage who can sign in and what they can do.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setEditing('new')} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add user
          </Button>
        )}
      </div>

      {!isAdmin && (
        <p className="mb-4 text-sm text-muted-foreground">Only admins can manage users — you can view your own account here.</p>
      )}

      <div className="flex flex-col gap-2">
        {!isLoading &&
          users.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  {u.role === 'admin' ? <ShieldCheck className="h-4 w-4 text-primary" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.username}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {u.role}
                    {u.role === 'member' && roleName(u.accessRoleId) && ` · ${roleName(u.accessRoleId)}`}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove.mutate(u.id)}
                      disabled={remove.isPending}
                      aria-label={`Remove ${u.username}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
      </div>

      {isAdmin && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <KeySquare className="h-4 w-4 text-muted-foreground" /> Access roles
              </h2>
              <p className="text-xs text-muted-foreground">Named sets of services a member can be restricted to.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditingRole('new')} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add role
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {roles.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.serviceInstanceIds.length} service{r.serviceInstanceIds.length === 1 ? '' : 's'}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditingRole(r)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeRole.mutate(r.id)} disabled={removeRole.isPending} aria-label={`Remove ${r.name}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {roles.length === 0 && <p className="text-sm text-muted-foreground">No access roles yet — members default to full access.</p>}
          </div>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add user' : 'Edit user'}</DialogTitle>
            <DialogDescription>{editing === 'new' ? 'Create a new account for a household member.' : 'Update this account.'}</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <UserForm existing={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
          )}
          {editing !== null && editing !== 'new' && (
            <div className="border-t border-border pt-4">
              <UserLinksEditor user={editing} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editingRole !== null} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole === 'new' ? 'Add access role' : 'Edit access role'}</DialogTitle>
            <DialogDescription>Choose which services a member with this role can see and use.</DialogDescription>
          </DialogHeader>
          {editingRole !== null && (
            <AccessRoleForm existing={editingRole === 'new' ? undefined : editingRole} onClose={() => setEditingRole(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
