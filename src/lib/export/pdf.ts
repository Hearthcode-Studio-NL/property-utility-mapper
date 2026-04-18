import { jsPDF } from 'jspdf';
import type { Photo, Property, UtilityLine } from '../../types';
import { UTILITY_META } from '../utilityColors';
import { formatDisplayAddress } from '../address';
import { listPhotosForLine } from '../../db/photos';
import { exportFilename } from './download';
import { renderMapDataUrl } from './png';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

async function getImageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to read image dimensions.'));
    img.src = dataUrl;
  });
}

function lineLabel(line: UtilityLine): string {
  const base = UTILITY_META[line.type].label;
  const notes = line.notes?.trim();
  if (!notes) return base;
  const snippet = notes.length > 60 ? `${notes.slice(0, 60)}…` : notes;
  return `${base} — ${snippet}`;
}

export async function exportPdf(
  mapEl: HTMLElement,
  property: Property,
  lines: UtilityLine[],
): Promise<void> {
  const mapDataUrl = await renderMapDataUrl(mapEl);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Kaart leidingen perceel', margin, y);
  y += 7;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDisplayAddress(property), margin, y);
  y += 5;

  if (property.fullAddress) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110);
    const fullLines = doc.splitTextToSize(property.fullAddress, pageWidth - margin * 2);
    doc.text(fullLines, margin, y);
    y += fullLines.length * 4;
    doc.setTextColor(0);
  }

  // v2.2.1: property-level notes in the header. Truncate at ~300 chars so
  // the map still fits on the first page. splitTextToSize handles line
  // wrapping against the page width.
  if (property.notes && property.notes.trim().length > 0) {
    const MAX_NOTES_CHARS = 300;
    const raw = property.notes.trim();
    const truncated =
      raw.length > MAX_NOTES_CHARS ? `${raw.slice(0, MAX_NOTES_CHARS)}…` : raw;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70);
    const noteLines = doc.splitTextToSize(truncated, pageWidth - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4;
    doc.setTextColor(0);
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130);
  doc.text(
    `${property.centerLat.toFixed(5)}, ${property.centerLng.toFixed(5)} · Geëxporteerd ${new Date().toLocaleString('nl-NL')}`,
    margin,
    y,
  );
  doc.setTextColor(0);
  y += 6;

  const mapWidthMm = pageWidth - margin * 2;
  const mapHeightMm = 120;
  doc.addImage(mapDataUrl, 'PNG', margin, y, mapWidthMm, mapHeightMm);
  y += mapHeightMm + 6;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Leidingen (${lines.length})`, margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  if (lines.length === 0) {
    doc.setTextColor(130);
    doc.text('Nog geen leidingen vastgelegd.', margin, y);
    doc.setTextColor(0);
  } else {
    for (const line of lines) {
      if (y + 14 > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      const meta = UTILITY_META[line.type];
      const [r, g, b] = hexToRgb(meta.color);
      doc.setFillColor(r, g, b);
      doc.circle(margin + 1.5, y - 1.2, 1.3, 'F');

      doc.setFont('helvetica', 'bold');
      doc.text(meta.label, margin + 5, y);
      doc.setFont('helvetica', 'normal');

      const bits: string[] = [];
      if (line.depthCm !== undefined) bits.push(`${line.depthCm} cm diep`);
      if (line.diameterMm !== undefined) bits.push(`Ø ${line.diameterMm} mm`);
      if (line.material) bits.push(line.material);
      if (line.installDate) bits.push(`aangelegd ${line.installDate.slice(0, 10)}`);
      bits.push(`${line.vertices.length} punten`);
      const photoCount = line.photoIds?.length ?? 0;
      if (photoCount > 0) bits.push(`${photoCount} foto${photoCount === 1 ? '' : "'s"}`);

      doc.setTextColor(90);
      doc.text(bits.join(' · '), margin + 5, y + 4, {
        maxWidth: pageWidth - margin * 2 - 5,
      });
      doc.setTextColor(0);
      y += 10;

      if (line.notes) {
        const notesLines = doc.splitTextToSize(line.notes, pageWidth - margin * 2 - 5);
        if (y + notesLines.length * 4 + 2 > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.setTextColor(70);
        doc.text(notesLines, margin + 5, y);
        doc.setTextColor(0);
        y += notesLines.length * 4 + 2;
      }
    }
  }

  // Photo section — one block per line with photos, thumbnails in a grid.
  const linesWithPhotos: Array<{ line: UtilityLine; photos: Photo[] }> = [];
  for (const line of lines) {
    if ((line.photoIds?.length ?? 0) > 0) {
      const photos = await listPhotosForLine(line.id);
      if (photos.length > 0) linesWithPhotos.push({ line, photos });
    }
  }

  if (linesWithPhotos.length > 0) {
    if (y + 10 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Foto's", margin, y);
    y += 6;

    const thumbWidth = 40; // mm
    const gap = 4;
    const cols = Math.max(1, Math.floor((pageWidth - margin * 2 + gap) / (thumbWidth + gap)));

    for (const { line, photos } of linesWithPhotos) {
      if (y + 10 > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const label = lineLabel(line);
      const labelLines = doc.splitTextToSize(label, pageWidth - margin * 2);
      doc.text(labelLines, margin, y);
      y += labelLines.length * 4 + 2;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');

      let col = 0;
      let rowTop = y;
      let rowMaxBottom = y;
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const dataUrl = await blobToDataUrl(photo.thumbnailBlob);
        const dims = await getImageDimensions(dataUrl);
        const aspect = dims.height / dims.width || 1;
        const w = thumbWidth;
        const h = Math.min(thumbWidth * aspect, 55); // cap height to stay compact

        if (rowTop + h + 6 > pageHeight - margin) {
          doc.addPage();
          rowTop = margin;
          col = 0;
          rowMaxBottom = rowTop;
        }

        const x = margin + col * (thumbWidth + gap);
        doc.addImage(dataUrl, 'JPEG', x, rowTop, w, h);

        doc.setTextColor(120);
        const caption = `${i + 1}. ${photo.createdAt.slice(0, 10)}`;
        doc.text(caption, x, rowTop + h + 3.5);
        doc.setTextColor(0);

        rowMaxBottom = Math.max(rowMaxBottom, rowTop + h + 5);
        col++;
        if (col >= cols) {
          col = 0;
          rowTop = rowMaxBottom + 2;
          rowMaxBottom = rowTop;
        }
      }
      y = rowMaxBottom + 4;
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    'Gemaakt met Property Utility Mapper · kaart © OpenStreetMap bijdragers',
    margin,
    pageHeight - 5,
  );

  doc.save(exportFilename(formatDisplayAddress(property), 'pdf'));
}
