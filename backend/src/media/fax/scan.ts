import { MEDIA_BASE, pageKey } from './constants.js';

/** Fetch a source page scan as a Buffer. (HTTP for now; S3 SDK read is an
 * optional later optimization — the media host is S3-backed either way.) */
export async function fetchScan(version: string, page: number, format = 'jpg'): Promise<Buffer> {
  const url = `${MEDIA_BASE}/${pageKey(version, page, format)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`scan fetch failed ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Coordinates are in stored-pageWidth space. If the actual scan differs,
 * return the factor to multiply every coordinate by. */
export function assertScanWidth(actualWidth: number, storedPageWidth: number): number {
  if (actualWidth === storedPageWidth) return 1;
  console.warn(`[fax] scan width mismatch: actual=${actualWidth} stored=${storedPageWidth}`);
  return actualWidth / storedPageWidth;
}
