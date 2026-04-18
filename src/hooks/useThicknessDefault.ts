import { useEffect, useState } from 'react';
import {
  LINE_THICKNESS_DEFAULT,
  LINE_THICKNESS_MAX,
  LINE_THICKNESS_MIN,
} from '@/types';

/**
 * Persists the user's most-recent line-thickness so the next new line
 * starts there. v2.3.5 switched this from a 3-value enum to a number
 * in [LINE_THICKNESS_MIN..LINE_THICKNESS_MAX]; anything unparseable /
 * out-of-range / corrupt falls back to LINE_THICKNESS_DEFAULT.
 *
 * localStorage key: "pum-line-thickness-default".
 */
export const THICKNESS_STORAGE_KEY = 'pum-line-thickness-default';

function coerceToThickness(raw: string | null): number {
  if (raw === null || raw === '') return LINE_THICKNESS_DEFAULT;
  // Use Number() (not parseInt) so "3.5" parses as 3.5 and fails the
  // integer check — we don't want silent truncation of fractional
  // values. Legacy enum strings like "normaal" yield NaN and also fail.
  const n = Number(raw);
  if (!Number.isInteger(n)) return LINE_THICKNESS_DEFAULT;
  if (n < LINE_THICKNESS_MIN || n > LINE_THICKNESS_MAX) {
    return LINE_THICKNESS_DEFAULT;
  }
  return n;
}

export function useThicknessDefault(): [number, (next: number) => void] {
  const [value, setValue] = useState<number>(() => {
    if (typeof window === 'undefined') return LINE_THICKNESS_DEFAULT;
    try {
      return coerceToThickness(window.localStorage.getItem(THICKNESS_STORAGE_KEY));
    } catch {
      return LINE_THICKNESS_DEFAULT;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(THICKNESS_STORAGE_KEY, String(value));
    } catch {
      /* swallow quota / private-mode errors */
    }
  }, [value]);

  return [value, setValue];
}
