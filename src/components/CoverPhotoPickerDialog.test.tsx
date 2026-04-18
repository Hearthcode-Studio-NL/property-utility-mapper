import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import CoverPhotoPickerDialog from './CoverPhotoPickerDialog';
import { NON_IMAGE_MESSAGE } from './PhotoUploader';
import { db } from '@/db/dexie';
import { addProperty } from '@/db/properties';
import { addUtilityLine } from '@/db/utilityLines';
import type { Property } from '@/types';
import { toast } from 'sonner';

// Mock addPropertyPhoto so we don't run the real image-decode + resize
// pipeline in jsdom (no createImageBitmap there).
vi.mock('@/db/photos', async () => {
  const actual = await vi.importActual<typeof import('@/db/photos')>('@/db/photos');
  return {
    ...actual,
    addPropertyPhoto: vi.fn(async (propertyId: string) => ({
      id: `prop-photo-${Date.now()}`,
      lineId: null,
      propertyId,
      blob: new Blob(['a']),
      thumbnailBlob: new Blob(['t']),
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    })),
  };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function stubObjectUrl() {
  let counter = 0;
  URL.createObjectURL = () => {
    counter += 1;
    return `blob:stub/cover-${counter}`;
  };
  URL.revokeObjectURL = () => {};
}

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

async function seedProperty(): Promise<Property> {
  return addProperty({
    street: 'Herengracht',
    houseNumber: '1',
    city: 'Amsterdam',
    fullAddress: 'Herengracht 1, Amsterdam',
    centerLat: 52.37,
    centerLng: 4.89,
  });
}

describe('CoverPhotoPickerDialog — upload flow (v2.3.2)', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    stubObjectUrl();
  });

  it('shows the Upload button even when the property has no lines (property-scoped photos are standalone)', async () => {
    const property = await seedProperty();

    render(
      <CoverPhotoPickerDialog
        property={property}
        currentCoverPhotoId={null}
        open
        onOpenChange={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: /Coverfoto kiezen/ });
    expect(
      screen.getByRole('button', { name: /Upload foto/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nog geen foto's op dit adres/i),
    ).toBeInTheDocument();
  });

  it('renders the upload input with accept="image/*" and no capture attr (iOS library + camera)', async () => {
    const property = await seedProperty();

    render(
      <CoverPhotoPickerDialog
        property={property}
        currentCoverPhotoId={null}
        open
        onOpenChange={vi.fn()}
      />,
    );

    await screen.findByRole('button', { name: /Upload foto/i });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('accept')).toBe('image/*');
    expect(input?.hasAttribute('capture')).toBe(false);
  });

  it('uploading a valid image calls addPropertyPhoto and auto-selects the new photo as cover', async () => {
    const property = await seedProperty();

    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPropertyPhoto);

    render(
      <CoverPhotoPickerDialog
        property={property}
        currentCoverPhotoId={null}
        open
        onOpenChange={vi.fn()}
      />,
    );

    await screen.findByRole('button', { name: /Upload foto/i });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');

    const img = new File(['x'], 'cover.jpg', { type: 'image/jpeg' });
    fireEvent.change(input!, { target: { files: [img] } });

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith(property.id, img);
    });
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/Foto geüpload/i),
    );
  });

  it('uploading a non-image file toasts the Dutch error and does NOT call addPropertyPhoto', async () => {
    const property = await seedProperty();
    await addUtilityLine({
      propertyId: property.id,
      type: 'water',
      vertices: [
        [1, 2],
        [1.1, 2.1],
      ],
    });

    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPropertyPhoto);

    render(
      <CoverPhotoPickerDialog
        property={property}
        currentCoverPhotoId={null}
        open
        onOpenChange={vi.fn()}
      />,
    );

    await screen.findByRole('button', { name: /Upload foto/i });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const pdf = new File(['fake'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(input!, { target: { files: [pdf] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(NON_IMAGE_MESSAGE);
    });
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('cancelling the picker (empty files) is a silent no-op', async () => {
    const property = await seedProperty();

    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPropertyPhoto);

    render(
      <CoverPhotoPickerDialog
        property={property}
        currentCoverPhotoId={null}
        open
        onOpenChange={vi.fn()}
      />,
    );

    await screen.findByRole('button', { name: /Upload foto/i });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, { target: { files: [] } });

    expect(addSpy).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
