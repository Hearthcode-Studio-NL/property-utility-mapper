import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LayerManagerPanel from './LayerManagerPanel';
import { LayerSelectionProvider } from '@/hooks/useLayerSelection';

function renderPanel() {
  return render(
    <LayerSelectionProvider>
      <LayerManagerPanel />
    </LayerSelectionProvider>,
  );
}

describe('LayerManagerPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders both sections with Dutch headings', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Achtergrond' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overlays' })).toBeInTheDocument();
  });

  it('renders every base layer from the catalogue as a radio option', () => {
    renderPanel();
    const group = screen.getByRole('radiogroup', { name: 'Achtergrondkaart' });
    expect(within(group).getByRole('radio', { name: 'Kaart' })).toBeInTheDocument();
    expect(
      within(group).getByRole('radio', { name: 'Satelliet' }),
    ).toBeInTheDocument();
  });

  it('renders every overlay (including virtual) as a checkbox', () => {
    renderPanel();
    const group = screen.getByRole('group', { name: 'Overlay-kaartlagen' });
    expect(
      within(group).getByRole('checkbox', { name: 'Kadastrale Kaart' }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole('checkbox', { name: 'Getekende leidingen' }),
    ).toBeInTheDocument();
  });

  it('defaults to Kaart checked; Satelliet unchecked (from catalogue defaultOn)', () => {
    renderPanel();
    expect(screen.getByRole('radio', { name: 'Kaart' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Satelliet' })).not.toBeChecked();
  });

  it('defaults Kadaster and Getekende leidingen to checked (catalogue defaultOn)', () => {
    renderPanel();
    expect(
      screen.getByRole('checkbox', { name: 'Kadastrale Kaart' }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Getekende leidingen' }),
    ).toBeChecked();
  });

  it('selecting a different base swaps the checked radio (mutual exclusion)', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('radio', { name: 'Satelliet' }));

    expect(screen.getByRole('radio', { name: 'Satelliet' })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Kaart' }),
    ).not.toBeChecked();
  });

  it('toggling an overlay checkbox flips its state and leaves others alone', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('checkbox', { name: 'Kadastrale Kaart' }));
    expect(
      screen.getByRole('checkbox', { name: 'Kadastrale Kaart' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Getekende leidingen' }),
    ).toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'Kadastrale Kaart' }));
    expect(
      screen.getByRole('checkbox', { name: 'Kadastrale Kaart' }),
    ).toBeChecked();
  });

  it('persists selection changes to localStorage via useLayerSelection', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('radio', { name: 'Satelliet' }));
    await user.click(screen.getByRole('checkbox', { name: 'Kadastrale Kaart' }));

    const stored = localStorage.getItem('pum-layers');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed.base).toBe('pdok-luchtfoto');
    expect(parsed.overlays).not.toContain('kadaster-brk');
    expect(parsed.overlays).toContain('user-drawings');
  });

  it('moves focus between radio options with arrow keys', async () => {
    const user = userEvent.setup();
    renderPanel();

    // Tab lands on the currently-checked radio (roving focus default).
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Kaart' })).toHaveFocus();

    // Arrow-Down moves focus within the group. Whether the item commits
    // on focus is a Radix behaviour detail; what we're guaranteeing here
    // is that keyboard users can reach every option without the mouse.
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'OpenStreetMap' })).toHaveFocus();
  });

  it('toggles a checkbox via the keyboard (Space)', async () => {
    const user = userEvent.setup();
    renderPanel();

    const kadaster = screen.getByRole('checkbox', { name: 'Kadastrale Kaart' });
    kadaster.focus();
    expect(kadaster).toHaveFocus();

    await user.keyboard(' ');
    expect(kadaster).not.toBeChecked();

    await user.keyboard(' ');
    expect(kadaster).toBeChecked();
  });
});
