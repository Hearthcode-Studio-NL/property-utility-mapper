// UUID v4 generator with graceful fallbacks.
//
// crypto.randomUUID only exists on secure contexts (HTTPS + localhost).
// On plain-HTTP LAN URLs it's undefined, which used to crash the app on
// first save. crypto.getRandomValues is available everywhere, so we use
// that when randomUUID isn't there. Math.random is the last resort — not
// cryptographically strong, but these IDs are local row identifiers, not
// session tokens.

function bytesToUuid(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function generateId(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return bytesToUuid(bytes);
    }
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytesToUuid(bytes);
}
