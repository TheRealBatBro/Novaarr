import { ShieldAlert } from 'lucide-react';

export function AdminOnlyNotice() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-12 text-center">
      <ShieldAlert className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">Admins only</p>
      <p className="max-w-xs text-sm text-muted-foreground">Ask an admin on this deployment to make changes here.</p>
    </div>
  );
}
