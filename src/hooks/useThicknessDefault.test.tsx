import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  THICKNESS_STORAGE_KEY,
  useThicknessDefault,
} from './useThicknessDefault';

describe('useThicknessDefault (v2.3.5 — numeric)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns 4 when nothing is stored (default)', () => {
    const { result } = renderHook(() => useThicknessDefault());
    expect(result.current[0]).toBe(4);
  });

  it('reads a valid stored integer on mount', () => {
    localStorage.setItem(THICKNESS_STORAGE_KEY, '6');
    const { result } = renderHook(() => useThicknessDefault());
    expect(result.current[0]).toBe(6);
  });

  it.each([
    ['non-numeric garbage', 'not-a-number'],
    ['legacy enum string', 'normaal'],
    ['below min (0)', '0'],
    ['above max (9)', '9'],
    ['float', '3.5'],
    ['empty string', ''],
  ])('falls back to 4 for %s', (_label, stored) => {
    localStorage.setItem(THICKNESS_STORAGE_KEY, stored);
    const { result } = renderHook(() => useThicknessDefault());
    expect(result.current[0]).toBe(4);
  });

  it('persists setter updates to localStorage and a fresh mount reads them back', () => {
    const first = renderHook(() => useThicknessDefault());
    act(() => first.result.current[1](7));
    expect(localStorage.getItem(THICKNESS_STORAGE_KEY)).toBe('7');

    first.unmount();

    const second = renderHook(() => useThicknessDefault());
    expect(second.result.current[0]).toBe(7);
  });
});
