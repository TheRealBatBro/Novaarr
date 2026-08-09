import { useState } from 'react';
import { toast } from 'sonner';
import { Send, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAlertChannels, useCreateAlertChannel, useUpdateAlertChannel, useDeleteAlertChannel } from '@/lib/queries';
import { alertsApi, type AlertChannelType } from '@/lib/api';

type FieldDef = { key: string; label: string; placeholder?: string; secret?: boolean };

const CHANNEL_LABELS: Record<AlertChannelType, string> = {
  telegram: 'Telegram',
  ntfy: 'ntfy',
  discord: 'Discord',
  slack: 'Slack',
  pushover: 'Pushover',
  gotify: 'Gotify',
  whatsapp: 'WhatsApp (via Twilio)',
};

const CHANNEL_FIELDS: Record<AlertChannelType, FieldDef[]> = {
  telegram: [
    { key: 'botToken', label: 'Bot token', secret: true, placeholder: 'from @BotFather' },
    { key: 'chatId', label: 'Chat ID', placeholder: 'from @myidbot, or getUpdates' },
  ],
  ntfy: [
    { key: 'serverUrl', label: 'Server URL', placeholder: 'https://ntfy.sh (default) or your own server' },
    { key: 'topic', label: 'Topic', placeholder: 'novaarr-alerts' },
    { key: 'token', label: 'Access token (optional)', secret: true },
  ],
  discord: [{ key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...' }],
  slack: [{ key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...' }],
  pushover: [
    { key: 'appToken', label: 'Application token', secret: true },
    { key: 'userKey', label: 'User key', secret: true },
  ],
  gotify: [
    { key: 'serverUrl', label: 'Server URL', placeholder: 'https://gotify.example.com' },
    { key: 'token', label: 'Application token', secret: true },
  ],
  whatsapp: [
    { key: 'accountSid', label: 'Twilio Account SID', secret: true },
    { key: 'authToken', label: 'Twilio Auth Token', secret: true },
    { key: 'fromNumber', label: 'From number', placeholder: '+14155238886 (Twilio sandbox/your number)' },
    { key: 'toNumber', label: 'To number', placeholder: '+1234567890' },
  ],
};

function AddChannelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [type, setType] = useState<AlertChannelType>('telegram');
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const create = useCreateAlertChannel();

  function handleTypeChange(next: AlertChannelType) {
    setType(next);
    setConfig({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ type, name: name || CHANNEL_LABELS[type], config });
      toast.success('Channel added');
      onOpenChange(false);
      setName('');
      setConfig({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add channel');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an alert channel</DialogTitle>
          <DialogDescription>Novaarr will send a message here whenever an enabled event happens.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="channel-type">Service</Label>
            <Select id="channel-type" value={type} onChange={(e) => handleTypeChange(e.target.value as AlertChannelType)}>
              {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="channel-name">Name (optional)</Label>
            <Input id="channel-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={CHANNEL_LABELS[type]} />
          </div>
          {CHANNEL_FIELDS[type].map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label htmlFor={`field-${f.key}`}>{f.label}</Label>
              <Input
                id={`field-${f.key}`}
                type={f.secret ? 'password' : 'text'}
                placeholder={f.placeholder}
                value={config[f.key] || ''}
                onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <Button type="submit" disabled={create.isPending}>
            Add channel
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AlertChannelsCard() {
  const { data, isLoading } = useAlertChannels();
  const update = useUpdateAlertChannel();
  const remove = useDeleteAlertChannel();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  async function handleTest(id: number) {
    setTestingId(id);
    try {
      await alertsApi.testChannel(id);
      toast.success('Test sent — check that channel');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTestingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert channels</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Telegram, ntfy, Discord, Slack, Pushover, Gotify, or WhatsApp (via your own Twilio account — there's no
          general-purpose, ToS-compliant way to send WhatsApp messages without one).
        </p>

        {!isLoading && data && data.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{CHANNEL_LABELS[c.type]}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={c.enabled} onCheckedChange={(enabled) => update.mutate({ id: c.id, input: { enabled } })} />
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={testingId === c.id} onClick={() => handleTest(c.id)} title="Send test">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove.mutate(c.id)}
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button variant="outline" className="w-fit" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add a channel
        </Button>
        <AddChannelDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </CardContent>
    </Card>
  );
}
