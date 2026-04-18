import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('in idle mode shows the two primary action buttons and Afstand meten', () => {
    render(<LinesPanel {...makeProps()} />);
    expect(screen.getByRole('button', { name: /^Tekenen$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Lopen$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Afstand meten/ })).toBeInTheDocument();
  });

  it('v2.3.5: no Schetsen button — freehand drawing mode has been removed', () => {
    render(<LinesPanel {...makeProps()} />);
    expect(
      screen.queryByRole('button', { name: /^Schetsen$/ }),
    ).not.toBeInTheDocument();
  });

  it('disables exports while in a non-idle mode', () => {
    render(<LinesPanel {...makeProps({ mode: 'drawing', draftCount: 3 })} />);
    expect(screen.getByRole('button', { name: /GeoJSON/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /PNG/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^PDF$/ })).toBeDisabled();
  });
});
