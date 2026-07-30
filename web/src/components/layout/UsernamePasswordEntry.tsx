import { useState } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function UsernamePasswordEntry({
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
  onComplete: (username: string, password: string) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password || busy) return;
    onComplete(username, password);
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
          type="text"
          autoFocus
          autoComplete="username"
          placeholder="Username"
          value={username}
          disabled={busy}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          disabled={busy}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !username || !password} size="lg">
          Sign in
        </Button>
      </form>
    </motion.div>
  );
}
