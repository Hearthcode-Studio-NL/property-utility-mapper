import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { addPhoto, MAX_PHOTOS_PER_LINE, PhotoLimitError } from '@/db/photos';
import PhotoAnnotator from './PhotoAnnotator';
import { Button } from '@/components/ui/button';

interface PhotoUploaderProps {
  lineId: string;
  photoCount: number;
  /**
   * Annotation stroke colour (v2.3.4). Line photos use the owning
   * line's utility-type colour so arrows/circles match what's drawn
   * on the map; callers pass it through.
   */
  color: string;
}

export const NON_IMAGE_MESSAGE = 'Alleen afbeeldingen worden ondersteund.';

/**
 * Native file input + "Foto toevoegen" button. `accept="image/*"` alone
 * is enough: on iOS the share sheet shows "Photo Library" + "Take Photo"
 * + "Choose Files", on Android the picker offers camera + gallery, and
 * on desktop the regular file dialog opens. We deliberately do NOT set
 * `capture="environment"` — on iOS that attribute REMOVES the library
 * option and forces the camera, which was the v2.3.2 regression Wijnand
 * flagged on mobile.
 *
 * Defensive: `accept="image/*"` filters the picker on well-behaved
 * browsers, but a user can explicitly pick "All files" on some
 * platforms, so we also gate on MIME in the handler and fire a Dutch
 * error toast for non-images rather than letting the resize pipeline
 * throw opaquely.
 *
 * v2.3.4: each picked image enters an annotation queue. The annotator
 * dialog shows them one at a time; Bewaar / Overslaan advance the
 * queue, dismiss drops the rest.
 */
export default function PhotoUploader({
  lineId,
  photoCount,
  color,
}: PhotoUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const atLimit = photoCount >= MAX_PHOTOS_PER_LINE;
  const current = queue[0] ?? null;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return; // picker cancelled — silent no-op

    const images: File[] = [];
    let rejected = 0;
    for (const f of files) {
      if (f.type.startsWith('image/')) images.push(f);
      else rejected += 1;
    }
    if (rejected > 0) toast.error(NON_IMAGE_MESSAGE);
    if (images.length === 0) return;

    // Respect the per-line limit before queueing — no point annotating a
    // file that will just fail at save time.
    const headroom = Math.max(0, MAX_PHOTOS_PER_LINE - photoCount);
    if (headroom === 0) {
      toast.error(`Maximaal ${MAX_PHOTOS_PER_LINE} foto's per lijn.`);
      return;
    }
    const accepted = images.slice(0, headroom);
    const dropped = images.length - accepted.length;
    if (dropped > 0) {
      toast.error(`Maximaal ${MAX_PHOTOS_PER_LINE} foto's per lijn.`);
    }
    setQueue(accepted);
  }

  async function saveAndAdvance(file: File) {
    setBusy(true);
    try {
      await addPhoto(lineId, file);
      toast.success('Foto toegevoegd.');
    } catch (err) {
      if (err instanceof PhotoLimitError) {
        toast.error(err.message);
      } else {
        toast.error(
          err instanceof Error ? err.message : 'Foto kon niet worden opgeslagen.',
        );
      }
    } finally {
      setBusy(false);
      setQueue((q) => q.slice(1));
    }
  }

  function handleAnnotationDone(result: File) {
    void saveAndAdvance(result);
  }

  function handleAnnotationCancel() {
    // Explicit dismiss = user backed out of the whole batch. Anything
    // already saved (prior files in the queue) stays; remaining files
    // are abandoned. Bewaar / Overslaan advance one at a time instead.
    setQueue([]);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || atLimit || queue.length > 0}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Camera className="h-4 w-4" aria-hidden />
        )}
        Foto toevoegen
      </Button>
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {photoCount} / {MAX_PHOTOS_PER_LINE}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      <PhotoAnnotator
        open={current !== null}
        file={current}
        color={color}
        onOpenChange={(next) => {
          if (!next) handleAnnotationCancel();
        }}
        onDone={handleAnnotationDone}
      />
    </div>
  );
}
