import { useEffect } from 'react';
import { Circle, CircleMarker, Polyline, useMap } from 'react-leaflet';
import type { GpsPoint } from '../hooks/useGpsWalk';

interface WalkingLayerProps {
  points: [number, number][];
  current: GpsPoint | null;
  color: string;
  follow?: boolean;
}

export default function WalkingLayer({
  points,
  current,
  color,
  follow = true,
}: WalkingLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!follow || !current) return;
    map.panTo([current.lat, current.lng], { animate: true });
  }, [follow, current, map]);

  return (
    <>
      {points.length >= 2 && (
        <Polyline
          positions={points}
          pathOptions={{ color, weight: 4, dashArray: '6,8', interactive: false }}
        />
      )}
      {current && (
        <>
          <Circle
            center={[current.lat, current.lng]}
            radius={current.accuracy}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.08,
              weight: 1,
              interactive: false,
            }}
          />
          <CircleMarker
            center={[current.lat, current.lng]}
            radius={7}
            pathOptions={{
              color: '#ffffff',
              fillColor: color,
              fillOpacity: 1,
              weight: 2,
              interactive: false,
            }}
          />
        </>
      )}
    </>
  );
}
