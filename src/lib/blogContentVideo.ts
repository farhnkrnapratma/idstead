import {contentKey} from './blogContent';

export const CONTENT_VIDEO_LIMIT = 50_000_000;

export function sniffVideoFormat(
  bytes: Uint8Array
): {ext: 'mp4' | 'webm'; contentType: string} | null {
  if (
    bytes.length >= 8
    && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp'
  )
    return {ext: 'mp4', contentType: 'video/mp4'};
  if (
    bytes[0] === 0x1a
    && bytes[1] === 0x45
    && bytes[2] === 0xdf
    && bytes[3] === 0xa3
  )
    return {ext: 'webm', contentType: 'video/webm'};
  return null;
}

export function contentVideoKey(hash: string, ext: string) {
  return contentKey(hash, ext);
}
