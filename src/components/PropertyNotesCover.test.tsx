/**
 * Component test for the blur-save behaviour of the property-level
 * notes textarea. Covers the v2.2.1 requirement that notes persist on
 * blur (no explicit save button).
 *
 * The cover picker dialog is exercised implicitly — we only assert on
 * the notes flow here. Photo blobs aren't needed for this test.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PropertyNotesCover from './PropertyNotesCover';
import { db } from '@/db/dexie';
import { addProperty, getProperty } from '@/db/properties';
import { addUtilityLine } from '@/db/utilityLines';
import type { Photo, Property } from '@/types';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

async function resetDb() {
  await db.transaction(
    'rw',
    db.properties,
    db.utilityLines,
    db.photos,
    db.klicFiles,
    async () => {
      await db.properties.clear();
      await db.utilityLines.clear();
      await db.photos.clear();
      await db.klicFiles.clear();
    },
  );
}

async function seed(): Promise<Property> {
  return addProperty({
    street: 'Keizersgracht',
    houseNumber: '123',
    city: 'Amsterdam',
    fullAddress:
      'Keizersgracht 123, 1015 CW Amsterdam, Noord-Holland, Nederland',
    centerLat: 52.37,
    centerLng: 4.88,
  });
}

describe('PropertyNotesCover notes', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it('saves notes on blur (no explicit save button)', async () => {
    const property = await seed();
    const user = userEvent.setup();

    render(<PropertyNotesCover property={property} />);

    const textarea = screen.getByLabelText(/Notities over dit adres/i);
    expect(textarea).toBeInTheDocument();

    await user.click(textarea);
    await user.keyboard('Sleutel achter in de tuin');
    await user.tab(); // fires blur

    await waitFor(async () => {
      expect((await getProperty(property.id))?.notes).toBe(
        'Sleutel achter in de tuin',
      );
    });
  });

  it('storing an all-whitespace value clears notes back to null', async () => {
    const property = await seed();
    // Seed with an existing value first.
    await db.properties.update(property.id, { notes: 'bestaande notitie' });
    const withNotes = (await getProperty(property.id)) as Property;

    const user = userEvent.setup();
    render(<PropertyNotesCover property={withNotes} />);

    const textarea = screen.getByLabelText(/Notities over dit adres/i);
    await user.clear(textarea);
    await user.click(textarea);
    await user.keyboard('   ');
    await user.tab();

    await waitFor(async () => {
      expect((await getProperty(property.id))?.notes).toBeNull();
    });
  });

  it('does not fire a redundant write when the value is unchanged', async () => {
    const property = await seed();
    await db.properties.update(property.id, { notes: 'stable' });
    const withNotes = (await getProperty(property.id)) as Property;
    const initialUpdatedAt = withNotes.updatedAt;

    const user = userEvent.setup();
    render(<PropertyNotesCover property={withNotes} />);

    await user.click(screen.getByLabelText(/Notities over dit adres/i));
    await user.tab();

    // updatedAt must be unchanged — we never called updateProperty.
    const after = await getProperty(property.id);
    expect(after?.updatedAt).toBe(initialUpdatedAt);
    expect(after?.notes).toBe('stable');
  });
});

/**
 * URL.createObjectURL is not implemented by jsdom by default. Stub it
 * so the useMemo path in PropertyNotesCover can render the thumbnail.
 */
function stubObjectUrl() {
  const store = new Map<Blob, string>();
  let counter = 0;
  URL.createObjectURL = (blob: Blob | MediaSource) => {
    const existing = store.get(blob as Blob);
    if (existing) return existing;
    counter += 1;
    const url = `blob:stub/${counter}`;
    store.set(blob as Blob, url);
    return url;
  };
  URL.revokeObjectURL = () => {};
}

async function seedPhoto(lineId: string, photoId = 'photo-valid'): Promise<Photo> {
  const photo: Photo = {
    id: photoId,
    lineId,
    blob: new Blob(['full'], { type: 'image/jpeg' }),
    thumbnailBlob: new Blob(['thumb'], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
  };
  await db.photos.add(photo);
  return photo;
}

describe('PropertyNotesCover cover photo orphan-cleanup', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    stubObjectUrl();
  });

  it('regression: setting a valid coverPhotoId does NOT get cleared by orphan cleanup', async () => {
    // Reproduces the v2.2.1 bug: on fresh render with a valid
    // coverPhotoId, the orphan-cleanup effect must NOT fire a write
    // that clears the id. The direct-fetch check in the effect
    // guarantees we only act when the photo is genuinely missing.
    const property = await seed();
    const line = await addUtilityLine({
      propertyId: property.id,
      type: 'water',
      vertices: [
        [1, 2],
        [1.1, 2.1],
      ],
    });
    const photo = await seedPhoto(line.id);
    await db.properties.update(property.id, { coverPhotoId: photo.id });
    const withCover = (await getProperty(property.id)) as Property;

    render(<PropertyNotesCover property={withCover} />);

    // Give any deferred effects plenty of time to (not) fire, then
    // assert the id is still intact.
    await new Promise((r) => setTimeout(r, 50));
    const after = await getProperty(property.id);
    expect(after?.coverPhotoId).toBe(photo.id);
  });

  it('clears the coverPhotoId when the referenced photo genuinely does not exist', async () => {
    const property = await seed();
    // Point at a photo that was never created (simulating the
    // photo-deleted-via-line-cascade scenario).
    await db.properties.update(property.id, {
      coverPhotoId: 'photo-does-not-exist',
    });
    const orphan = (await getProperty(property.id)) as Property;

    render(<PropertyNotesCover property={orphan} />);

    await waitFor(async () => {
      expect((await getProperty(property.id))?.coverPhotoId).toBeNull();
    });
  });
});
