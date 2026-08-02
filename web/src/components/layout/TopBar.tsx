import { Menu, Moon, Search, Sun } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/useUiStore';
import { BASE_PATH } from '@/lib/api';

export function TopBar() {
  const { theme, setTheme, setPaletteOpen, setDrawerOpen } = useUiStore();
  const navigate = useNavigate();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-3 sm:px-5">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <button type="button" onClick={() => navigate({ to: '/' })} className="ml-1 flex items-center gap-2 text-lg font-bold tracking-tight hover:text-primary">
          <img src={`${BASE_PATH}/icon.png`} alt="" className="h-6 w-6 rounded-md" />
          Novaarr
        </button>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-2 text-muted-foreground sm:flex"
          onClick={() => setPaletteOpen(true)}
        >
          <Search className="h-3.5 w-3.5" />
          Jump to…
          <kbd className="rounded border border-border px-1 text-[10px]">⌘K</kbd>
        </Button>
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setPaletteOpen(true)} aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
