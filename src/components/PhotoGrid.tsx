import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

import type { Photo } from '@/types';
import { deletePhoto, listPhotosForLine } from '@/db/photos';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface PhotoGridProps {
  lineId: string;
}

// Lazy-init the object URL at first render (synchronous, no effect).
// The accompanying effect runs only the revoke on unmount. Consumers that
// need the URL to follow a changing blob prop should key their parent
// element on the blob source so the whole hook instance remounts — the
// lightbox does this via `key={currentPhoto.id}` on <Lightbox />.
function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url] = useState<string | null>(() =>
    blob ? URL.createObjectURL(blob) : null,
  );
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

interface ThumbnailProps {
  photo: Photo;
  onOpen: () => void;
  onDelete: () => void;
  index: number;
}

function Thumbnail({ photo, onOpen, onDelete, index }: ThumbnailProps) {
  const url = useObjectUrl(photo.thumbnailBlob);
  return (
    <div className="group relative overflow-hidden rounded-md border bg-muted">
      <button
        type="button"
        onClick={onOpen}
        className="block h-24 w-full"
        aria-label={`Foto ${index + 1} openen`}
      >
        {url && (
          <img
            src={url}
            alt={`Foto ${index + 1}`}
            className="h-full w-full object-cover"
          />
        )}
      </button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute right-1 top-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Foto ${index + 1} verwijderen`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Foto verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze foto wordt permanent verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface LightboxProps {
  photo: Photo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  indexLabel: string;
}

function Lightbox({
  photo,
  open,
  onOpenChange,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  indexLabel,
}: LightboxProps) {
  const url = useObjectUrl(photo.blob);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      else if (e.key === 'ArrowRight' && hasNext) onNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hasPrev, hasNext, onPrev, onNext]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-2">
        <DialogTitle className="sr-only">{indexLabel}</DialogTitle>
        <DialogDescription className="sr-only">
          Bekijk de foto op ware grootte. Gebruik de pijltoetsen om tussen
          foto&apos;s te navigeren.
        </DialogDescription>
        <div className="relative flex items-center justify-center">
          {url && (
            <img
              src={url}
              alt={indexLabel}
              className="max-h-[80vh] w-auto rounded"
            />
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onPrev}
            disabled={!hasPrev}
            className={cn(
              'absolute left-2 top-1/2 -translate-y-1/2 opacity-80',
              !hasPrev && 'invisible',
            )}
            aria-label="Vorige foto"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onNext}
            disabled={!hasNext}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 opacity-80',
              !hasNext && 'invisible',
            )}
            aria-label="Volgende foto"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            {indexLabel}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PhotoGrid({ lineId }: PhotoGridProps) {
  const photos = useLiveQuery<Photo[], Photo[]>(
    () => listPhotosForLine(lineId),
    [lineId],
    [],
  );

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const currentPhoto = useMemo(
    () => (openIndex !== null ? photos[openIndex] : null),
    [photos, openIndex],
  );

  async function handleDelete(id: string) {
    await deletePhoto(id);
  }

  if (photos.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Nog geen foto's.</p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <Thumbnail
              photo={photo}
              index={i}
              onOpen={() => setOpenIndex(i)}
              onDelete={() => handleDelete(photo.id)}
            />
          </li>
        ))}
      </ul>

      {currentPhoto && openIndex !== null && (
        <Lightbox
          key={currentPhoto.id}
          photo={currentPhoto}
          open
          onOpenChange={(open) => !open && setOpenIndex(null)}
          onPrev={() => setOpenIndex((i) => (i === null ? null : Math.max(0, i - 1)))}
          onNext={() =>
            setOpenIndex((i) => (i === null ? null : Math.min(photos.length - 1, i + 1)))
          }
          hasPrev={openIndex > 0}
          hasNext={openIndex < photos.length - 1}
          indexLabel={`${openIndex + 1} / ${photos.length}`}
        />
      )}
    </>
  );
}
