import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

const PIN_MIN = 4;
const PIN_MAX = 8;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'confirm', '0', 'back'];

export function PinPad({
  title,
  subtitle,
  error,
  busy,
  onComplete,
  minLength = PIN_MIN,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  busy?: boolean;
  onComplete: (pin: string) => void;
  /** Raises the minimum for creating/confirming a NEW pin (6, since a 4-digit PIN is only
   * 10,000 combinations) without affecting logging in with an existing shorter one — omit for
   * login, the default (4) matches whatever length a user's current PIN already is. */
  minLength?: number;
}) {
  const [digits, setDigits] = useState('');
  const [shakeSeq, setShakeSeq] = useState(0);

  useEffect(() => {
    if (error) setShakeSeq((s) => s + 1);
  }, [error]);

  function submit() {
    if (digits.length < minLength) return;
    onComplete(digits);
    setDigits('');
  }

  function press(key: string) {
    if (busy) return;
    if (key === 'back') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (key === 'confirm') {
      submit();
      return;
    }
    if (!key || digits.length >= PIN_MAX) return;
    const next = digits + key;
    setDigits(next);
    if (next.length === PIN_MAX) {
      onComplete(next);
      setDigits('');
    }
  }

  const dotCount = Math.min(PIN_MAX, Math.max(minLength, digits.length));
  const canSubmit = digits.length >= minLength;

  return (
    <motion.div
      className="flex flex-col items-center gap-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
    >
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <motion.div
        key={shakeSeq}
        initial={{ x: 0 }}
        animate={shakeSeq > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3"
      >
        {Array.from({ length: dotCount }).map((_, i) => (
          <motion.div
            key={i}
            animate={{ scale: i < digits.length ? 1 : 0.85 }}
            className={cn(
              'h-3.5 w-3.5 rounded-full border-2 border-primary/70 transition-colors',
              i < digits.length ? 'bg-primary' : 'bg-transparent',
            )}
          />
        ))}
      </motion.div>

      {error && (
        <p className="-mt-4 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-4">
        {KEYS.map((key, i) => {
          if (key === 'confirm') {
            return (
              <motion.button
                key={i}
                type="button"
                disabled={busy || !canSubmit}
                whileTap={canSubmit ? { scale: 0.9 } : undefined}
                onClick={() => press(key)}
                aria-label="Confirm PIN"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-border transition-colors hover:bg-accent disabled:opacity-30"
              >
                <Check className="h-5 w-5" />
              </motion.button>
            );
          }
          return (
            <motion.button
              key={i}
              type="button"
              disabled={busy}
              whileTap={{ scale: 0.9 }}
              onClick={() => press(key)}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-lg font-medium shadow-sm ring-1 ring-border transition-colors hover:bg-accent disabled:opacity-50"
            >
              {key === 'back' ? <Delete className="h-5 w-5" /> : key}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
