// Pure slicing: sections → contiguous chunks of WHOLE sections (spec D9).
// 'even' is a greedy balanced partition weighted by block count, guaranteeing
// every part non-empty; parts clamp to section count (spec generator §2).
import type { GenWarning, ScopedSection, SegmentationConfig } from './types.js';

export function sliceSections(
  sections: ScopedSection[],
  seg: SegmentationConfig,
): { chunks: ScopedSection[][]; warnings: GenWarning[] } {
  const warnings: GenWarning[] = [];
  if (!sections.length) return { chunks: [], warnings: [{ code: 'EMPTY_SCOPE' }] };

  if (seg.type === 'section') return { chunks: sections.map((s) => [s]), warnings };

  if (seg.type === 'page') {
    const chunks: ScopedSection[][] = [];
    for (const s of sections) {
      const last = chunks[chunks.length - 1];
      if (last && last[0]!.pageGuid === s.pageGuid) last.push(s);
      else chunks.push([s]);
    }
    return { chunks, warnings };
  }

  let parts = seg.parts;
  if (parts > sections.length) {
    warnings.push({ code: 'PARTS_CLAMPED', detail: sections.length });
    parts = sections.length;
  }
  const chunks: ScopedSection[][] = [];
  let idx = 0;
  let blocksLeft = sections.reduce((a, s) => a + s.blocks, 0);
  for (let p = 0; p < parts; p++) {
    const partsLeft = parts - p;
    const target = blocksLeft / partsLeft;
    const chunk: ScopedSection[] = [sections[idx]!];
    let size = sections[idx]!.blocks;
    idx++;
    // Greedy: absorb the next section while it doesn't overshoot the target
    // (ties resolved by absorbing — front chunks may run one section long).
    while (
      idx < sections.length &&
      sections.length - idx > partsLeft - 1 &&
      Math.abs(size + sections[idx]!.blocks - target) <= Math.abs(size - target)
    ) {
      size += sections[idx]!.blocks;
      chunk.push(sections[idx]!);
      idx++;
    }
    blocksLeft -= size;
    chunks.push(chunk);
  }
  return { chunks, warnings };
}
