import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoGrid from './PhotoGrid';

vi.mock('dexie-react-hooks', () => ({
  // Execute the querier once and return the resolved value. Good enough for
  // static "here are two photos" scenarios; for live updates we'd want a
  // richer mock.
  useLiveQuery: (q: () => Promise<unknown> | unknown) => {
    // Synchronously resolve if the querier is sync; otherwise suspend with
    // an empty array so initial render doesn't throw.
    try {
      const r = q();
      if (r && typeof (r as Promise<unknown>).then === 'function') {
        return __mockPhotos;
      }
      return r;
    } catch {
      return __mockPhotos;
    }
  },
}));

let __mockPhotos: Array<{
  id: string;
  lineId: string;
  blob: Blob;
  thumbnailBlob: Blob;
  mimeType: string;
  createdAt: string;
}> = [];

vi.mock('@/db/photos', () => ({
  listPhotosForLine: vi.fn(async () => __mockPhotos),
  deletePhoto: vi.fn(async () => undefined),
}));

function seed(n: number) {
  __mockPhotos = Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    lineId: 'line-1',
    blob: new Blob(['full'], { type: 'image/jpeg' }),
    thumbnailBlob: new Blob(['thumb'], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    createdAt: new Date(2025, 0, i + 1).toISOString(),
  }));
}

beforeEach(() => {
  __mockPhotos = [];
  vi.clearAllMocks();
});

describe('PhotoGrid', () => {
  it('shows the empty state when there are no photos', () => {
    render(<PhotoGrid lineId="line-1" />);
    expect(screen.getByText(/Nog geen foto's/)).toBeInTheDocument();
  });

  it('renders one thumbnail per photo', () => {
    seed(3);
    render(<PhotoGrid lineId="line-1" />);
    expect(screen.getByRole('button', { name: /Foto 1 openen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Foto 2 openen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Foto 3 openen/ })).toBeInTheDocument();
  });

  it('opens a lightbox when a thumbnail is clicked', async () => {
    seed(2);
    const user = userEvent.setup();
    render(<PhotoGrid lineId="line-1" />);

    await user.click(screen.getByRole('button', { name: /Foto 1 openen/ }));

    // The lightbox is a Dialog with a prev-button and a next-button. Those
    // are more reliable identifiers than the "1 / 2" badge.
    expect(await screen.findByRole('button', { name: /Vorige foto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volgende foto/ })).toBeInTheDocument();
  });

  it('confirms via AlertDialog before deleting a photo', async () => {
    seed(1);
    const mod = await import('@/db/photos');
    const deleteSpy = vi.mocked(mod.deletePhoto);

    const user = userEvent.setup();
    render(<PhotoGrid lineId="line-1" />);

    await user.click(screen.getByRole('button', { name: /Foto 1 verwijderen/ }));
    // Confirm dialog visible.
    const confirmBtn = await screen.findByRole('button', { name: /^Verwijderen$/ });
    await user.click(confirmBtn);

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('p1'));
  });
});
