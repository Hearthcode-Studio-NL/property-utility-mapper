import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LayerManagerButton from './LayerManagerButton';
import { LayerSelectionProvider } from '@/hooks/useLayerSelection';

function renderButton() {
  return render(
    <LayerSelectionProvider>
      <LayerManagerButton />
    </LayerSelectionProvider>,
  );
}

function mockMatchMedia(isDesktop: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      // The hook asks for `(min-width: 768px)` — answer honestly for that
      // query; everything else defaults to false.
      matches: query.includes('min-width: 768px') ? isDesktop : false,
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

describe('LayerManagerButton', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a chrome button with a Dutch aria-label', () => {
    mockMatchMedia(true);
    renderButton();
    expect(screen.getByRole('button', { name: 'Kaartlagen' })).toBeInTheDocument();
  });

  it('opens a Popover with the panel on desktop', async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Kaartlagen' }));

    // Panel heading surfaces once the popover is open.
    expect(
      await screen.findByRole('heading', { name: 'Achtergrond' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Kaart' }),
    ).toBeInTheDocument();
  });

  it('opens a Sheet with the panel on mobile, with a Dutch title', async () => {
    mockMatchMedia(false);
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Kaartlagen' }));

    // Sheet surface has its own title on mobile (a dialog role) plus the
    // panel's "Achtergrond" / "Overlays" headings.
    expect(
      await screen.findByRole('dialog', { name: 'Kaartlagen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Achtergrond' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overlays' })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Kaartlagen' }));
    expect(
      await screen.findByRole('heading', { name: 'Achtergrond' }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Achtergrond' }),
      ).not.toBeInTheDocument();
    });
  });

  it('clicking a radio inside the popover persists the base choice', async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Kaartlagen' }));
    await user.click(await screen.findByRole('radio', { name: 'Satelliet' }));

    const stored = JSON.parse(localStorage.getItem('pum-layers') as string);
    expect(stored.base).toBe('pdok-luchtfoto');
  });
});
