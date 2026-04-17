import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { addPhoto, MAX_PHOTOS_PER_LINE, PhotoLimitError } from '@/db/photos';
import { Button } from '@/components/ui/button';

interface PhotoUploaderProps {
  lineId: string;
  photoCount: number;
}

function detectCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

export default function PhotoUploader({ lineId, photoCount }: PhotoUploaderProps) {
  const [busy, setBusy] = useState(false);
  // matchMedia result is stable for the session; resolve once on first render.
  const [coarse] = useState(detectCoarsePointer);
  const inputRef = useRef<HTMLInputElement>(null);

  const atLimit = photoCount >= MAX_PHOTOS_PER_LINE;

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setBusy(true);
    let added = 0;
    let hitLimit = false;
    try {
      for (const file of files) {
        try {
          await addPhoto(lineId, file);
          added++;
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
        // Only hint the camera on phones — on desktop a capture attribute
        // can push browsers to try to open a webcam instead of the picker.
        {...(coarse ? { capture: 'environment' as const } : {})}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
