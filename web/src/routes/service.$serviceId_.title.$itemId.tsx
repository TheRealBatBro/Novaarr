import { createFileRoute } from '@tanstack/react-router';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { useServices, resolveServiceParam } from '@/lib/queries';
import { SeriesDetailPage } from '@/components/services/arr/SeriesDetailPage';
import { MovieDetailPage } from '@/components/services/arr/MovieDetailPage';

export const Route = createFileRoute('/service/$serviceId/title/$itemId')({ component: TitleDetail });

function TitleDetail() {
  const { serviceId, itemId } = Route.useParams();
  const { data: instances = [] } = useServices();
  const instance = resolveServiceParam(instances, serviceId);
  const definition = getServiceDefinition(instance?.serviceId ?? serviceId);
  const id = Number(itemId);

  if (!definition || !instance) {
    return <p className="text-muted-foreground">Unknown service “{serviceId}”.</p>;
  }

  if (definition.id === 'sonarr') return <SeriesDetailPage instance={instance} seriesId={id} />;
  if (definition.id === 'radarr') return <MovieDetailPage instance={instance} movieId={id} />;

  return <p className="text-muted-foreground">No detail page for “{serviceId}”.</p>;
}
