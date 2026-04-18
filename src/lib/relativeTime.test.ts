import { describe, expect, it } from 'vitest';
import { formatRelativeTimeNl } from './relativeTime';

function at(iso: string): Date {
  return new Date(iso);
}

describe('formatRelativeTimeNl', () => {
  const now = at('2026-04-18T12:00:00.000Z');

  it.each([
    ['2026-04-18T11:59:30.000Z', 'Nu'],
    ['2026-04-18T11:58:00.000Z', '2 min geleden'],
    ['2026-04-18T10:00:00.000Z', '2 uur geleden'],
    ['2026-04-17T12:00:00.000Z', 'Gisteren'],
    ['2026-04-15T12:00:00.000Z', '3 dagen geleden'],
    ['2026-04-08T12:00:00.000Z', '1 week geleden'],
    ['2026-03-28T12:00:00.000Z', '3 weken geleden'],
    ['2026-02-01T12:00:00.000Z', '3 maanden geleden'],
    ['2024-04-18T12:00:00.000Z', '2 jaar geleden'],
  ])('%s -> %s', (iso, expected) => {
    expect(formatRelativeTimeNl(iso, now)).toBe(expected);
  });

  it('returns empty string for an unparseable ISO', () => {
    expect(formatRelativeTimeNl('not-a-date', now)).toBe('');
  });

  it('treats a future timestamp as "Nu" (clock-skew safe)', () => {
    expect(formatRelativeTimeNl('2030-01-01T00:00:00.000Z', now)).toBe('Nu');
  });
});
