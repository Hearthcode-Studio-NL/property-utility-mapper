import { useEffect, useState } from 'react';

export function useLocalStorageBool(
  key: string,
  defaultValue: boolean,
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return stored === 'true';
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // ignore quota / private-mode errors — state still works in memory
    }
  }, [key, value]);

  return [value, setValue];
}
