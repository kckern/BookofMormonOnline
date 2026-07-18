import sharp from 'sharp';
import type { Fragment } from './types.js';

export interface NotchFill {
  tl?: { w: number; h: number };   // exterior top-left notch (first verse), or undefined
  br?: { w: number; h: number };   // exterior bottom-right notch (last verse), or undefined
  paper: string;                    // fill color, e.g. sampled margin or '#faf7f0'
}

/** Crop one fragment's bbox from the scan and paper-fill the exterior notches. */
export async function renderFragmentCrop(scan: Buffer, frag: Fragment, notch: NotchFill): Promise<Buffer> {
  const base = sharp(scan).extract({ left: frag.x, top: frag.y, width: frag.w, height: frag.h });
  const overlays: sharp.OverlayOptions[] = [];
  if (notch.tl && notch.tl.w > 0 && notch.tl.h > 0) {
    overlays.push({
      input: { create: { width: notch.tl.w, height: notch.tl.h, channels: 3, background: notch.paper } },
      top: 0, left: 0,
    });
  }
  if (notch.br && notch.br.w > 0 && notch.br.h > 0) {
    overlays.push({
      input: { create: { width: notch.br.w, height: notch.br.h, channels: 3, background: notch.paper } },
      top: frag.h - notch.br.h, left: frag.w - notch.br.w,
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
  const overlays = await Promise.all(rects.map(async (r) => ({
    input: await sharp(scan).extract({ left: r.x, top: r.y, width: r.w, height: r.h }).png().toBuffer(),
    top: r.y, left: r.x,
  })));
  return sharp(dimmed).composite(overlays).jpeg().toBuffer();
}

async function dims(buf: Buffer) { const m = await sharp(buf).metadata(); return { w: m.width!, h: m.height! }; }

/** Crop mode: stack fragment images top→bottom, left-aligned, on paper bg. */
export async function stitchVertical(images: Buffer[], paper: string): Promise<Buffer> {
  const ds = await Promise.all(images.map(dims));
  const width = Math.max(...ds.map((d) => d.w));
  const height = ds.reduce((s, d) => s + d.h, 0);
  let top = 0;
  const layers = images.map((input, i) => { const o = { input, top, left: 0 }; top += ds[i]!.h; return o; });
  return sharp({ create: { width, height, channels: 3, background: paper } }).composite(layers).jpeg().toBuffer();
}

/** Page mode: place page images side-by-side with a gutter, top-aligned. */
export async function stitchHorizontal(images: Buffer[], gutter: number, paper: string): Promise<Buffer> {
  const ds = await Promise.all(images.map(dims));
  const width = ds.reduce((s, d) => s + d.w, 0) + gutter * (images.length - 1);
  const height = Math.max(...ds.map((d) => d.h));
  let left = 0;
  const layers = images.map((input, i) => { const o = { input, top: 0, left }; left += ds[i]!.w + gutter; return o; });
  return sharp({ create: { width, height, channels: 3, background: paper } }).composite(layers).jpeg().toBuffer();
}
