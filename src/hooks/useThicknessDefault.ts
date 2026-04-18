import { useEffect, useState } from 'react';
import { LINE_THICKNESSES, type LineThickness } from '@/types';

/**
 * Persists the user's most-recent line-thickness choice so the NEXT new
 * line they draw starts at that preset. Same shape / invariants as
 * useLocalStorageBool, but enum-typed.
 *
 * localStorage key: "pum-line-thickness-default"
 *
 * Unknown or corrupt stored values fall back to "normaal". Failure to
 * write (quota / private-mode) is silently swallowed — in-memory state
 * still works for the session.
 */
export const THICKNESS_STORAGE_KEY = 'pum-line-thickness-default';

export function useThicknessDefault(): [
  LineThickness,
  (next: LineThickness) => void,
] {
  const [value, setValue] = useState<LineThickness>(() => {
    if (typeof window === 'undefined') return 'normaal';
    try {
      const stored = window.localStorage.getItem(THICKNESS_STORAGE_KEY);
      if (stored === null) return 'normaal';
      return (LINE_THICKNESSES as readonly string[]).includes(stored)
        ? (stored as LineThickness)
        : 'normaal';
    } catch {
      return 'normaal';
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(THICKNESS_STORAGE_KEY, value);
    } catch {
      /* swallow quota / private-mode errors */
    }
  }, [value]);

  return [value, setValue];
}
