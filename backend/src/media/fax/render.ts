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
