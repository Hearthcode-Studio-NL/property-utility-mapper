import { useEffect, useRef, useState } from 'react';
import { haversineMeters } from '../lib/distance';

export interface GpsPoint {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export type GpsStatus =
  | 'idle'
  | 'starting'
  | 'watching'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface UseGpsWalkOptions {
  active: boolean;
  minAccuracyMeters?: number;
  minDistanceMeters?: number;
}

export interface UseGpsWalkResult {
  status: GpsStatus;
  error: string | null;
  points: [number, number][];
  latest: GpsPoint | null;
  reset: () => void;
}

interface WatchError {
  status: GpsStatus;
  message: string;
}

function detectUnavailability(): string | null {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return 'Geolocation is not supported in this browser.';
  }
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'GPS requires HTTPS or localhost. Open this app on a secure origin to capture a walk.';
  }
  return null;
}

export function useGpsWalk({
  active,
  minAccuracyMeters = 30,
  minDistanceMeters = 1.5,
}: UseGpsWalkOptions): UseGpsWalkResult {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [latest, setLatest] = useState<GpsPoint | null>(null);
  const [watchError, setWatchError] = useState<WatchError | null>(null);
  const lastAcceptedRef = useRef<[number, number] | null>(null);

  const unavailabilityReason = detectUnavailability();

  useEffect(() => {
    if (!active || unavailabilityReason) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const point: GpsPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setLatest(point);
        setWatchError(null);

        if (point.accuracy > minAccuracyMeters) return;

        const coords: [number, number] = [point.lat, point.lng];
        const last = lastAcceptedRef.current;
        if (last && haversineMeters(last, coords) < minDistanceMeters) return;

        lastAcceptedRef.current = coords;
        setPoints((pts) => [...pts, coords]);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setWatchError({
            status: 'denied',
            message: 'Location permission denied. Enable it in your browser settings.',
          });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setWatchError({
            status: 'error',
            message: 'Location unavailable. Try moving to a spot with clearer sky.',
          });
        } else if (err.code === err.TIMEOUT) {
          setWatchError({ status: 'error', message: 'Location timed out. Still trying…' });
        } else {
          setWatchError({
            status: 'error',
            message: err.message || 'Unknown geolocation error.',
          });
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15_000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [active, minAccuracyMeters, minDistanceMeters, unavailabilityReason]);

  function reset() {
    setPoints([]);
    setLatest(null);
    setWatchError(null);
    lastAcceptedRef.current = null;
  }

  const status: GpsStatus = !active
    ? 'idle'
    : unavailabilityReason
      ? 'unavailable'
      : watchError
        ? watchError.status
        : latest
          ? 'watching'
          : 'starting';
  const error = !active ? null : (unavailabilityReason ?? watchError?.message ?? null);

  return { status, error, points, latest, reset };
}
