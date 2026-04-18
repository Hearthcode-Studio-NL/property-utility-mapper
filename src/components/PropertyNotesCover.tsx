import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ImageOff } from 'lucide-react';
import { toast } from 'sonner';

import { db } from '@/db/dexie';
import { updateProperty } from '@/db/properties';
import type { Photo, Property, UUID } from '@/types';
import CoverPhotoPickerDialog from './CoverPhotoPickerDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  property: Property;
}

/**
 * Notes + cover-photo block that sits directly under the property header.
 * Notes save on blur. Cover photo is selected from an existing line photo
 * via a shadcn Dialog (see CoverPhotoPickerDialog); orphan references
 * (photo deleted elsewhere) silently clear on first load.
 */
export default function PropertyNotesCover({ property }: Props) {
  const [notesDraft, setNotesDraft] = useState<string>(property.notes ?? '');
  const lastPropertyIdRef = useRef<string>(property.id);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Re-sync the textarea only when we navigate to a different property;
  // not on every notes-change from the DB (that would clobber typing).
  useEffect(() => {
    if (property.id !== lastPropertyIdRef.current) {
      setNotesDraft(property.notes ?? '');
      lastPropertyIdRef.current = property.id;
    }
  }, [property.id, property.notes]);

  // Live lookup of the current cover photo, for rendering. Returns
  // `null` either while the query is (re-)loading OR when the photo is
  // genuinely missing — we deliberately do NOT use this for orphan
  // detection, because deps-change transitions can briefly surface a
  // stale `null` from the previous subscription and a naive check would
  // wipe a coverPhotoId we just set.
  const coverPhoto = useLiveQuery<Photo | null, null>(
    async () => {
      if (!property.coverPhotoId) return null;
      return (await db.photos.get(property.coverPhotoId)) ?? null;
    },
    [property.coverPhotoId],
    null,
  );

  // Orphan cleanup — direct fetch so we're tied to a SPECIFIC
  // coverPhotoId and can re-verify the property still references it
  // before clearing. Runs once per (property.id, coverPhotoId) change.
  useEffect(() => {
    const targetId: UUID | null = property.coverPhotoId;
    if (targetId === null) return;

    let cancelled = false;
    void (async () => {
      const found = await db.photos.get(targetId);
      if (cancelled || found) return;

      // Re-read the property; if another write has already changed the
      // id (concurrent user action, test, etc.), leave it alone.
      const current = await db.properties.get(property.id);
      if (cancelled) return;
      if (current && current.coverPhotoId === targetId) {
        await updateProperty(property.id, { coverPhotoId: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [property.id, property.coverPhotoId]);

  // Thumbnail object URL — created during render via useMemo so we don't
  // have to setState inside an effect. The companion effect just revokes
  // when the URL changes / the component unmounts.
  const coverUrl = useMemo(
    () => (coverPhoto ? URL.createObjectURL(coverPhoto.thumbnailBlob) : null),
    [coverPhoto],
  );
  useEffect(() => {
    if (!coverUrl) return;
    return () => URL.revokeObjectURL(coverUrl);
  }, [coverUrl]);

  async function persistNotesIfChanged() {
    const trimmed = notesDraft.trim();
    const next = trimmed.length === 0 ? null : trimmed;
    if (next === (property.notes ?? null)) return;
    try {
      await updateProperty(property.id, { notes: next });
    } catch (err) {
      toast.error(
        err instanceof Error ? `Notities opslaan mislukt: ${err.message}` : 'Notities opslaan mislukt.',
      );
    }
  }

  return (
    <section className="border-b bg-background px-4 py-3">
      <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <label htmlFor="property-notes" className="sr-only">
            Notities over dit adres
          </label>
          <Textarea
            id="property-notes"
            value={notesDraft}
            placeholder="Notities over dit adres (bijv. toegang, sleutels, bijzonderheden)"
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={persistNotesIfChanged}
            rows={2}
          />
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground"
            aria-label={
              coverPhoto
                ? 'Huidige coverfoto'
                : 'Geen coverfoto ingesteld'
            }
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageOff className="h-5 w-5" strokeWidth={1.5} />
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            {coverPhoto ? 'Wijzig cover' : 'Kies coverfoto'}
          </Button>
        </div>
      </div>

      <CoverPhotoPickerDialog
        property={property}
        currentCoverPhotoId={property.coverPhotoId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </section>
  );
}
