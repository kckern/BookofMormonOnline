#!/usr/bin/env npx tsx
/**
 * Pixel-only edge QA for locally rendered line-ownership proposals.
 *
 * No OCR or model calls. The report distinguishes review thresholds from
 * severe edge contact; geometry/content acceptance remains in the ownership
 * report that produced these images.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

type Proposal = {
  version: string;
  selector: string;
  verseId: number;
  outcome: string;
  image?: string;
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const reportFile = path.resolve(flag(
  'report',
  '../docs/audits/fax-geometry/2026-07-26-line-ownership-final-v2/' +
    'line-ownership-report.json',
));
const outputFile = path.resolve(flag(
  'out',
  '../docs/audits/fax-geometry/2026-07-26-line-ownership-final-v2/' +
    'proposal-edge-qa.json',
));
const reportRoot = path.dirname(reportFile);
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8')) as {
  proposals: Proposal[];
};
const accepted = report.proposals.filter((proposal) =>
  proposal.outcome.startsWith('ACCEPTED_'));

const results = [];
for (const proposal of accepted) {
  if (!proposal.image) throw new Error(`missing image for ${proposal.version}/${proposal.selector}`);
  const imageFile = path.resolve(reportRoot, proposal.image);
  const { data, info } = await sharp(imageFile)
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const depth = Math.min(3, Math.floor(Math.min(info.width, info.height) / 2));
  const isInk = (x: number, y: number): boolean =>
    data[y * info.width + x]! < 160;
  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (!isInk(x, y)) continue;
      if (y < depth) top++;
      if (y >= info.height - depth) bottom++;
      if (x < depth) left++;
      if (x >= info.width - depth) right++;
    }
  }
  const edge = {
    top: top / Math.max(1, info.width * depth),
    bottom: bottom / Math.max(1, info.width * depth),
    left: left / Math.max(1, info.height * depth),
    right: right / Math.max(1, info.height * depth),
  };
  const review: string[] = [];
  const severe: string[] = [];
  if (edge.top > 0.10) review.push('top-edge-ink-review');
  if (edge.bottom > 0.35) review.push('bottom-edge-ink-review');
  if (edge.left > 0.20) review.push('left-edge-ink-review');
  if (edge.right > 0.30) review.push('right-edge-ink-review');
  if (edge.top > 0.30) severe.push('severe-top-edge-ink');
  if (edge.bottom > 0.60) severe.push('severe-bottom-edge-ink');
  if (edge.left > 0.45) severe.push('severe-left-edge-ink');
  if (edge.right > 0.55) severe.push('severe-right-edge-ink');
  results.push({
    version: proposal.version,
    selector: proposal.selector,
    verseId: proposal.verseId,
    image: proposal.image,
    width: info.width,
    height: info.height,
    edge,
    review,
    severe,
  });
}

const summary = {
  accepted: accepted.length,
  review: results.filter((result) => result.review.length).length,
  severe: results.filter((result) => result.severe.length).length,
};
fs.writeFileSync(outputFile, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: 'pixel-only 3px edge ink fractions; grayscale threshold 160',
  thresholds: {
    review: { top: 0.10, bottom: 0.35, left: 0.20, right: 0.30 },
    severe: { top: 0.30, bottom: 0.60, left: 0.45, right: 0.55 },
  },
  summary,
  results,
}, null, 2)}\n`);
console.log(JSON.stringify({ outputFile, ...summary }, null, 2));
