import { ExternalLink } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WolButton } from '@/components/shared/WolButton';
import { getServiceIcon } from '@/lib/serviceIcons';
import type { ServiceDefinition } from '@/lib/serviceRegistry';
import type { ServiceInstance } from '@/lib/api';

export function GenericServiceScreen({ definition, instance }: { definition: ServiceDefinition; instance?: ServiceInstance }) {
  const Icon = getServiceIcon(definition.id);
  const openUrl = instance ? (instance.preferredMode === 'remote' ? instance.remoteUrl : instance.localUrl) : null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${definition.brandColor}22`, color: definition.brandColor }}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{instance?.displayName ?? definition.displayName}</h1>
          {definition.helpText && <p className="text-sm text-muted-foreground">{definition.helpText}</p>}
        </div>
      </div>

      {!instance ? (
        <Card>
          <CardHeader>
            <CardTitle>Not configured yet</CardTitle>
            <CardDescription>Add this service in Settings to start using it.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/settings/services">Go to Settings</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Connected</CardTitle>
            <CardDescription>
              {definition.authType === 'none'
                ? 'This service doesn’t have a live API integration — use the link below to open it directly.'
                : 'Deeper integration for this service is coming in a later phase.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {openUrl && (
              <Button variant="outline" asChild>
                <a href={openUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open
                </a>
              </Button>
            )}
            <WolButton wolMac={instance.wolMac} wolBroadcast={instance.wolBroadcast} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
