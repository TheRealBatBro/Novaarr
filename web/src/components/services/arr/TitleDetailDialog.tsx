import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ServiceInstance } from '@/lib/api';
import { MovieDetailPage } from './MovieDetailPage';
import { SeriesDetailPage } from './SeriesDetailPage';

/** Renders the same Radarr/Sonarr detail page used at /service/:id/title/:itemId inside a
 * dialog instead — used for dashboard poster clicks, where navigating to a full page means
 * "back" lands on the service's library rather than the dashboard the user actually came from.
 * The inner wrapper reproduces the root layout's own padding (px-4 py-6 sm:px-6) so MediaHero's
 * edge-to-edge backdrop (`-mx-4 sm:-mx-6`) bleeds correctly, exactly as it does on the full page. */
export function TitleDetailDialog({
  serviceId,
  instance,
  itemId,
  onClose,
}: {
  serviceId: 'radarr' | 'sonarr';
  instance: ServiceInstance;
  itemId: number;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose className="max-w-3xl gap-0 p-0 max-h-[90vh] overflow-y-auto">
        {/* DialogContent is `display: grid` — without `self-start`, this lone grid item defaults
            to `align-items: stretch` and stretches to the dialog's full ~90vh height, which then
            makes MediaHero's `aspect-[21/9]` backdrop compute its width FROM that stretched
            height instead of from the dialog's actual width, blowing the image out sideways. */}
        <div className="min-w-0 self-start px-4 py-6 sm:px-6">
          {serviceId === 'radarr' ? (
            <MovieDetailPage instance={instance} movieId={itemId} onBack={onClose} />
          ) : (
            <SeriesDetailPage instance={instance} seriesId={itemId} onBack={onClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
