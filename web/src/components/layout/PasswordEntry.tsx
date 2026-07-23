import { useState } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function PasswordEntry({
  title,
  subtitle,
  error,
  busy,
  onComplete,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  busy?: boolean;
  onComplete: (password: string) => void;
}) {
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value || busy) return;
    onComplete(value);
    setValue('');
  }

  return (
    <motion.div
      className="flex w-full max-w-xs flex-col items-center gap-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
    >
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
        <Input
          type="password"
          autoFocus
          placeholder="Password"
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
        />
        {error && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !value} size="lg">
          Continue
        </Button>
      </form>
    </motion.div>
  );
}
