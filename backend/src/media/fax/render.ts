import sharp from 'sharp';
import type { Fragment } from './types.js';
import { DIM_OPACITY, JPEG_QUALITY } from './constants.js';
import { assertScanWidth } from './scan.js';

export interface NotchFill {
  tl?: { w: number; h: number };   // exterior top-left notch (first verse), or undefined
  br?: { w: number; h: number };   // exterior bottom-right notch (last verse), or undefined
  paper: string;                    // fill color, e.g. sampled margin or '#faf7f0'
}

/** Crop one fragment's bbox from the scan and paper-fill the exterior notches. */
export async function renderFragmentCrop(scan: Buffer, frag: Fragment, notch: NotchFill): Promise<Buffer> {
  const meta = await sharp(scan).metadata();
  const cw = Math.min(frag.w, (meta.width ?? frag.x + frag.w) - frag.x);
  const ch = Math.min(frag.h, (meta.height ?? frag.y + frag.h) - frag.y);
  const base = sharp(scan).extract({ left: frag.x, top: frag.y, width: cw, height: ch });
  const overlays: sharp.OverlayOptions[] = [];
  if (notch.tl && notch.tl.w > 0 && notch.tl.h > 0) {
    overlays.push({
      input: { create: { width: Math.min(notch.tl.w, cw), height: Math.min(notch.tl.h, ch), channels: 3, background: notch.paper } },
      top: 0, left: 0,
    });
  }
  if (notch.br && notch.br.w > 0 && notch.br.h > 0) {
    const bw = Math.min(notch.br.w, cw), bh = Math.min(notch.br.h, ch);
    overlays.push({
      input: { create: { width: bw, height: bh, channels: 3, background: notch.paper } },
      top: ch - bh, left: cw - bw,
    });
  }
  return (overlays.length ? base.composite(overlays) : base).png().toBuffer();
}

export interface Rect { x: number; y: number; w: number; h: number; }

/** Full page with a dark overlay everywhere EXCEPT the highlight rects.
 * Approach: uniformly darken the whole page, then composite the ORIGINAL
 * (bright) highlight regions back on top. Unambiguous — no blend modes. */
export async function renderPageDimmed(
  scan: Buffer, width: number, height: number, rects: Rect[], opacity: number,
): Promise<Buffer> {
  const darkLayer: sharp.OverlayOptions = {
    input: { create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: opacity } } },
    top: 0, left: 0,
  };
  const dimmed = await sharp(scan).composite([darkLayer]).png().toBuffer();
  const overlays = (await Promise.all(rects.map(async (r) => {
    const w = Math.min(r.w, width - r.x);
    const h = Math.min(r.h, height - r.y);
    if (r.x < 0 || r.y < 0 || w <= 0 || h <= 0) return null;
    return {
      input: await sharp(scan).extract({ left: r.x, top: r.y, width: w, height: h }).png().toBuffer(),
      top: r.y, left: r.x,
    } as sharp.OverlayOptions;
  }))).filter((o): o is sharp.OverlayOptions => o !== null);
  return sharp(dimmed).composite(overlays).png().toBuffer();
}

async function dims(buf: Buffer) { const m = await sharp(buf).metadata(); return { w: m.width!, h: m.height! }; }

/** Crop mode: stack fragment images top→bottom, left-aligned, on paper bg. */
export async function stitchVertical(images: Buffer[], paper: string): Promise<Buffer> {
  const ds = await Promise.all(images.map(dims));
  const width = Math.max(...ds.map((d) => d.w));
  const height = ds.reduce((s, d) => s + d.h, 0);
  let top = 0;
  const layers = images.map((input, i) => { const o = { input, top, left: 0 }; top += ds[i]!.h; return o; });
  return sharp({ create: { width, height, channels: 3, background: paper } }).composite(layers).png().toBuffer();
}

