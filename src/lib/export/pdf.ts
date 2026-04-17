import { jsPDF } from 'jspdf';
import type { Property, UtilityLine } from '../../types';
import { UTILITY_META } from '../utilityColors';
import { formatDisplayAddress } from '../address';
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

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    'Gemaakt met Property Utility Mapper · kaart © OpenStreetMap bijdragers',
    margin,
    pageHeight - 5,
  );

  doc.save(exportFilename(formatDisplayAddress(property), 'pdf'));
}
