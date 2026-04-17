export function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function slugify(input: string, maxLen = 48): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (slug.slice(0, maxLen) || 'property').replace(/-+$/, '');
}

export function exportFilename(address: string, ext: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${slugify(address)}-${date}.${ext}`;
}
