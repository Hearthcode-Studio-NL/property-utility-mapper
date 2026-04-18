import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Circle, MoveUpRight, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  drawStroke,
  flattenFileWithStrokes,
  type Point,
  type Stroke,
  type StrokeKind,
} from '@/lib/photoAnnotation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * One-shot annotator dialog (v2.3.4). Sits between "photo chosen" and
 * "photo saved to Dexie" in both the line-photo and cover-photo flows.
 *
 *   - Arrow and Circle are the only tools, per scope.
 *   - Undo / Wissen are in-dialog only; closing the dialog drops them.
 *   - "Bewaar" flattens strokes into the source image and returns a
 *     new File via onDone.
 *   - "Overslaan" returns the ORIGINAL File unchanged — no re-encode,
 *     no EXIF loss, no stroke composition.
 *   - Dismissing the dialog without Bewaar / Overslaan (X, Esc,
 *     overlay click) calls onCancel so the caller can abandon the
 *     save entirely. Annotations never persist separately from the
 *     image; that was Wijnand's 2026-04-17 decision.
 */

interface Props {
  open: boolean;
  file: File | null;
  /** Stroke colour — utility line colour for line photos, slate for cover. */
  color: string;
  onOpenChange: (open: boolean) => void;
  onDone: (result: File) => void;
  onCancel?: () => void;
}

const LINE_WIDTH_IMAGE_PX = 6; // drawn on the natural-res canvas; scales down on display

export default function PhotoAnnotator({
  open,
  file,
  color,
  onOpenChange,
  onDone,
  onCancel,
}: Props) {
  const [tool, setTool] = useState<StrokeKind>('arrow');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [flattening, setFlattening] = useState(false);

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  // Reset annotator state when (open, file) changes — "adjust state
  // during render" pattern, avoids a useEffect + setState which would
  // trip react-hooks/set-state-in-effect.
  const resetSignature = open ? file : null;
  const [lastResetSignature, setLastResetSignature] = useState<File | null>(
    null,
  );
  if (resetSignature !== lastResetSignature) {
    setLastResetSignature(resetSignature);
    setStrokes([]);
    setActiveStroke(null);
    setFlattening(false);
    setTool('arrow');
    setImgSize(null);
  }

  // imgSrc: object URL created during render, revoked via a
  // cleanup-only effect. Same pattern as PropertyNotesCover / CoverPhotoRadio.
  const imgSrc = useMemo(
    () => (open && file ? URL.createObjectURL(file) : null),
    [open, file],
  );
  useEffect(() => {
    if (!imgSrc) return;
    return () => URL.revokeObjectURL(imgSrc);
  }, [imgSrc]);

  // Natural-size probe via createImageBitmap — runs async so the
  // setImgSize call lives outside the lint rule's sync-setState scope.
  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    (async () => {
      try {
        const bmp = await createImageBitmap(file, {
          imageOrientation: 'from-image',
        });
        if (!cancelled) setImgSize({ w: bmp.width, h: bmp.height });
      } catch {
        if (!cancelled) {
          toast.error('Foto kan niet geopend worden voor annotatie.');
          onOpenChange(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, file, onOpenChange]);

  // Redraw the overlay canvas whenever strokes / active stroke / image size
  // change. Runs synchronously (useLayoutEffect) so the user sees the
  // stroke land before the next paint — no ghost frames.
  useLayoutEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !imgSize) return;
    if (canvas.width !== imgSize.w) canvas.width = imgSize.w;
    if (canvas.height !== imgSize.h) canvas.height = imgSize.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) drawStroke(ctx, s, color, LINE_WIDTH_IMAGE_PX);
    if (activeStroke) drawStroke(ctx, activeStroke, color, LINE_WIDTH_IMAGE_PX);
  }, [strokes, activeStroke, imgSize, color]);

  const toImageCoord = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): Point | null => {
      const canvas = overlayRef.current;
      if (!canvas || !imgSize) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const sx = imgSize.w / rect.width;
      const sy = imgSize.h / rect.height;
      return {
        x: (e.clientX - rect.left) * sx,
        y: (e.clientY - rect.top) * sy,
      };
    },
    [imgSize],
  );

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const p = toImageCoord(e);
    if (!p) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setActiveStroke({ kind: tool, from: p, to: p });
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!activeStroke) return;
    const p = toImageCoord(e);
    if (!p) return;
    setActiveStroke({ ...activeStroke, to: p });
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = e.target as HTMLCanvasElement;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    if (!activeStroke) return;
    // Discard zero-length strokes (accidental clicks).
    const { from, to } = activeStroke;
    if (Math.hypot(to.x - from.x, to.y - from.y) < 3) {
      setActiveStroke(null);
      return;
    }
    setStrokes((prev) => [...prev, activeStroke]);
    setActiveStroke(null);
  }

  function handleUndo() {
    setStrokes((prev) => prev.slice(0, -1));
  }
  function handleClear() {
    setStrokes([]);
    setActiveStroke(null);
  }
  function handleSkip() {
    if (!file) return;
    // Parent owns open/close — we just signal "done, here's the file".
    // Lets a multi-file queue advance to the next file without flicker.
    onDone(file);
  }

  async function handleSave() {
    if (!file) return;
    setFlattening(true);
    try {
      const result = await flattenFileWithStrokes({
        file,
        strokes,
        color,
        lineWidth: LINE_WIDTH_IMAGE_PX,
      });
      onDone(result);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Annotatie opslaan mislukt: ${err.message}`
          : 'Annotatie opslaan mislukt.',
      );
    } finally {
      setFlattening(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && flattening) return; // ignore dismiss while flattening
    onOpenChange(next);
    if (!next) onCancel?.();
  }

  const canUndo = strokes.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[95dvh] max-w-3xl flex-col gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Foto annoteren</DialogTitle>
          <DialogDescription>
            Teken pijlen of cirkels op de foto. Annotaties worden
            vastgezet op de afbeelding bij het opslaan.
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="Annotatie-gereedschap"
        >
          <Button
            type="button"
            variant={tool === 'arrow' ? 'default' : 'outline'}
            size="sm"
            aria-pressed={tool === 'arrow'}
            onClick={() => setTool('arrow')}
          >
            <MoveUpRight className="mr-1 h-4 w-4" aria-hidden />
            Pijl
          </Button>
          <Button
            type="button"
            variant={tool === 'circle' ? 'default' : 'outline'}
            size="sm"
            aria-pressed={tool === 'circle'}
            onClick={() => setTool('circle')}
          >
            <Circle className="mr-1 h-4 w-4" aria-hidden />
            Cirkel
          </Button>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <Undo2 className="mr-1 h-4 w-4" aria-hidden />
            Ongedaan maken
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={strokes.length === 0 && activeStroke === null}
          >
            <Trash2 className="mr-1 h-4 w-4" aria-hidden />
            Wissen
          </Button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {imgSrc && (
            <img
              src={imgSrc}
              alt=""
              className="max-h-[60dvh] max-w-full select-none object-contain"
              draggable={false}
            />
          )}
          <canvas
            ref={overlayRef}
            className={cn(
              'absolute inset-0 m-auto h-auto max-h-[60dvh] w-auto max-w-full touch-none select-none',
              // Match the <img>'s object-contain letterboxing — pointer
              // events only fire where the image actually is thanks to
              // the same max-h / max-w constraints.
              tool === 'arrow' ? 'cursor-crosshair' : 'cursor-crosshair',
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
            disabled={flattening}
          >
            Overslaan
          </Button>
          <Button type="button" onClick={handleSave} disabled={flattening}>
            {flattening ? 'Opslaan…' : 'Bewaar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
