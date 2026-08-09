import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Bell, BellOff, Send } from 'lucide-react';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertChannelsCard } from '@/components/settings/AlertChannels';
import { AlertEventsCard } from '@/components/settings/AlertEvents';
import { pushApi } from '@/lib/api';
import { useIsSettingsAdmin } from '@/lib/queries';
import { getPushSubscriptionState, isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push';

export const Route = createFileRoute('/settings/notifications')({ component: SettingsNotifications });

function SettingsNotifications() {
  const isAdmin = useIsSettingsAdmin();
  const [state, setState] = useState<'loading' | 'subscribed' | 'unsubscribed' | 'unsupported'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) {
      setState('unsupported');
      return;
    }
    getPushSubscriptionState().then(setState);
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (state === 'subscribed') {
        await unsubscribeFromPush();
        setState('unsubscribed');
      } else {
        if (Notification.permission === 'denied') {
          setError('Notifications are blocked for this site in your browser settings.');
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setError('Permission was not granted.');
          return;
        }
        await subscribeToPush();
        setState('subscribed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SettingsTabs active="notifications" />
      <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
      <p className="mb-6 text-sm text-muted-foreground">Push notifications on this device/browser — separate per device.</p>

      <Card>
        <CardHeader>
          <CardTitle>Push notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {state === 'unsupported' && (
            <p className="text-sm text-muted-foreground">Your browser doesn't support push notifications.</p>
          )}

          {state !== 'unsupported' && (
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Enable push notifications</p>
                <p className="text-xs text-muted-foreground">Get notified about new pending media requests, right on this device.</p>
              </div>
              <Button variant={state === 'subscribed' ? 'outline' : 'default'} disabled={state === 'loading' || busy} onClick={toggle}>
                {state === 'subscribed' ? (
                  <>
                    <BellOff className="mr-2 h-4 w-4" /> Disable
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" /> Enable
                  </>
                )}
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {state === 'subscribed' && (
            <Button variant="outline" size="sm" className="w-fit" onClick={() => pushApi.test()}>
              <Send className="mr-2 h-4 w-4" /> Send test notification
            </Button>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="mt-6 flex flex-col gap-6">
          <AlertChannelsCard />
          <AlertEventsCard />
        </div>
      )}
    </div>
  );
}
