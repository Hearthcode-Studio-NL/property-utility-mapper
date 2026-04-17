import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLocalStorageBool } from './useLocalStorageBool';

describe('useLocalStorageBool', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the default when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorageBool('k', true));
    expect(result.current[0]).toBe(true);
  });

  it('reads an existing "true" from storage', () => {
    localStorage.setItem('k', 'true');
    const { result } = renderHook(() => useLocalStorageBool('k', false));
    expect(result.current[0]).toBe(true);
  });

  it('reads an existing "false" from storage', () => {
    localStorage.setItem('k', 'false');
    const { result } = renderHook(() => useLocalStorageBool('k', true));
    expect(result.current[0]).toBe(false);
  });

  it('persists an updated value to storage', () => {
    const { result } = renderHook(() => useLocalStorageBool('k', true));
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem('k')).toBe('false');
  });

  it('uses the key so independent keys hold independent values', () => {
    const { result: a } = renderHook(() => useLocalStorageBool('a', true));
    const { result: b } = renderHook(() => useLocalStorageBool('b', true));
    act(() => a.current[1](false));
    expect(a.current[0]).toBe(false);
    expect(b.current[0]).toBe(true);
    expect(localStorage.getItem('a')).toBe('false');
    expect(localStorage.getItem('b')).toBe('true');
  });
});
