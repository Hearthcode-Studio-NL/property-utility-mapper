import { Fragment } from 'react';
import { Polyline } from 'react-leaflet';
import type { UtilityLine, UUID } from '../types';
import { CASING_COLOR, UTILITY_META } from '../lib/utilityColors';

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
const FILL_WEIGHT = 5;
const CASING_WEIGHT = 8;

export default function LinesLayer({
  lines,
  onLineClick,
  interactive = true,
  hideLineId = null,
}: LinesLayerProps) {
  const visible = hideLineId ? lines.filter((l) => l.id !== hideLineId) : lines;
  return (
    <>
      {visible.map((line) => (
        <Fragment key={line.id}>
          <Polyline
            positions={line.vertices}
            pathOptions={{
              color: CASING_COLOR,
              weight: CASING_WEIGHT,
              opacity: 0.9,
              interactive: false,
            }}
          />
          <Polyline
            positions={line.vertices}
            pathOptions={{
              color: UTILITY_META[line.type].color,
              weight: FILL_WEIGHT,
              opacity: 1,
              interactive,
            }}
            eventHandlers={
              interactive && onLineClick ? { click: () => onLineClick(line.id) } : undefined
            }
          />
        </Fragment>
      ))}
    </>
  );
}
