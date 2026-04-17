import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport is at or above the given minimum width.
 * Defaults to Tailwind's `md` breakpoint (768 px) so desktop users get
 * Popover UI and mobile users get Sheet UI.
 *
 * The lazy `useState` initialiser reads `matchMedia` synchronously so the
 * first render already has the right answer (no layout flicker). The
 * subscription in `useEffect` keeps the value live when the window is
 * resized or a device is rotated.
 */
export function useIsDesktop(minWidthPx = 768): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia?.(`(min-width: ${minWidthPx}px)`).matches ?? true;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(`(min-width: ${minWidthPx}px)`);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [minWidthPx]);

  return isDesktop;
}
