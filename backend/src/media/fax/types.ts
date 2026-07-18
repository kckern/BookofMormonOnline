// backend/src/media/fax/types.ts
export type RenderMode = 'page' | 'crop';
export type OutputExt = 'jpg' | 'webp';

/** A verse box as stored, already sanitized (non-negative, clipped, non-zero). */
export interface FaxBox {
  verseId: number;
  page: number;        // integer (zero-fill happens at the S3 key boundary)
  pageWidth: number;
  x: number;
  y: number;
  w: number;
  h: number;
  tlw: number; tlh: number;   // top-left notch (verse starts mid-line)
  brw: number; brh: number;   // bottom-right notch (verse ends mid-line)
}

/** A maximal merged vertical run within one (page, column), in reading order. */
export interface Fragment {
  page: number;
  pageWidth: number;
  x: number; y: number; w: number; h: number;   // union bbox of the run
  boxes: FaxBox[];                                // members, verse-id ascending
}

export interface RenderInput {
  version: string;
  verseIds: number[];   // sorted ascending, de-duplicated
  mode: RenderMode;
  width: number | 'full';
  ext: OutputExt;
}
