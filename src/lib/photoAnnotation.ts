/**
 * Photo-annotation primitives for v2.3.4.
 *
 * Annotations are flattened pixels, not editable layers (Wijnand's
 * 2026-04-17 decision). Shapes are stored in memory only while the
 * PhotoAnnotator dialog is open; on Bewaar we composite them onto the
 * source image and hand a new File back to the save pipeline; on
 * Overslaan the dialog returns the original File unchanged.
 *
 * Coordinates live in the image's natural pixel space — the component
 * converts mouse / pointer events before calling the reducers, so
 * flattening is resolution-independent and the saved image keeps its
 * full quality.
 */

export interface Point {
  x: number;
  y: number;
}

export type Stroke =
  | { kind: 'arrow'; from: Point; to: Point }
  | { kind: 'circle'; from: Point; to: Point };

export type StrokeKind = Stroke['kind'];

/** Size of the arrowhead as a fraction of shaft length, clamped. */
const ARROWHEAD_MIN_PX = 10;
const ARROWHEAD_MAX_PX = 30;
const ARROWHEAD_FRACTION = 0.2;
const ARROWHEAD_ANGLE = Math.PI / 6;

/**
 * Render a single stroke onto a 2D context. Pure in the sense that it
 * only calls canvas API methods — no hidden state. Used for both the
 * live preview overlay and the final flatten.
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  color: string,
  lineWidth: number,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.kind === 'arrow') {
    const { from, to } = stroke;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.5) {
      const headLen = Math.min(
        ARROWHEAD_MAX_PX,
        Math.max(ARROWHEAD_MIN_PX, len * ARROWHEAD_FRACTION),
      );
      const angle = Math.atan2(dy, dx);
      const a1 = angle + Math.PI - ARROWHEAD_ANGLE;
      const a2 = angle + Math.PI + ARROWHEAD_ANGLE;
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x + Math.cos(a1) * headLen, to.y + Math.sin(a1) * headLen);
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x + Math.cos(a2) * headLen, to.y + Math.sin(a2) * headLen);
      ctx.stroke();
    }
  } else {
    // kind === 'circle': ellipse inside the bounding box (from, to).
    const { from, to } = stroke;
    const cx = (from.x + to.x) / 2;
    const cy = (from.y + to.y) / 2;
    const rx = Math.abs(to.x - from.x) / 2;
    const ry = Math.abs(to.y - from.y) / 2;
    if (rx > 0 && ry > 0) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draw an image + a set of strokes onto a fresh canvas and return a
 * File suitable for the existing photo-save pipeline.
 *
 * Short-circuits when `strokes` is empty — returns the original File
 * directly so there's no needless encode cycle when the user picked
 * Overslaan or committed with zero strokes.
 */
export async function flattenFileWithStrokes(options: {
  file: File;
  strokes: Stroke[];
  color: string;
  lineWidth: number;
}): Promise<File> {
  const { file, strokes, color, lineWidth } = options;
  if (strokes.length === 0) return file;

  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available.');

  ctx.drawImage(bitmap, 0, 0);
  for (const stroke of strokes) drawStroke(ctx, stroke, color, lineWidth);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
  });
  if (!blob) throw new Error('Canvas flatten produced no blob.');

  const base = file.name.replace(/\.[^.]+$/, '');
  const outName = base.length > 0 ? `${base}-annotated.jpg` : 'annotated.jpg';
  return new File([blob], outName, { type: 'image/jpeg' });
}
