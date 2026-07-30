import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShieldCheck, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { usersApi, type AppUser } from '@/lib/api';
import { useAuthStatus } from '@/lib/queries';

export const Route = createFileRoute('/settings/users')({ component: SettingsUsers });

function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: usersApi.list });
}

function UserForm({ existing, onClose }: { existing?: AppUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState(existing?.username ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>(existing?.role ?? 'member');

  const save = useMutation({
    mutationFn: () =>
      existing
        ? usersApi.update(existing.id, { username, role, ...(password ? { password } : {}) })
        : usersApi.create(username, password, role),
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
      <Button type="submit" disabled={save.isPending} className="mt-1">
        {existing ? 'Save changes' : 'Create user'}
      </Button>
    </form>
  );
}

function SettingsUsers() {
  const { data: authStatus } = useAuthStatus();
  const { data: users = [], isLoading } = useUsers();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AppUser | 'new' | null>(null);
  const isAdmin = authStatus?.user?.role === 'admin';

  const remove = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User removed');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove user'),
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
                  <p className="text-xs capitalize text-muted-foreground">{u.role}</p>
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

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add user' : 'Edit user'}</DialogTitle>
            <DialogDescription>{editing === 'new' ? 'Create a new account for a household member.' : 'Update this account.'}</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <UserForm existing={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
