import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  THICKNESS_STORAGE_KEY,
  useThicknessDefault,
} from './useThicknessDefault';

describe('useThicknessDefault', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns "normaal" when nothing is stored', () => {
    const { result } = renderHook(() => useThicknessDefault());
    expect(result.current[0]).toBe('normaal');
  });

  it('reads a valid stored value on mount', () => {
    localStorage.setItem(THICKNESS_STORAGE_KEY, 'dik');
    const { result } = renderHook(() => useThicknessDefault());
    expect(result.current[0]).toBe('dik');
  });

  it('falls back to "normaal" if the stored value is outside the enum', () => {
    localStorage.setItem(THICKNESS_STORAGE_KEY, 'not-a-thickness');
    const { result } = renderHook(() => useThicknessDefault());
    expect(result.current[0]).toBe('normaal');
  });

  it('persists setter updates to localStorage and a fresh mount reads them back', () => {
    const first = renderHook(() => useThicknessDefault());
    act(() => first.result.current[1]('dik'));
    expect(localStorage.getItem(THICKNESS_STORAGE_KEY)).toBe('dik');

    first.unmount();

    const second = renderHook(() => useThicknessDefault());
    expect(second.result.current[0]).toBe('dik');
  });
});
