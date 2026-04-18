import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { addPhoto, MAX_PHOTOS_PER_LINE, PhotoLimitError } from '@/db/photos';
import { Button } from '@/components/ui/button';

interface PhotoUploaderProps {
  lineId: string;
  photoCount: number;
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
 */
export default function PhotoUploader({ lineId, photoCount }: PhotoUploaderProps) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const atLimit = photoCount >= MAX_PHOTOS_PER_LINE;

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return; // picker cancelled — silent no-op

    const images: File[] = [];
    let rejected = 0;
    for (const f of files) {
      if (f.type.startsWith('image/')) images.push(f);
      else rejected += 1;
    }
    if (rejected > 0) {
      toast.error(NON_IMAGE_MESSAGE);
    }
    if (images.length === 0) return;

    setBusy(true);
    let added = 0;
    let hitLimit = false;
    try {
      for (const file of images) {
        try {
          await addPhoto(lineId, file);
          added += 1;
        } catch (err) {
          if (err instanceof PhotoLimitError) {
            hitLimit = true;
            break;
          }
          toast.error(
            err instanceof Error ? err.message : 'Foto kon niet worden opgeslagen.',
          );
        }
      }
    } finally {
      setBusy(false);
    }

    if (hitLimit) {
      toast.error(`Maximaal ${MAX_PHOTOS_PER_LINE} foto's per lijn.`);
    } else if (added > 0) {
      toast.success(
        added === 1 ? 'Foto toegevoegd.' : `${added} foto's toegevoegd.`,
      );
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || atLimit}
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
    </div>
  );
}
