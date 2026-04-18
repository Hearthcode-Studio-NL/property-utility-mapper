import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';

import PropertyTile from './PropertyTile';
import { db } from '@/db/dexie';
import { addProperty } from '@/db/properties';
import { addUtilityLine } from '@/db/utilityLines';
import type { Photo, Property } from '@/types';

/**
 * URL.createObjectURL isn't in jsdom by default. Stub it so the
 * useMemo path can return a real string for the <img> to render.
 */
function stubObjectUrl() {
  let counter = 0;
  URL.createObjectURL = () => {
    counter += 1;
    return `blob:stub/tile-${counter}`;
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

async function seedProperty(
  overrides: Partial<Property> = {},
): Promise<Property> {
  const p = await addProperty({
    street: 'Herengracht',
    houseNumber: '1',
    city: 'Amsterdam',
    fullAddress: 'Herengracht 1, 1015 BA Amsterdam, Nederland',
    centerLat: 52.3676,
    centerLng: 4.9041,
  });
  if (Object.keys(overrides).length > 0) {
    await db.properties.update(p.id, overrides);
  }
  return (await db.properties.get(p.id)) as Property;
}

async function seedPhoto(lineId: string, photoId = 'photo-A'): Promise<Photo> {
  const photo: Photo = {
    id: photoId,
    lineId,
    blob: new Blob(['b'], { type: 'image/jpeg' }),
    thumbnailBlob: new Blob(['t'], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
  };
  await db.photos.add(photo);
  return photo;
}

function FakeProperty() {
  const { id } = useParams<{ id: string }>();
  return <div data-testid="property-page">property {id}</div>;
}

function renderTile(
  property: Property,
  {
    lineCount = 0,
    onDuplicate = vi.fn(),
    onDelete = vi.fn(),
  }: {
    lineCount?: number;
    onDuplicate?: () => void;
    onDelete?: () => void;
  } = {},
) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <PropertyTile
              property={property}
              lineCount={lineCount}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          }
        />
        <Route path="/property/:id" element={<FakeProperty />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PropertyTile', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    stubObjectUrl();
  });

  it('renders the formatted display address and the link to the property', async () => {
    const property = await seedProperty();
    renderTile(property);

    const link = screen.getByRole('link', {
      name: /Herengracht 1, Amsterdam openen/i,
    });
    expect(link).toHaveAttribute('href', `/property/${property.id}`);
    expect(link).toHaveTextContent(/Herengracht 1, Amsterdam/);
  });

  it('shows the cover photo when coverPhotoId resolves to an existing photo', async () => {
    const property = await seedProperty();
    const line = await addUtilityLine({
      propertyId: property.id,
      type: 'water',
      vertices: [
        [1, 2],
        [1.1, 2.1],
      ],
    });
    const photo = await seedPhoto(line.id, 'photo-valid');
    await db.properties.update(property.id, { coverPhotoId: photo.id });
    const withCover = (await db.properties.get(property.id)) as Property;

    renderTile(withCover);

    await waitFor(() => {
      const img = document.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toMatch(/^blob:/);
    });
  });

  it('shows the placeholder icon when coverPhotoId is null', async () => {
    const property = await seedProperty();
    renderTile(property);

    // No <img> — the placeholder House icon is an SVG sibling.
    expect(document.querySelector('img')).toBeNull();
    // Sanity: the placeholder container wraps a lucide svg.
    expect(document.querySelector('svg')).not.toBeNull();
  });

  it('shows the placeholder when coverPhotoId references a photo that does not exist', async () => {
    const property = await seedProperty({
      coverPhotoId: 'photo-never-stored',
    });
    renderTile(property);

    // Wait long enough for the useLiveQuery to settle — the lookup
    // returns null, tile renders placeholder, no <img>.
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('img')).toBeNull();
  });

  it.each([
    [0, 'Geen leidingen'],
    [1, '1 leiding'],
    [3, '3 leidingen'],
    [17, '17 leidingen'],
  ])('formats line count %d as "%s"', async (count, expected) => {
    const property = await seedProperty();
    renderTile(property, { lineCount: count });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('three-dot menu fires the onDuplicate and onDelete callbacks', async () => {
    const property = await seedProperty();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderTile(property, { onDuplicate, onDelete });

    await user.click(
      screen.getByRole('button', {
        name: /Acties voor Herengracht 1, Amsterdam/i,
      }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: /Dupliceer…/ }),
    );
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', {
        name: /Acties voor Herengracht 1, Amsterdam/i,
      }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: /Verwijder…/ }),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
