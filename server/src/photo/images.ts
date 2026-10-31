import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { MAX_IMAGE_BYTES, type AssessmentInput, type PreparedPhoto } from './schema.js';

export class PhotoInputError extends Error {}

export async function preparePhotos(photos: AssessmentInput['photos']): Promise<PreparedPhoto[]> {
  const seen = new Set<string>();
  const prepared: PreparedPhoto[] = [];
  for (const photo of photos) {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(photo.base64)) {
      throw new PhotoInputError(`${photo.angle}: invalid image encoding.`);
    }
    const buffer = Buffer.from(photo.base64, 'base64');
    if (buffer.length > MAX_IMAGE_BYTES) throw new PhotoInputError('Each photo must be under 3 MB.');
    try {
      const image = sharp(buffer, { limitInputPixels: 24_000_000, animated: false });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1) {
        throw new PhotoInputError('Use a still JPEG, PNG, or WebP image.');
      }
      if (Math.min(metadata.width ?? 0, metadata.height ?? 0) < 256) {
        throw new PhotoInputError(`${photo.angle}: the photo is too small. Use at least 256 pixels on each side.`);
      }
      // Rotate using EXIF, then strip metadata by re-encoding. Never write uploads to disk.
      const normalized = await image.rotate().resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      const hash = createHash('sha256').update(normalized).digest('hex');
      if (seen.has(hash)) throw new PhotoInputError('Use three different photos: front, side, and back.');
      seen.add(hash);
      prepared.push({ angle: photo.angle, base64: normalized.toString('base64') });
    } catch (error) {
      if (error instanceof PhotoInputError) throw error;
      throw new PhotoInputError(`${photo.angle}: this image could not be read. Choose a JPEG, PNG, or WebP photo.`);
    }
  }
  return prepared;
}
