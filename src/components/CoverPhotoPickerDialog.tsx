import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';

import { db } from '@/db/dexie';
import { addPropertyPhoto } from '@/db/photos';
import { CoverPhotoNotFoundError, updateProperty } from '@/db/properties';
import type { Photo, Property, UUID } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { NON_IMAGE_MESSAGE } from './PhotoUploader';
import { cn } from '@/lib/utils';

interface Props {
  property: Property;
  currentCoverPhotoId: UUID | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cover-photo picker.
 *
 * v2.3.2 upgrade:
 *   - Upload produces a *property-scoped* photo (not attached to any
 *     utility line). Stored via `addPropertyPhoto` with the v6 Dexie
 *     schema. This matches the homeowner mental model — a cover photo
 *     is "the house", not "the water line".
 *   - The native file input has no `capture="environment"` attribute
 *     so iOS offers "Photo Library" + "Take Photo" instead of forcing
 *     the camera.
 *   - The radio grid shows BOTH line photos (attached to this
 *     property's lines) AND property photos uploaded here, so the user
 *     can still pick an existing line image if they want.
 */
export default function CoverPhotoPickerDialog({
  property,
  currentCoverPhotoId,
  open,
  onOpenChange,
}: Props) {
  const [selectedId, setSelectedId] = useState<UUID | null>(currentCoverPhotoId);
  const [busy, setBusy] = useState(false);

  // Reset selection to the property's current value whenever the dialog
  // (re-)opens. "Adjust state during render" pattern — cheaper than a
  // useEffect + setState and avoids the react-hooks lint.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSelectedId(currentCoverPhotoId);
  }

  // All photos the user could pick as cover: line photos attached to
  // any of this property's lines + property-scoped photos uploaded
  // directly. Merged + sorted by createdAt so ordering is stable.
  const photos = useLiveQuery<Photo[], Photo[]>(
    async () => {
      const lines = await db.utilityLines
        .where('propertyId')
        .equals(property.id)
        .toArray();
      const lineIds = lines.map((l) => l.id);
      const [linePhotos, propertyPhotos] = await Promise.all([
        lineIds.length === 0
          ? Promise.resolve([] as Photo[])
          : db.photos.where('lineId').anyOf(lineIds).toArray(),
        db.photos.where('propertyId').equals(property.id).toArray(),
      ]);
      return [...linePhotos, ...propertyPhotos].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
    },
    [property.id, open],
    [],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUploadChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return; // picker cancelled — silent no-op

    const file = files[0]!;
    if (!file.type.startsWith('image/')) {
      toast.error(NON_IMAGE_MESSAGE);
      return;
    }

    setUploading(true);
    try {
      const photo = await addPropertyPhoto(property.id, file);
      setSelectedId(photo.id);
      toast.success(
        'Foto geüpload. Klik "Kies" om als coverfoto in te stellen.',
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Foto kon niet worden opgeslagen.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (selectedId === currentCoverPhotoId) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      await updateProperty(property.id, { coverPhotoId: selectedId });
      toast.success(
        selectedId === null ? 'Coverfoto verwijderd' : 'Coverfoto ingesteld',
      );
      onOpenChange(false);
    } catch (err) {
      if (err instanceof CoverPhotoNotFoundError) {
        toast.error('De foto bestaat niet meer.');
      } else {
        toast.error(
          err instanceof Error
            ? `Coverfoto opslaan mislukt: ${err.message}`
            : 'Coverfoto opslaan mislukt.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function handleClearSelection() {
    setSelectedId(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Coverfoto kiezen</DialogTitle>
          <DialogDescription>
            Upload een nieuwe foto of kies een bestaande foto van dit
            adres.
          </DialogDescription>
        </DialogHeader>

        <section aria-label="Nieuwe foto uploaden" className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Nieuwe foto uploaden</Label>
          <Button
            type="button"
            variant="outline"
            disabled={uploading || busy}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploaden…' : 'Upload foto'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadChange}
          />
        </section>

        <Separator />

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Bestaande foto&apos;s</Label>
          {photos.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nog geen foto&apos;s op dit adres.
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-label="Beschikbare foto's"
              className="grid grid-cols-3 gap-2 sm:grid-cols-4"
            >
              {photos.map((photo) => (
                <CoverPhotoRadio
                  key={photo.id}
                  photo={photo}
                  checked={selectedId === photo.id}
                  onSelect={() => setSelectedId(photo.id)}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            disabled={busy || selectedId === null}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Verwijder cover
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Annuleren
            </Button>
            <Button type="button" onClick={handleSave} disabled={busy}>
              {busy ? 'Opslaan…' : 'Kies'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RadioProps {
  photo: Photo;
  checked: boolean;
  onSelect: () => void;
}

function CoverPhotoRadio({ photo, checked, onSelect }: RadioProps) {
  // See PropertyNotesCover for the rationale: useMemo creates the object
  // URL during render, the effect only revokes on change / unmount.
  const url = useMemo(
    () => URL.createObjectURL(photo.thumbnailBlob),
    [photo.thumbnailBlob],
  );
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const label = useMemo(
    () => `Foto ${photo.createdAt.slice(0, 10)}`,
    [photo.createdAt],
  );

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        'relative aspect-square overflow-hidden rounded-md border-2 transition',
        checked
          ? 'border-primary ring-2 ring-primary/40'
          : 'border-border hover:border-muted-foreground',
      )}
    >
      {url && (
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
      {checked && (
        <span className="absolute left-1 top-1 rounded bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          Gekozen
        </span>
      )}
    </button>
  );
}
