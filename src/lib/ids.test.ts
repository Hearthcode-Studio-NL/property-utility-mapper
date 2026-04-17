import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateId } from './ids';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a UUID-v4-shaped string from crypto.randomUUID when available', () => {
    const id = generateId();
    expect(id).toMatch(UUID_V4_RE);
  });

  it('returns distinct ids on subsequent calls', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });

  it('falls back to getRandomValues when randomUUID is missing', () => {
    const getRandomValues = (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = i;
      return arr;
    };
    vi.stubGlobal('crypto', { getRandomValues });

    const id = generateId();
    expect(id).toMatch(UUID_V4_RE);
  });

  it('falls back to Math.random when crypto is unavailable entirely', () => {
    vi.stubGlobal('crypto', undefined);
    const id = generateId();
    expect(id).toMatch(UUID_V4_RE);
  });
});
