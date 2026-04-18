import { Fragment } from 'react';
import { Polyline } from 'react-leaflet';
import type { UtilityLine, UUID } from '../types';
import { CASING_COLOR, UTILITY_META } from '../lib/utilityColors';
import { LINE_WIDTH } from '../lib/lineThickness';

interface LinesLayerProps {
  lines: UtilityLine[];
  onLineClick?: (id: UUID) => void;
  interactive?: boolean;
  hideLineId?: UUID | null;
}

// Fill is the bright semantic colour; casing is the dark outline underneath.
// Rendering two Polylines per line, casing-first, produces the outline effect.
// Keeping the click / hover interactivity on the TOP stroke so interaction
// hit-testing matches the visible colour and casing geometry is irrelevant.
// Widths now come from the per-line `thickness` field (v2.3.1), mapped
// through LINE_WIDTH so the 1.5-px halo stays proportional.

export default function LinesLayer({
  lines,
  onLineClick,
  interactive = true,
  hideLineId = null,
}: LinesLayerProps) {
  const visible = hideLineId ? lines.filter((l) => l.id !== hideLineId) : lines;
  return (
    <>
      {visible.map((line) => {
        const { fill, casing } = LINE_WIDTH[line.thickness];
        return (
          <Fragment key={line.id}>
            <Polyline
              positions={line.vertices}
              pathOptions={{
                color: CASING_COLOR,
                weight: casing,
                opacity: 0.9,
                interactive: false,
              }}
            />
            <Polyline
              positions={line.vertices}
              pathOptions={{
                color: UTILITY_META[line.type].color,
                weight: fill,
                opacity: 1,
                interactive,
              }}
              eventHandlers={
                interactive && onLineClick ? { click: () => onLineClick(line.id) } : undefined
              }
            />
          </Fragment>
        );
      })}
    </>
  );
}
