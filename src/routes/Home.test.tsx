import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import Home from './Home';
import { db } from '../db/dexie';
import { addProperty } from '../db/properties';
import * as geocode from '../lib/geocode';

vi.mock('../lib/geocode');

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

describe('Home', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it('adds and navigates to a new property after geocoding succeeds', async () => {
    vi.mocked(geocode.geocodeAddress).mockResolvedValue({
      lat: 52.3676,
      lng: 4.9041,
      displayName: 'Herengracht 1, Amsterdam, Nederland',
    });

    const user = userEvent.setup();
    renderApp();

    await user.type(
      screen.getByPlaceholderText(/Herengracht 1, Amsterdam/i),
      'Herengracht 1',
    );
    await user.click(screen.getByRole('button', { name: /Toevoegen/i }));

    // Land on fake property page.
    const target = await screen.findByTestId('property-page');
    expect(target).toHaveTextContent(/property [0-9a-f-]{36}/);

    const stored = await db.properties.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.address).toBe('Herengracht 1, Amsterdam, Nederland');
    expect(geocode.geocodeAddress).toHaveBeenCalledWith('Herengracht 1');
  });

  it('shows saved properties in the list and navigates when one is clicked', async () => {
    const created = await addProperty({
      address: 'Keizersgracht 5, Amsterdam',
      lat: 52.37,
      lng: 4.88,
    });

    const user = userEvent.setup();
    renderApp();

    const link = await screen.findByRole('link', { name: /Keizersgracht 5/i });
    await user.click(link);

    const target = await screen.findByTestId('property-page');
    expect(target).toHaveTextContent(`property ${created.id}`);
  });

  it('shows an error when geocoding returns no results', async () => {
    vi.mocked(geocode.geocodeAddress).mockResolvedValue(null);

    const user = userEvent.setup();
    renderApp();

    await user.type(
      screen.getByPlaceholderText(/Herengracht 1, Amsterdam/i),
      'nowhere',
    );
    await user.click(screen.getByRole('button', { name: /Toevoegen/i }));

    await waitFor(() => {
      expect(screen.getByText(/Geen resultaten/i)).toBeInTheDocument();
    });
    expect(await db.properties.toArray()).toHaveLength(0);
  });
});
