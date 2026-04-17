import { Polyline } from 'react-leaflet';
import type { UtilityLine, UUID } from '../types';
import { UTILITY_META } from '../lib/utilityColors';

interface LinesLayerProps {
  lines: UtilityLine[];
  onLineClick?: (id: UUID) => void;
  interactive?: boolean;
  hideLineId?: UUID | null;
}

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
        <Polyline
          key={line.id}
          positions={line.vertices}
          pathOptions={{
            color: UTILITY_META[line.type].color,
            weight: 5,
            opacity: 0.9,
            interactive,
          }}
          eventHandlers={
            interactive && onLineClick ? { click: () => onLineClick(line.id) } : undefined
          }
        />
      ))}
    </>
  );
}
