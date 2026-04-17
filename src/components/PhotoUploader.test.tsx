import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoUploader from './PhotoUploader';
import { MAX_PHOTOS_PER_LINE } from '@/db/photos';

vi.mock('@/db/photos', async () => {
  const actual = await vi.importActual<typeof import('@/db/photos')>('@/db/photos');
  return {
    ...actual,
    addPhoto: vi.fn(async () => ({
      id: 'fake',
      lineId: 'line-1',
      blob: new Blob(),
      thumbnailBlob: new Blob(),
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    })),
  };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function mockMatchMedia(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('coarse') ? coarse : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('PhotoUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the current count and the line limit', () => {
    mockMatchMedia(false);
    render(<PhotoUploader lineId="line-1" photoCount={2} />);
    expect(screen.getByText(`2 / ${MAX_PHOTOS_PER_LINE}`)).toBeInTheDocument();
  });

  it('disables the Add button at the photo limit', () => {
    mockMatchMedia(false);
    render(
      <PhotoUploader lineId="line-1" photoCount={MAX_PHOTOS_PER_LINE} />,
    );
    expect(screen.getByRole('button', { name: /Foto toevoegen/ })).toBeDisabled();
  });

  it('does NOT set capture on desktop (fine pointer)', async () => {
    mockMatchMedia(false);
    const { container } = render(
      <PhotoUploader lineId="line-1" photoCount={0} />,
    );
    // Wait for the useEffect to resolve the coarse-pointer check.
    await waitFor(() => {
      const input = container.querySelector('input[type="file"]');
      expect(input).not.toBeNull();
      expect(input?.getAttribute('capture')).toBeNull();
    });
  });

  it('sets capture="environment" on coarse-pointer devices (mobile)', async () => {
    mockMatchMedia(true);
    const { container } = render(
      <PhotoUploader lineId="line-1" photoCount={0} />,
    );
    await waitFor(() => {
      const input = container.querySelector('input[type="file"]');
      expect(input?.getAttribute('capture')).toBe('environment');
    });
  });

  it('uploads a selected file via addPhoto', async () => {
    mockMatchMedia(false);
    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPhoto);

    const user = userEvent.setup();
    const { container } = render(
      <PhotoUploader lineId="line-1" photoCount={0} />,
    );

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    await user.upload(input, file);

    await waitFor(() => expect(addSpy).toHaveBeenCalledOnce());
    expect(addSpy).toHaveBeenCalledWith('line-1', file);
  });
});
