import { toBlob, toPng } from 'html-to-image';
import type { Property } from '../../types';
import { formatDisplayAddress } from '../address';
import { exportFilename, triggerDownload } from './download';

const PNG_OPTIONS = {
  pixelRatio: 2,
  backgroundColor: '#ffffff',
  cacheBust: true,
} as const;

export async function renderMapBlob(mapEl: HTMLElement): Promise<Blob> {
  const blob = await toBlob(mapEl, PNG_OPTIONS);
  if (!blob) throw new Error('Failed to render map to PNG.');
  return blob;
}

export async function renderMapDataUrl(mapEl: HTMLElement): Promise<string> {
  return toPng(mapEl, PNG_OPTIONS);
}

export async function exportPng(mapEl: HTMLElement, property: Property): Promise<void> {
  const blob = await renderMapBlob(mapEl);
  triggerDownload(exportFilename(formatDisplayAddress(property), 'png'), blob);
}
