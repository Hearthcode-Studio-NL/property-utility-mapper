import { CircleMarker, Polyline, useMapEvents } from 'react-leaflet';

interface MeasureLayerProps {
  points: [number, number][];
  onPointAdded: (p: [number, number]) => void;
}

const COLOR = '#0f172a';

export default function MeasureLayer({ points, onPointAdded }: MeasureLayerProps) {
  useMapEvents({
    click(e) {
      onPointAdded([e.latlng.lat, e.latlng.lng]);
    },
  });

  return (
    <>
      {points.length >= 2 && (
        <Polyline
          positions={points}
          pathOptions={{
            color: COLOR,
            weight: 3,
            dashArray: '4,6',
            interactive: false,
          }}
        />
      )}
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={p}
          radius={4}
          pathOptions={{
            color: COLOR,
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2,
            interactive: false,
          }}
        />
      ))}
    </>
  );
}
