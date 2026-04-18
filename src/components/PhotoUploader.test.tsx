import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoUploader, { NON_IMAGE_MESSAGE } from './PhotoUploader';
import { MAX_PHOTOS_PER_LINE } from '@/db/photos';
import { toast } from 'sonner';

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

describe('PhotoUploader (v2.3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the current count and the line limit', () => {
    render(<PhotoUploader lineId="line-1" photoCount={2} />);
    expect(screen.getByText(`2 / ${MAX_PHOTOS_PER_LINE}`)).toBeInTheDocument();
  });

  it('disables the Add button at the photo limit', () => {
    render(<PhotoUploader lineId="line-1" photoCount={MAX_PHOTOS_PER_LINE} />);
    expect(screen.getByRole('button', { name: /Foto toevoegen/ })).toBeDisabled();
  });

  it('renders a hidden file input with accept="image/*" and multiple, and NO capture attr (so iOS offers library + camera)', () => {
    const { container } = render(<PhotoUploader lineId="line-1" photoCount={0} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('accept')).toBe('image/*');
    // Absence is important: capture="environment" on iOS removes the
    // Photo Library option. accept="image/*" alone keeps both available.
    expect(input?.hasAttribute('capture')).toBe(false);
    expect(input?.hasAttribute('multiple')).toBe(true);
  });

  it('uploads a selected image file via addPhoto', async () => {
    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPhoto);

    const user = userEvent.setup();
    const { container } = render(<PhotoUploader lineId="line-1" photoCount={0} />);

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => expect(addSpy).toHaveBeenCalledOnce());
    expect(addSpy).toHaveBeenCalledWith('line-1', file);
  });

  it('rejects a non-image file with a Dutch error toast and does NOT call addPhoto', async () => {
    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPhoto);

    const { container } = render(<PhotoUploader lineId="line-1" photoCount={0} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    // Bypass testing-library's accept-attribute filter (userEvent.upload
    // silently drops files that don't match `accept`) so we can exercise
    // our own runtime MIME guard.
    const pdf = new File(['fake'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [pdf] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(NON_IMAGE_MESSAGE);
    });
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('is a silent no-op when the picker closes with no selection', async () => {
    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPhoto);

    const { container } = render(<PhotoUploader lineId="line-1" photoCount={0} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    // Fire the change handler with an empty FileList — mimics a user
    // opening + cancelling the native picker.
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Nothing persisted; no toast (neither success nor error).
    expect(addSpy).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
