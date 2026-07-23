import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = { children: ReactNode; resetKey: string };
type State = { error: Error | null };

/**
 * Catches render/lifecycle crashes from a route's own tree (e.g. a service screen choking on
 * an unexpected shape from a down/misbehaving upstream) so they can't take out the whole app —
 * only the content area falls back, the sidebar/topbar stay usable. React error boundaries only
 * catch what's below them and must be a class component (no hook equivalent exists).
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-8 text-center text-destructive">
          <AlertTriangle className="h-6 w-6" />
          <p className="text-sm font-medium">This page hit an unexpected error.</p>
          <p className="max-w-md text-xs text-destructive/80">{this.state.error.message || 'Unknown error'}</p>
          <Button variant="outline" size="sm" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
