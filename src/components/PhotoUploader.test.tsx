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

// Stub the annotator. The uploader's queue + save-path is what these
// tests actually cover; the annotator's own behaviour has its own
// dedicated tests and relies on canvas APIs jsdom doesn't implement.
vi.mock('./PhotoAnnotator', () => ({
  default: ({
    open,
    file,
    onDone,
    onOpenChange,
  }: {
    open: boolean;
    file: File | null;
    onDone: (result: File) => void;
    onOpenChange: (next: boolean) => void;
  }) =>
    open && file ? (
      <div data-testid="annotator-stub" data-filename={file.name}>
        <button type="button" onClick={() => onDone(file)}>
          stub-done
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          stub-cancel
        </button>
      </div>
    ) : null,
}));

const RENDER_COLOR = '#2563eb';

describe('PhotoUploader (v2.3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the current count and the line limit', () => {
    render(
      <PhotoUploader lineId="line-1" photoCount={2} color={RENDER_COLOR} />,
    );
    expect(screen.getByText(`2 / ${MAX_PHOTOS_PER_LINE}`)).toBeInTheDocument();
  });

  it('disables the Add button at the photo limit', () => {
    render(
      <PhotoUploader
        lineId="line-1"
        photoCount={MAX_PHOTOS_PER_LINE}
        color={RENDER_COLOR}
      />,
    );
    expect(screen.getByRole('button', { name: /Foto toevoegen/ })).toBeDisabled();
  });

  it('renders a hidden file input with accept="image/*" and multiple, and NO capture attr', () => {
    const { container } = render(
      <PhotoUploader lineId="line-1" photoCount={0} color={RENDER_COLOR} />,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('accept')).toBe('image/*');
    expect(input?.hasAttribute('capture')).toBe(false);
    expect(input?.hasAttribute('multiple')).toBe(true);
  });

  it('opens the annotator after an image is picked (addPhoto NOT called yet)', async () => {
    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPhoto);

    const user = userEvent.setup();
    const { container } = render(
      <PhotoUploader lineId="line-1" photoCount={0} color={RENDER_COLOR} />,
    );

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId('annotator-stub')).toBeInTheDocument();
    });
    // addPhoto must wait until the annotator signals done — saves are
    // downstream of annotation.
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('annotator Bewaar/Overslaan signals onDone → addPhoto is called with the returned file', async () => {
    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPhoto);

    const user = userEvent.setup();
    const { container } = render(
      <PhotoUploader lineId="line-1" photoCount={0} color={RENDER_COLOR} />,
    );

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await screen.findByTestId('annotator-stub');
    await user.click(screen.getByRole('button', { name: 'stub-done' }));

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith('line-1', file);
    });
  });

  it('dismissing the annotator abandons the save (addPhoto not called)', async () => {
    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPhoto);

    const user = userEvent.setup();
    const { container } = render(
      <PhotoUploader lineId="line-1" photoCount={0} color={RENDER_COLOR} />,
    );

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await screen.findByTestId('annotator-stub');
    await user.click(screen.getByRole('button', { name: 'stub-cancel' }));

    // queue cleared → annotator unmounts → no save happened.
    await waitFor(() => {
      expect(screen.queryByTestId('annotator-stub')).not.toBeInTheDocument();
    });
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('rejects a non-image file with a Dutch error toast and does NOT open the annotator', async () => {
    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPhoto);

    const { container } = render(
      <PhotoUploader lineId="line-1" photoCount={0} color={RENDER_COLOR} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const pdf = new File(['fake'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [pdf] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(NON_IMAGE_MESSAGE);
    });
    expect(addSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('annotator-stub')).not.toBeInTheDocument();
  });

  it('is a silent no-op when the picker closes with no selection', async () => {
    const mod = await import('@/db/photos');
    const addSpy = vi.mocked(mod.addPhoto);

    const { container } = render(
      <PhotoUploader lineId="line-1" photoCount={0} color={RENDER_COLOR} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(addSpy).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId('annotator-stub')).not.toBeInTheDocument();
  });
});
