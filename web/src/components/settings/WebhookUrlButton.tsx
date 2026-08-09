import { useState } from 'react';
import { toast } from 'sonner';
import { Webhook, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiUrl } from '@/lib/api';

const WEBHOOK_SUPPORTED = new Set(['sonarr', 'radarr', 'prowlarr', 'overseerr', 'tautulli']);

const INSTRUCTIONS: Record<string, string> = {
  sonarr: 'Sonarr → Settings → Connect → add a Webhook connection, paste this as the URL, method POST.',
  radarr: 'Radarr → Settings → Connect → add a Webhook connection, paste this as the URL, method POST.',
  prowlarr: 'Prowlarr → Settings → Connect → add a Webhook connection, paste this as the URL, method POST.',
  overseerr:
    'Overseerr/Jellyseerr → Settings → Notifications → Webhook → paste this as the Webhook URL, then set the JSON Payload to: {"notification_type": "{{notification_type}}", "subject": "{{subject}}", "message": "{{message}}"}',
  tautulli:
    'Tautulli → Settings → Notification Agents → add a Webhook agent → paste this as the Webhook URL. Under Triggers, enable Playback Start and Recently Added. Under the Data tab for each, set the JSON body to: {"action": "{action}", "title": "{title}", "user": "{user}"}',
};

export function WebhookUrlButton({ instanceId, serviceId }: { instanceId: number; serviceId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!WEBHOOK_SUPPORTED.has(serviceId)) return null;

  async function handleOpen() {
    setOpen(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/services/${instanceId}/webhook-url`), { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load webhook URL');
      setUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load webhook URL');
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen} aria-label="Webhook URL" title="Webhook URL">
        <Webhook className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook URL</DialogTitle>
            <DialogDescription>{INSTRUCTIONS[serviceId]}</DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {url && (
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  toast.success('Copied');
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