/** Page mode: place page images side-by-side with a gutter, top-aligned. */
export async function stitchHorizontal(images: Buffer[], gutter: number, paper: string): Promise<Buffer> {
  const ds = await Promise.all(images.map(dims));
  const width = ds.reduce((s, d) => s + d.w, 0) + gutter * (images.length - 1);
  const height = Math.max(...ds.map((d) => d.h));
  let left = 0;
  const layers = images.map((input, i) => { const o = { input, top: 0, left }; left += ds[i]!.w + gutter; return o; });
  return sharp({ create: { width, height, channels: 3, background: paper } }).composite(layers).png().toBuffer();
}

export interface RenderArgs {
  mode: 'page' | 'crop';
  ext: 'jpg' | 'webp';
  width: number | 'full';
  fragments: Fragment[];
  provider: (page: number) => Promise<Buffer>;   // page -> scan buffer
  paper: string;
  gutter?: number;
}

/** Scale a fragment's geometry (and notch insets) by k for extraction when the
 * actual scan width differs from the stored pageWidth. */
function scaleFragment(f: Fragment, k: number): Fragment {
  if (k === 1) return f;
  const s = (n: number) => Math.round(n * k);
  return {
    ...f, x: s(f.x), y: s(f.y), w: s(f.w), h: s(f.h),
    boxes: f.boxes.map((b) => ({
      ...b, x: s(b.x), y: s(b.y), w: s(b.w), h: s(b.h),
      tlw: s(b.tlw), tlh: s(b.tlh), brw: s(b.brw), brh: s(b.brh),
    })),
  };
}

const encode = (img: sharp.Sharp, ext: 'jpg' | 'webp') =>
  (ext === 'webp' ? img.webp({ quality: JPEG_QUALITY }) : img.jpeg({ quality: JPEG_QUALITY })).toBuffer();

const downscale = async (buf: Buffer, width: number | 'full'): Promise<Buffer> => {
  if (width === 'full') return buf;
  const m = await sharp(buf).metadata();
  if ((m.width ?? 0) <= width) return buf;              // never upscale
  return sharp(buf).resize({ width }).toBuffer();
};

export async function renderImage(args: RenderArgs): Promise<Buffer> {
  const { mode, ext, width, fragments, provider, paper, gutter = 12 } = args;
  if (fragments.length === 0) throw new Error('no fragments to render');

  if (mode === 'crop') {
    // one crop per fragment, downscaled, stacked vertically.
    // Exterior notches only: first fragment's first box carries the TL notch;
    // last fragment's last box carries the BR notch. Interior notches stay lit.
    const crops: Buffer[] = [];
    for (let i = 0; i < fragments.length; i++) {
      const f = fragments[i]!;
      const scan = await provider(f.page);
      const meta = await sharp(scan).metadata();
      const f2 = scaleFragment(f, assertScanWidth(meta.width!, f.pageWidth));
      const notch: NotchFill = { paper };
      if (i === 0 && f2.boxes[0]) notch.tl = { w: f2.boxes[0].tlw, h: f2.boxes[0].tlh };
      const lastBox = f2.boxes[f2.boxes.length - 1];
      if (i === fragments.length - 1 && lastBox) notch.br = { w: lastBox.brw, h: lastBox.brh };
      const raw = await renderFragmentCrop(scan, f2, notch);
      crops.push(await downscale(raw, width));
    }
    return encode(sharp(await stitchVertical(crops, paper)), ext);
  }

  // page mode: group fragments by page, dim each page, downscale, spread horizontally
  const pages = [...new Set(fragments.map((f) => f.page))];
  const pageBufs: Buffer[] = [];
  for (const page of pages) {
    const scan = await provider(page);
    const meta = await sharp(scan).metadata();
    const pageFrags = fragments.filter((f) => f.page === page);
    const k = assertScanWidth(meta.width!, pageFrags[0]!.pageWidth);
    const rects = pageFrags.map((f) => scaleFragment(f, k)).map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }));
    const dimmed = await renderPageDimmed(scan, meta.width!, meta.height!, rects, DIM_OPACITY);
    pageBufs.push(await downscale(dimmed, width));
  }
  const spread = pageBufs.length === 1 ? pageBufs[0]! : await stitchHorizontal(pageBufs, gutter, paper);
  return encode(sharp(spread), ext);
}
