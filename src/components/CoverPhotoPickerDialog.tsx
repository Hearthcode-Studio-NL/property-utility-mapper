import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';

import { db } from '@/db/dexie';
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
import { cn } from '@/lib/utils';

interface Props {
  property: Property;
  currentCoverPhotoId: UUID | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Pick one of the property's existing line-photos as the cover image.
 *
 * No upload happens here — this slice (v2.2.1) deliberately scopes the
 * cover source to already-attached photos. "Verwijder cover" clears the
 * reference; "Kies" commits the radio selection via updateProperty.
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
  // opens, so the user sees what's actually stored (not stale state).
  // Uses the "adjust state during render" pattern (see React docs) rather
  // than a useEffect + setState, which the react-hooks lint flags.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSelectedId(currentCoverPhotoId);
  }

  // All photos attached to any line on this property. useLiveQuery so the
  // grid stays fresh if the user uploads / deletes photos elsewhere while
  // the dialog is open.
  const photos = useLiveQuery<Photo[], Photo[]>(
    async () => {
      const lines = await db.utilityLines
        .where('propertyId')
        .equals(property.id)
        .toArray();
      if (lines.length === 0) return [];
      const lineIds = lines.map((l) => l.id);
      const all = await db.photos.where('lineId').anyOf(lineIds).toArray();
      return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    [property.id, open],
    [],
  );

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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Coverfoto kiezen</DialogTitle>
          <DialogDescription>
            Kies een foto uit de leidingen op dit adres als coverafbeelding.
          </DialogDescription>
        </DialogHeader>

        {photos.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nog geen foto&apos;s op dit adres. Voeg eerst een foto toe aan
            een leiding.
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
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
          </div>
        )}

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
