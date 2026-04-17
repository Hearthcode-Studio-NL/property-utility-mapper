import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { LAYERS } from '@/lib/map/layers';
import type { BaseLayerId, LayerSelection, OverlayId } from '@/types/map';

/**
 * Shared layer-selection state.
 *
 * Exposed via a React Context rather than a local hook because the state
 * is consumed in two places on the Property page — the map renderer and
 * the layer-manager panel — and they must share the same object. A local
 * `useState` per call site (the pre-V2.1-C refactor) created two
 * independent states and the panel's `setBase` never reached the map.
 *
 * Persistence format under `STORAGE_KEY`:
 *   { "base": "osm", "overlays": ["kadaster-brk", "user-drawings"] }
 */

const STORAGE_KEY = 'pum-layers';

export interface UseLayerSelectionResult {
  base: BaseLayerId;
  overlays: Set<OverlayId>;
  setBase: (id: BaseLayerId) => void;
  toggleOverlay: (id: OverlayId) => void;
  resetToDefaults: () => void;
}

function knownBaseIds(): Set<string> {
  return new Set(LAYERS.filter((l) => l.kind === 'base').map((l) => l.id));
}

function knownOverlayIds(): Set<string> {
  return new Set(
    LAYERS.filter(
      (l) => l.kind === 'overlay' || l.kind === 'virtual-overlay',
    ).map((l) => l.id),
  );
}

function computeDefaults(): LayerSelection {
  const defaultBaseEntry = LAYERS.find(
    (l) => l.kind === 'base' && l.defaultOn === true,
  );
  if (!defaultBaseEntry) {
    throw new Error('Layer catalogue has no base layer with defaultOn=true.');
  }

  const overlays = new Set<OverlayId>();
  for (const entry of LAYERS) {
    if (
      (entry.kind === 'overlay' || entry.kind === 'virtual-overlay') &&
      entry.defaultOn === true
    ) {
      overlays.add(entry.id as OverlayId);
    }
  }

  return {
    base: defaultBaseEntry.id as BaseLayerId,
    overlays,
  };
}

function loadFromStorage(): LayerSelection {
  const defaults = computeDefaults();
  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return defaults;

    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return defaults;
    const obj = parsed as Record<string, unknown>;

    const bases = knownBaseIds();
    const base: BaseLayerId =
      typeof obj.base === 'string' && bases.has(obj.base)
        ? (obj.base as BaseLayerId)
        : defaults.base;

    const known = knownOverlayIds();
    const overlays = new Set<OverlayId>();
    const storedOverlays = Array.isArray(obj.overlays) ? obj.overlays : [];
    for (const id of storedOverlays) {
      if (typeof id === 'string' && known.has(id)) {
        overlays.add(id as OverlayId);
      }
    }

    return { base, overlays };
  } catch {
    return defaults;
  }
}

function saveToStorage(selection: LayerSelection): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({
      base: selection.base,
      overlays: Array.from(selection.overlays),
    });
    window.localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    /* swallow quota / private-mode errors */
  }
}

/**
 * The core state hook. Internal — only the Provider calls this.
 * Kept as its own function so a single state instance flows through
 * one place in the tree.
 */
function useLayerSelectionState(): UseLayerSelectionResult {
  const [selection, setSelection] = useState<LayerSelection>(loadFromStorage);

  useEffect(() => {
    saveToStorage(selection);
  }, [selection]);

  const setBase = useCallback((id: BaseLayerId) => {
    setSelection((prev) => ({ ...prev, base: id }));
  }, []);

  const toggleOverlay = useCallback((id: OverlayId) => {
    setSelection((prev) => {
      const next = new Set(prev.overlays);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, overlays: next };
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setSelection(computeDefaults());
  }, []);

  return {
    base: selection.base,
    overlays: selection.overlays,
    setBase,
    toggleOverlay,
    resetToDefaults,
  };
}

const LayerSelectionContext = createContext<UseLayerSelectionResult | null>(null);

export function LayerSelectionProvider({ children }: { children: ReactNode }) {
  const value = useLayerSelectionState();
  return (
    <LayerSelectionContext.Provider value={value}>
      {children}
    </LayerSelectionContext.Provider>
  );
}

export function useLayerSelection(): UseLayerSelectionResult {
  const ctx = useContext(LayerSelectionContext);
  if (ctx === null) {
    throw new Error(
      'useLayerSelection must be used inside <LayerSelectionProvider>.',
    );
  }
  return ctx;
}
