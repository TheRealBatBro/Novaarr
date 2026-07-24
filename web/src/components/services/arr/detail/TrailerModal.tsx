import { X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function TrailerModal({ youtubeKey, title, onClose }: { youtubeKey: string; title: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose className="max-w-3xl overflow-hidden p-0">
        <div className="relative aspect-video w-full bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${youtubeKey}?autoplay=1`}
            title={`${title} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trailer"
            className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
