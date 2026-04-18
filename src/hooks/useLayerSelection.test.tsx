import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LayerSelectionProvider, useLayerSelection } from './useLayerSelection';

const STORAGE_KEY = 'pum-layers';

function wrapper({ children }: { children: ReactNode }) {
  return <LayerSelectionProvider>{children}</LayerSelectionProvider>;
}

describe('useLayerSelection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('fresh user lands on the v2.1.3 default base (BRT grijs)', () => {
    const { result } = renderHook(() => useLayerSelection(), { wrapper });

    // From layers.ts: pdok-brt-grijs is the only base with defaultOn=true
    // after v2.1.3; kadaster-brk and user-drawings are the default overlays.
    expect(result.current.base).toBe('pdok-brt-grijs');
    expect(Array.from(result.current.overlays).sort()).toEqual(
      ['kadaster-brk', 'user-drawings'].sort(),
    );
  });

  it('existing user with stored base="osm" is preserved (no forced migration)', () => {
    // Simulates a v2.1.2 user who had the old OSM default persisted.
    // v2.1.3 must honour their choice — they don't get silently bounced
    // onto the new neutral default.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        base: 'osm',
        overlays: ['kadaster-brk', 'user-drawings'],
      }),
    );

    const { result } = renderHook(() => useLayerSelection(), { wrapper });

    expect(result.current.base).toBe('osm');
    expect(result.current.overlays.has('kadaster-brk')).toBe(true);
    expect(result.current.overlays.has('user-drawings')).toBe(true);
  });

  it('setBase changes only the base, not the overlays', () => {
    const { result } = renderHook(() => useLayerSelection(), { wrapper });
    const beforeOverlays = Array.from(result.current.overlays).sort();

    act(() => result.current.setBase('pdok-luchtfoto'));

    expect(result.current.base).toBe('pdok-luchtfoto');
    expect(Array.from(result.current.overlays).sort()).toEqual(beforeOverlays);
  });

  it('toggleOverlay adds or removes, and two toggles are a no-op', () => {
    const { result } = renderHook(() => useLayerSelection(), { wrapper });
    expect(result.current.overlays.has('kadaster-brk')).toBe(true);

    act(() => result.current.toggleOverlay('kadaster-brk'));
    expect(result.current.overlays.has('kadaster-brk')).toBe(false);

    act(() => result.current.toggleOverlay('kadaster-brk'));
    expect(result.current.overlays.has('kadaster-brk')).toBe(true);
  });

  it('persists to localStorage and a fresh mount picks up the prior state', () => {
    const first = renderHook(() => useLayerSelection(), { wrapper });

    act(() => first.result.current.setBase('pdok-luchtfoto'));
    act(() => first.result.current.toggleOverlay('kadaster-brk'));
    // kadaster-brk was ON by default, so the toggle above turns it OFF.

    // Sanity: storage should now reflect the new state.
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.base).toBe('pdok-luchtfoto');
    expect(parsed.overlays).not.toContain('kadaster-brk');
    expect(parsed.overlays).toContain('user-drawings');

    first.unmount();

    const second = renderHook(() => useLayerSelection(), { wrapper });
    expect(second.result.current.base).toBe('pdok-luchtfoto');
    expect(second.result.current.overlays.has('kadaster-brk')).toBe(false);
    expect(second.result.current.overlays.has('user-drawings')).toBe(true);
  });

  it('falls back to defaults when the stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not: valid, json');

    const { result } = renderHook(() => useLayerSelection(), { wrapper });

    expect(result.current.base).toBe('pdok-brt-grijs');
    expect(result.current.overlays.has('kadaster-brk')).toBe(true);
    expect(result.current.overlays.has('user-drawings')).toBe(true);
  });

  it('falls back to defaults when the stored JSON is not an object', () => {
    localStorage.setItem(STORAGE_KEY, '"just a string"');

    const { result } = renderHook(() => useLayerSelection(), { wrapper });

    expect(result.current.base).toBe('pdok-brt-grijs');
    expect(result.current.overlays.has('kadaster-brk')).toBe(true);
  });

  it('replaces an unknown stored base id with the default and drops unknown overlay ids', () => {
    // Covers the Phase 2 case: a stored selection that references a base
    // id no longer in the catalogue (future catalogue pruning, typo, etc.)
    // falls back to the current default rather than leaving the map blank.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        base: 'some-fictional-base',
        overlays: ['kadaster-brk', 'totally-made-up', 'user-drawings'],
      }),
    );

    const { result } = renderHook(() => useLayerSelection(), { wrapper });

    expect(result.current.base).toBe('pdok-brt-grijs');
    expect(result.current.overlays.has('kadaster-brk')).toBe(true);
    expect(result.current.overlays.has('user-drawings')).toBe(true);
    // The unknown overlay id is silently dropped — assert via a runtime
    // membership check since the literal isn't assignable to OverlayId.
    expect([...result.current.overlays]).not.toContain('totally-made-up');
  });

  it('tolerates a valid base with a missing overlays array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ base: 'pdok-luchtfoto' }));

    const { result } = renderHook(() => useLayerSelection(), { wrapper });

    expect(result.current.base).toBe('pdok-luchtfoto');
    // No overlays stored ⇒ nothing recognised ⇒ empty set (NOT defaults).
    expect(result.current.overlays.size).toBe(0);
  });

  it('resetToDefaults restores the initial catalogue state', () => {
    const { result } = renderHook(() => useLayerSelection(), { wrapper });

    act(() => result.current.setBase('pdok-luchtfoto'));
    act(() => result.current.toggleOverlay('kadaster-brk'));
    act(() => result.current.toggleOverlay('user-drawings'));
    expect(result.current.base).toBe('pdok-luchtfoto');
    expect(result.current.overlays.size).toBe(0);

    act(() => result.current.resetToDefaults());

    expect(result.current.base).toBe('pdok-brt-grijs');
    expect(Array.from(result.current.overlays).sort()).toEqual(
      ['kadaster-brk', 'user-drawings'].sort(),
    );
  });

  it('setBase and toggleOverlay identities are stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useLayerSelection(), { wrapper });
    const setBaseA = result.current.setBase;
    const toggleOverlayA = result.current.toggleOverlay;
    const resetA = result.current.resetToDefaults;

    rerender();

    expect(result.current.setBase).toBe(setBaseA);
    expect(result.current.toggleOverlay).toBe(toggleOverlayA);
    expect(result.current.resetToDefaults).toBe(resetA);
  });
});
