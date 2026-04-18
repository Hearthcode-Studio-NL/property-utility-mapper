/**
 * Relative-time labels in Dutch. Hand-written instead of pulling in a
 * date library — we only need a few tiers and Dutch-only output.
 *
 * Thresholds roughly match GitHub / Apple Human Interface Guidelines:
 *   < 45 s             → "Nu"
 *   < 60 min           → "X min geleden"
 *   < 24 h             → "X uur geleden"
 *   yesterday          → "Gisteren"
 *   < 7 days           → "X dagen geleden"
 *   < ~30 days         → "X weken geleden"
 *   < ~365 days        → "X maanden geleden"
 *   otherwise          → "X jaar geleden"
 *
 * Accepts an ISO string. Pass a reference `now` to keep tests deterministic.
 */
export function formatRelativeTimeNl(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const diffMs = now.getTime() - then.getTime();
  const seconds = Math.max(0, Math.round(diffMs / 1000));
  if (seconds < 45) return 'Nu';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min geleden`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'Gisteren';
  if (days < 7) return `${days} dagen geleden`;

  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? 'week' : 'weken'} geleden`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'maand' : 'maanden'} geleden`;

  const years = Math.round(days / 365);
  return `${years} ${years === 1 ? 'jaar' : 'jaar'} geleden`;
}
