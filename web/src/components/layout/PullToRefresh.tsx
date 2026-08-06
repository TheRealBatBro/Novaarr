import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRIGGER_DISTANCE = 64;
const MAX_PULL = 90;
// Pulling 1:1 with the finger feels twitchy and encourages overshoot — real pull-to-refresh
// implementations all apply resistance so the indicator settles well short of the finger.
const RESISTANCE = 0.5;

// Wraps the app's single scrollable <main> — only ever activates when a touch drag starts with
// the container already scrolled to the very top (so it can never fight a normal scroll-up
// gesture midway down a page), and refetches whatever queries are actually mounted on the
// current route rather than needing every page to wire up its own refresh handler.
export function PullToRefresh({ scrollRef, children }: { scrollRef: React.RefObject<HTMLElement>; children: React.ReactNode }) {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    if (refreshing || (scrollRef.current?.scrollTop ?? 0) > 0) {
      tracking.current = false;
      return;
    }
    startY.current = e.touches[0].clientY;
    tracking.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!tracking.current || startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPull(0);
      return;
    }
    setPull(Math.min(delta * RESISTANCE, MAX_PULL));
  }

  async function onTouchEnd() {
    if (!tracking.current) return;
    tracking.current = false;
    startY.current = null;
    if (pull >= TRIGGER_DISTANCE) {
      setRefreshing(true);
      setPull(TRIGGER_DISTANCE * RESISTANCE);
      try {
        await qc.refetchQueries({ type: 'active' });
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }

  const progress = Math.min(pull / (TRIGGER_DISTANCE * RESISTANCE), 1);

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="contents">
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: refreshing ? 40 : pull }}
        aria-hidden={pull === 0 && !refreshing}
      >
        <RefreshCw
          className={cn('h-5 w-5 text-muted-foreground', refreshing && 'animate-spin')}
          style={refreshing ? undefined : { transform: `rotate(${progress * 360}deg)`, opacity: progress }}
        />
      </div>
      {children}
    </div>
  );
}
