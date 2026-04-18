import { describe, expect, it, vi } from 'vitest';
import {
  drawStroke,
  flattenFileWithStrokes,
  type Stroke,
} from './photoAnnotation';

interface Mock2DContext {
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  ellipse: ReturnType<typeof vi.fn>;
  strokeStyle: string;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
}

function makeMockCtx(): Mock2DContext {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    ellipse: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
  };
}

describe('drawStroke', () => {
  it('draws an arrow: shaft + two arrowhead lines', () => {
    const ctx = makeMockCtx();
    const stroke: Stroke = {
      kind: 'arrow',
      from: { x: 10, y: 10 },
      to: { x: 100, y: 10 }, // 90 px horizontal
    };

    drawStroke(ctx as unknown as CanvasRenderingContext2D, stroke, '#ff0000', 3);

    // Shaft: moveTo(from) + lineTo(to) inside one beginPath/stroke.
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 10);
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 10);
    // Arrowhead legs: two additional moveTo/lineTo pairs from `to`.
    // Total: 3 moveTo calls (shaft + two head legs from tip).
    expect(ctx.moveTo).toHaveBeenCalledTimes(3);
    expect(ctx.lineTo.mock.calls.length).toBeGreaterThanOrEqual(3);
    // Two stroke() calls total: one for shaft, one for the head legs.
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    // Style wiring is applied.
    expect(ctx.strokeStyle).toBe('#ff0000');
    expect(ctx.lineWidth).toBe(3);
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  it('skips the arrowhead on a near-zero-length arrow (defensive)', () => {
    const ctx = makeMockCtx();
    const stroke: Stroke = {
      kind: 'arrow',
      from: { x: 50, y: 50 },
      to: { x: 50, y: 50 },
    };
    drawStroke(ctx as unknown as CanvasRenderingContext2D, stroke, '#000', 3);
    // Shaft line is drawn but no arrowhead legs → exactly 1 moveTo + 1 stroke.
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it('draws a circle as an ellipse inside the bounding box', () => {
    const ctx = makeMockCtx();
    const stroke: Stroke = {
      kind: 'circle',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 60 },
    };
    drawStroke(ctx as unknown as CanvasRenderingContext2D, stroke, '#00f', 3);
    // Centre at (50, 30); radii 50 × 30.
    expect(ctx.ellipse).toHaveBeenCalledWith(50, 30, 50, 30, 0, 0, Math.PI * 2);
    expect(ctx.stroke).toHaveBeenCalledOnce();
  });

  it('draws nothing for a degenerate circle with zero radius', () => {
    const ctx = makeMockCtx();
    const stroke: Stroke = {
      kind: 'circle',
      from: { x: 10, y: 10 },
      to: { x: 10, y: 10 },
    };
    drawStroke(ctx as unknown as CanvasRenderingContext2D, stroke, '#00f', 3);
    expect(ctx.ellipse).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});

describe('flattenFileWithStrokes', () => {
  it('returns the original File unchanged when strokes is empty (fast path)', async () => {
    const original = new File(['abc'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await flattenFileWithStrokes({
      file: original,
      strokes: [],
      color: '#000',
      lineWidth: 3,
    });
    // Reference equality — the empty-strokes branch skips every canvas
    // call and simply hands the input back.
    expect(result).toBe(original);
  });
});
