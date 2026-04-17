import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LinesPanel, { type Mode } from './LinesPanel';

function makeProps(overrides: Partial<React.ComponentProps<typeof LinesPanel>> = {}) {
  return {
    lines: [],
    mode: 'idle' as Mode,
    draftType: 'water' as const,
    draftCount: 0,
    gpsStatus: 'idle' as const,
    gpsError: null,
    gpsAccuracy: null,
    editingCanDeleteVertex: false,
    measureCount: 0,
    measureDistanceLabel: '',
    exporting: null,
    exportError: null,
    onDraftTypeChange: vi.fn(),
    onStartDraw: vi.fn(),
    onStartWalk: vi.fn(),
    onStartSketch: vi.fn(),
    onStartMeasure: vi.fn(),
    onFinishDraft: vi.fn(),
    onCancelDraft: vi.fn(),
    onUndoVertex: vi.fn(),
    onDeleteSelectedVertex: vi.fn(),
    onFinishEditing: vi.fn(),
    onUndoMeasurePoint: vi.fn(),
    onFinishMeasure: vi.fn(),
    onEditLine: vi.fn(),
    onExportGeoJson: vi.fn(),
    onExportPng: vi.fn(),
    onExportPdf: vi.fn(),
    ...overrides,
  };
}

describe('LinesPanel', () => {
  it('in idle mode shows all three primary action buttons and Afstand meten', () => {
    render(<LinesPanel {...makeProps()} />);
    expect(screen.getByRole('button', { name: /^Tekenen$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Schetsen$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Lopen$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Afstand meten/ })).toBeInTheDocument();
  });

  it('fires onStartSketch when Schetsen is clicked', async () => {
    const onStartSketch = vi.fn();
    const user = userEvent.setup();
    render(<LinesPanel {...makeProps({ onStartSketch })} />);
    await user.click(screen.getByRole('button', { name: /^Schetsen$/ }));
    expect(onStartSketch).toHaveBeenCalledOnce();
  });

  it('in sketching mode shows the finish/cancel controls and point count', () => {
    render(<LinesPanel {...makeProps({ mode: 'sketching', draftCount: 7 })} />);
    expect(screen.getByText(/Sleep over de kaart/)).toBeInTheDocument();
    expect(screen.getByText(/7 punten/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Klaar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annuleren/ })).toBeInTheDocument();
    // No start-buttons in sketching mode.
    expect(screen.queryByRole('button', { name: /^Tekenen$/ })).not.toBeInTheDocument();
  });

  it('disables the sketching Klaar button with fewer than 2 points', () => {
    render(<LinesPanel {...makeProps({ mode: 'sketching', draftCount: 1 })} />);
    expect(screen.getByRole('button', { name: /Klaar/ })).toBeDisabled();
  });

  it('disables exports while in a non-idle mode', () => {
    render(<LinesPanel {...makeProps({ mode: 'drawing', draftCount: 3 })} />);
    expect(screen.getByRole('button', { name: /GeoJSON/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /PNG/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^PDF$/ })).toBeDisabled();
  });
});
