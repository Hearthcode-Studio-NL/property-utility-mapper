export interface ResizeDims {
  width: number;
  height: number;
}

// Pure function — exported for unit testing the scaling math without
// touching Canvas / image decoding (which jsdom can't drive reliably).
export function computeResizeTarget(
  sourceWidth: number,
  sourceHeight: number,
  maxLongestEdge: number,
): ResizeDims {
  const longest = Math.max(sourceWidth, sourceHeight);
  if (longest <= maxLongestEdge) {
    return { width: sourceWidth, height: sourceHeight };
  }
  const scale = maxLongestEdge / longest;
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

// `createImageBitmap(file, { imageOrientation: 'from-image' })` auto-applies
// EXIF rotation so portrait phone photos don't render sideways. Supported
// in current Chrome, Firefox, Safari.
export async function resizeImageToBlob(
  file: File,
  maxLongestEdge: number,
  jpegQuality: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = computeResizeTarget(
      bitmap.width,
      bitmap.height,
      maxLongestEdge,
    );
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error('Failed to encode image as JPEG.'));
          else resolve(blob);
        },
        'image/jpeg',
        jpegQuality,
      );
    });
  } finally {
    bitmap.close();
  }
}

export const FULL_MAX_EDGE = 1920;
export const FULL_QUALITY = 0.85;
export const THUMBNAIL_MAX_EDGE = 256;
export const THUMBNAIL_QUALITY = 0.7;

export function resizeFull(file: File): Promise<Blob> {
  return resizeImageToBlob(file, FULL_MAX_EDGE, FULL_QUALITY);
}

export function generateThumbnail(file: File): Promise<Blob> {
  return resizeImageToBlob(file, THUMBNAIL_MAX_EDGE, THUMBNAIL_QUALITY);
}
