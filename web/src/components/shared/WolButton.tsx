import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { wolApi } from '@/lib/api';

export function WolButton({
  wolMac,
  wolBroadcast,
  className,
}: {
  wolMac?: string | null;
  wolBroadcast?: string | null;
  className?: string;
}) {
  if (!wolMac) return null;

  async function wake() {
    try {
      await wolApi.wake(wolMac!, wolBroadcast || undefined);
      toast.success('Magic packet sent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send Wake-on-LAN packet');
    }
  }

  return (
    <Button variant="secondary" size="sm" className={className} onClick={wake}>
      <Zap className="h-3.5 w-3.5" /> Wake
    </Button>
  );
}
