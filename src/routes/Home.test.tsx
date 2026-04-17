import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import Home from './Home';
import { db } from '../db/dexie';
import { addProperty } from '../db/properties';
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
});
