import sharp from 'sharp';

/**
 * Crop validation for showcase surfaces (the Home faxVerse tile).
 *
 * The box geometry in bom_xtras_fax_index is not certified (see
 * docs/audits/2026-07-27-fax-geometry-remediation-incident-report.md): some
 * editions' boxes are narrower than the printed column (1907s cuts words at
 * the right), some pages drift onto the wrong scan (the box frames another
 * verse whose words run out of it), and a few boxes are degenerate (one word,
 * or bare paper). A tile that promises "this verse, in these editions" must
 * not feature such a crop, so before an edition is offered its crop is
 * checked against the scan itself:
 *
 *  - clipped: a word is cut at a vertical edge — on many rows, ink sits just
 *    inside the edge AND just outside it (a stroke crossing the cut). A clean
 *    edge has margin or gutter outside it. Columns holding a dark run taller
 *    than any glyph (a column rule, the scanner's black surround) are not text.
 *  - blank: next to no ink inside the box.
 *  - size outlier: the box's area per character of verse text is far off the
 *    same page's other boxes (a one-word box for a long verse).
 *
 * This cannot catch every mislabelled box (a wrong-page box that happens to
 * frame whole lines passes); it catches the cut-word and degenerate crops the
 * reviewers saw, cheaply, in production (sharp only — no OCR).
 */

/** Share of rows with a stroke crossing an edge above which it is clipped.
 * Calibrated on 16 verses x 30 editions: clean edges sit at 0-0.06; cut
 * words at 0.1-0.6. */
export const CLIP_ROW_SHARE = 0.1;
/** Share of dark pixels inside the box below which the crop is blank paper. */
export const MIN_INK = 0.01;

export interface EdgeInk { left: number; right: number; ink: number; }
export type CropVerdict = 'ok' | 'clipped' | 'blank';

/** Luminance threshold below which a pixel is ink, relative to the paper. */
const INK_REL = 0.55;
/** A column with an unbroken dark run taller than this share of the page
 * width (~1.5 text lines) is a column rule or the scan's surround. */
const RULE_RUN = 0.035;

const percentile = (vals: number[], p: number): number => {
  const hist = new Uint32Array(256);
  for (const v of vals) hist[v]!++;
  const target = vals.length * p;
  let acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]!; if (acc >= target) return i; }
  return 255;
};

/**
 * Edge-crossing shares and inside ink for one fragment rect, in the scan's own
 * pixel space (already scaled from pageScale).
 */
export async function fragmentEdgeInk(scan: Buffer, frag: { x: number; y: number; w: number; h: number }): Promise<EdgeInk> {
  const { data, info } = await sharp(scan).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const y0 = Math.max(0, Math.round(frag.y)), y1 = Math.min(H, Math.round(frag.y + frag.h));
  const x0 = Math.max(0, Math.round(frag.x)), x1 = Math.min(W, Math.round(frag.x + frag.w));
  if (y1 - y0 < 2 || x1 - x0 < 2) return { left: 0, right: 0, ink: 0 };
  const lum = (x: number, y: number) => data[(y * W + x) * ch]!;

  // paper = a bright percentile of the page around and inside the box
  const sample: number[] = [];
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 3) sample.push(lum(x, y));
  const ink = percentile(sample, 0.9) * INK_REL;
  const dark = (x: number, y: number) => lum(x, y) < ink;

  let inkPx = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (dark(x, y)) inkPx++;

  const maxRun = Math.max(4, Math.round(W * RULE_RUN));
  const notRule = (x: number): boolean => {
    let run = 0;
    for (let y = y0; y < y1; y++) {
      run = dark(x, y) ? run + 1 : 0;
      if (run > maxRun) return false;
    }
    return true;
  };
  const gap = Math.max(1, Math.round(W * 0.0009));
  const band = Math.max(2, Math.round(W * 0.006));
  const inside = Math.max(1, Math.round(W * 0.002));
  const crossing = (edge: number, dir: 1 | -1): number => {
    const outCols: number[] = [];
    for (let i = 0; i < band; i++) {
      const x = edge + dir * (gap + i);
      if (x >= 0 && x < W && notRule(x)) outCols.push(x);
    }
    const inCols: number[] = [];
    for (let i = 0; i < inside; i++) {
      const x = edge - dir * i;
      if (x >= 0 && x < W && notRule(x)) inCols.push(x);
    }
    if (!outCols.length || !inCols.length) return 0;
    let hit = 0;
    for (let y = y0; y < y1; y++) {
      if (outCols.some((x) => dark(x, y)) && inCols.some((x) => dark(x, y))) hit++;
    }
    return hit / (y1 - y0);
  };
  return {
    left: crossing(x0, -1),
    right: crossing(x1 - 1, 1),
    ink: inkPx / ((y1 - y0) * (x1 - x0)),
  };
}

export function cropVerdict(e: EdgeInk): CropVerdict {
  if (e.ink < MIN_INK) return 'blank';
  if (e.left > CLIP_ROW_SHARE || e.right > CLIP_ROW_SHARE) return 'clipped';
  return 'ok';
}

/**
 * The first `max` editions, in order, whose crop validates. Validates in
 * small parallel batches and stops as soon as enough have passed; a
 * validator that throws counts as a failure.
 */
export async function pickShowcaseEditions<T>(
  ordered: T[],
  ok: (item: T) => Promise<boolean>,
  max: number,
  batch = 4,
): Promise<T[]> {
  const out: T[] = [];
  let i = 0;
  while (i < ordered.length && out.length < max) {
    // only as many as could still be needed
    const slice = ordered.slice(i, i + Math.min(batch, max - out.length));
    i += slice.length;
    const results = await Promise.all(slice.map((item) => ok(item).catch(() => false)));
    slice.forEach((item, j) => { if (results[j] && out.length < max) out.push(item); });
  }
  return out;
}
