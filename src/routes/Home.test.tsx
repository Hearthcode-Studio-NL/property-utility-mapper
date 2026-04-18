import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import Home from './Home';
import { db } from '../db/dexie';
import { addProperty } from '../db/properties';
import { addUtilityLine } from '../db/utilityLines';
import * as geocode from '../lib/geocode';
import { toast } from 'sonner';

vi.mock('../lib/geocode');
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
}));

function FakeProperty() {
  const { id } = useParams<{ id: string }>();
  return <div data-testid="property-page">property {id}</div>;
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/property/:id" element={<FakeProperty />} />
      </Routes>
    </MemoryRouter>,
  );
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

const STRUCTURED_HIT = {
  street: 'Herengracht',
  houseNumber: '1',
  city: 'Amsterdam',
  postcode: '1015 BA',
  country: 'Nederland',
  fullAddress: 'Herengracht 1, 1015 BA Amsterdam, Noord-Holland, Nederland',
  lat: 52.3676,
  lng: 4.9041,
};

describe('Home', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it('typed-address flow shows the confirmation card, saves, and navigates', async () => {
    vi.mocked(geocode.geocodeAddress).mockResolvedValue(STRUCTURED_HIT);

    const user = userEvent.setup();
    renderApp();

    await user.type(
      screen.getByPlaceholderText(/Herengracht 1, Amsterdam/i),
      'Herengracht 1',
    );
    await user.click(screen.getByRole('button', { name: /^Zoeken$/ }));

    // Confirmation card appears with the structured fields pre-filled.
    const streetInput = await screen.findByDisplayValue('Herengracht');
    expect(streetInput).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Amsterdam')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Opslaan/ }));

    const target = await screen.findByTestId('property-page');
    expect(target).toHaveTextContent(/property [0-9a-f-]{36}/);

    const stored = await db.properties.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      street: 'Herengracht',
      houseNumber: '1',
      city: 'Amsterdam',
      centerLat: 52.3676,
      centerLng: 4.9041,
    });
  });

  it('keeps the user editing when a required field is cleared', async () => {
    vi.mocked(geocode.geocodeAddress).mockResolvedValue(STRUCTURED_HIT);

    const user = userEvent.setup();
    renderApp();

    await user.type(
      screen.getByPlaceholderText(/Herengracht 1, Amsterdam/i),
      'Herengracht 1',
    );
    await user.click(screen.getByRole('button', { name: /^Zoeken$/ }));

    const street = await screen.findByDisplayValue('Herengracht');
    await user.clear(street);

    expect(screen.getByRole('button', { name: /Opslaan/ })).toBeDisabled();
    expect(await db.properties.toArray()).toHaveLength(0);
  });

  it('shows a typed-form error toast when geocoding returns no results', async () => {
    vi.mocked(geocode.geocodeAddress).mockResolvedValue(null);

    const user = userEvent.setup();
    renderApp();

    await user.type(
      screen.getByPlaceholderText(/Herengracht 1, Amsterdam/i),
      'nowhere',
    );
    await user.click(screen.getByRole('button', { name: /^Zoeken$/ }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/Geen resultaten/i),
      );
    });
    expect(await db.properties.toArray()).toHaveLength(0);
  });

  it('cancelling the delete dialog keeps the property in the DB', async () => {
    const seeded = await addProperty({
      street: 'Prinsengracht',
      houseNumber: '263',
      city: 'Amsterdam',
      fullAddress:
        'Prinsengracht 263, 1016 GV Amsterdam, Noord-Holland, Nederland',
      centerLat: 52.375,
      centerLng: 4.884,
    });

    const user = userEvent.setup();
    renderApp();

    await user.click(
      await screen.findByRole('button', {
        name: /Prinsengracht 263, Amsterdam verwijderen/i,
      }),
    );

    // AlertDialog opens — confirm its Dutch copy is in place.
    expect(
      screen.getByRole('heading', { name: /Adres verwijderen\?/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Dit verwijdert het adres, alle leidingen en alle foto's\. Dit kan niet ongedaan worden gemaakt\./,
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Annuleren/ }));

    // Property untouched, no delete toast fired.
    const still = await db.properties.toArray();
    expect(still.map((p) => p.id)).toEqual([seeded.id]);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('confirming the delete dialog removes the property and toasts success', async () => {
    await addProperty({
      street: 'Singel',
      houseNumber: '7',
      city: 'Amsterdam',
      fullAddress: 'Singel 7, 1012 VC Amsterdam, Noord-Holland, Nederland',
      centerLat: 52.373,
      centerLng: 4.892,
    });

    const user = userEvent.setup();
    renderApp();

    await user.click(
      await screen.findByRole('button', {
        name: /Singel 7, Amsterdam verwijderen/i,
      }),
    );
    await user.click(screen.getByRole('button', { name: /^Verwijder$/ }));

    await waitFor(async () => {
      expect(await db.properties.toArray()).toHaveLength(0);
    });
    expect(toast.success).toHaveBeenCalledWith('Adres verwijderd');
    // UI reflects the delete — the link for Singel is gone.
    expect(
      screen.queryByRole('link', { name: /Singel 7, Amsterdam/i }),
    ).not.toBeInTheDocument();
  });

  it('lists saved properties using formatDisplayAddress and navigates on click', async () => {
    const created = await addProperty({
      street: 'Keizersgracht',
      houseNumber: '5',
      city: 'Amsterdam',
      fullAddress: 'Keizersgracht 5, 1015 CJ Amsterdam, Noord-Holland, Nederland',
      centerLat: 52.37,
      centerLng: 4.88,
    });

    const user = userEvent.setup();
    renderApp();

    const link = await screen.findByRole('link', { name: /Keizersgracht 5, Amsterdam/i });
    // Explicitly verify the display rule — no postcode or country in the label.
    expect(link.textContent).not.toMatch(/1015/);
    expect(link.textContent).not.toMatch(/Nederland/);

    await user.click(link);

    const target = await screen.findByTestId('property-page');
    expect(target).toHaveTextContent(`property ${created.id}`);
  });

  it('duplicating a property: opens a dialog with the "(kopie)" suffix pre-filled', async () => {
    await addProperty({
      street: 'Oudegracht',
      houseNumber: '12',
      city: 'Utrecht',
      fullAddress: 'Oudegracht 12, 3511 AH Utrecht, Nederland',
      centerLat: 52.09,
      centerLng: 5.12,
    });

    const user = userEvent.setup();
    renderApp();

    await user.click(
      await screen.findByRole('button', {
        name: /Oudegracht 12, Utrecht dupliceren/i,
      }),
    );

    expect(
      screen.getByRole('heading', { name: /Adres dupliceren/ }),
    ).toBeInTheDocument();
    const input = screen.getByLabelText<HTMLInputElement>('Adres');
    expect(input).toHaveValue('Oudegracht 12, Utrecht (kopie)');

    // Annuleren closes without doing anything.
    await user.click(screen.getByRole('button', { name: /Annuleren/ }));
    expect(await db.properties.toArray()).toHaveLength(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('duplicating a property: confirms creates a new property, carries lines, skips photos, and navigates', async () => {
    const source = await addProperty({
      street: 'Singel',
      houseNumber: '42',
      city: 'Amsterdam',
      fullAddress: 'Singel 42, Amsterdam, Nederland',
      centerLat: 52.37,
      centerLng: 4.89,
    });
    // Seed a line + a photo on the source. The clone must carry the
    // line but NOT the photo.
    const line = await addUtilityLine({
      propertyId: source.id,
      type: 'water',
      vertices: [
        [1, 2],
        [1.1, 2.1],
      ],
    });
    await db.photos.add({
      id: 'source-photo',
      lineId: line.id,
      blob: new Blob(['b']),
      thumbnailBlob: new Blob(['t']),
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    });
    await db.utilityLines.update(line.id, { photoIds: ['source-photo'] });

    const user = userEvent.setup();
    renderApp();

    await user.click(
      await screen.findByRole('button', {
        name: /Singel 42, Amsterdam dupliceren/i,
      }),
    );

    const input = screen.getByLabelText<HTMLInputElement>('Adres');
    await user.clear(input);
    await user.type(input, 'Singel 44, Amsterdam');
    await user.click(screen.getByRole('button', { name: /Dupliceer$/ }));

    // Success toast + navigation to the NEW property's page.
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Adres gedupliceerd');
    });
    const target = await screen.findByTestId('property-page');
    const match = target.textContent?.match(/property ([0-9a-f-]{36})/);
    expect(match).not.toBeNull();
    const newId = match![1];
    expect(newId).not.toBe(source.id);

    // DB reflects a fresh copy — 2 properties, 2 lines (one per property),
    // still exactly 1 photo (bound to the source's line).
    const props = await db.properties.toArray();
    expect(props).toHaveLength(2);
    const copy = props.find((p) => p.id === newId)!;
    expect(copy.fullAddress).toBe('Singel 44, Amsterdam');
    expect(copy.notes).toBeNull();
    expect(copy.coverPhotoId).toBeNull();

    const lines = await db.utilityLines.toArray();
    expect(lines).toHaveLength(2);
    expect(lines.filter((l) => l.propertyId === newId)).toHaveLength(1);

    const photos = await db.photos.toArray();
    expect(photos).toHaveLength(1);
    expect(photos[0]?.lineId).toBe(line.id); // still bound to the original
  });
});
