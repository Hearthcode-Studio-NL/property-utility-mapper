import { useEffect, useRef } from 'react';
import { Polyline, useMap, useMapEvents } from 'react-leaflet';
import type { Coord } from '../lib/snap';
import { CASING_COLOR } from '../lib/utilityColors';
import { LINE_WIDTH } from '../lib/lineThickness';
import type { LineThickness } from '../types';

interface SketchLayerProps {
  points: Coord[];
  color: string;
  thickness: LineThickness;
  onStartStroke: (p: Coord) => void;
  onAppendPoint: (p: Coord) => void;
}

const MIN_PIXEL_STEP = 4;

export default function SketchLayer({
  points,
  color,
  thickness,
  onStartStroke,
  onAppendPoint,
}: SketchLayerProps) {
  const { fill, casing } = LINE_WIDTH[thickness];
  const map = useMap();
  const activeRef = useRef(false);
  const lastPixelRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    map.dragging.disable();
    map.doubleClickZoom.disable();
    return () => {
      map.dragging.enable();
      map.doubleClickZoom.enable();
    };
  }, [map]);

  useMapEvents({
    mousedown(e) {
      activeRef.current = true;
      lastPixelRef.current = map.latLngToContainerPoint(e.latlng);
      onStartStroke([e.latlng.lat, e.latlng.lng]);
    },
    mousemove(e) {
      if (!activeRef.current) return;
      const px = map.latLngToContainerPoint(e.latlng);
      const last = lastPixelRef.current;
      if (last) {
        const dx = px.x - last.x;
        const dy = px.y - last.y;
        if (Math.sqrt(dx * dx + dy * dy) < MIN_PIXEL_STEP) return;
      }
      lastPixelRef.current = px;
      onAppendPoint([e.latlng.lat, e.latlng.lng]);
    },
    mouseup() {
      activeRef.current = false;
    },
  });

  if (points.length < 2) return null;
  return (
    <>
      <Polyline
        positions={points}
        pathOptions={{
          color: CASING_COLOR,
          weight: casing,
          dashArray: '6,8',
          opacity: 0.9,
          interactive: false,
        }}
      />
      <Polyline
        positions={points}
        pathOptions={{
          color,
          weight: fill,
          dashArray: '6,8',
          interactive: false,
        }}
      />
    </>
  );
}
