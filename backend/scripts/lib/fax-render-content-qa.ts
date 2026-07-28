export type BoundarySide = 'start' | 'end';

export type BoundaryAlignment = {
  boundaryRun: number;
  boundaryOffset: number | null;
  bestRun: number;
  bestOffset: number | null;
  boundarySubstitution: boolean;
};

export type ContentAlignment = {
  canonicalTokens: string[];
  ocrTokens: string[];
  leading: BoundaryAlignment;
  trailing: BoundaryAlignment;
  longestRun: number;
  sequence: SequenceCoverage;
};

export type SequenceCoverage = {
  matchedCanonicalTokens: number;
  matchedOcrTokens: number;
  canonicalCoverage: number;
  ocrPrecision: number;
  leadingCanonicalGap: number;
  trailingCanonicalGap: number;
  largestInteriorCanonicalGap: number;
};

export type FocusedBoundaryRecovery = {
  accepted: boolean;
  side: BoundarySide;
  boundaryRun: number;
  exactBoundaryToken: boolean;
  reason: string;
};

export type RenderContentQaStatus = 'pass' | 'warning' | 'failure';

const hardContentFlags = new Set([
  'missing-box-row',
  'suspiciously-small-response',
  'suspicious-dimensions',
  'width-exceeds-request',
  'nearly-blank',
  'mostly-dark',
  // Unusable OCR does not prove geometry. Treating it as review-only allowed
  // visibly partial registration crops to survive exhaustive QA.
  'ocr-content-unreliable',
  'canonical-leading-token-missing',
  'canonical-trailing-token-missing',
  'preceding-neighbor-text-leak',
  'following-neighbor-text-leak',
  'preceding-content-before-verse',
  'following-content-after-verse',
  'internal-canonical-span-missing',
  'request-decode-or-ocr-error',
]);

const informationalContentFlags = new Set([
  'leading-token-recovered-by-focused-ocr',
  'trailing-token-recovered-by-focused-ocr',
]);

/**
 * Convert deterministic render/OCR evidence into a gate status.
 *
 * Known unavailable scans are adjudicated separately by the caller and may
 * become `unavailable`; every ordinary incoherent crop remains a hard failure.
 */
export function classifyRenderedContentFlags(
  flags: string[],
): RenderContentQaStatus {
  if (flags.some((flag) => hardContentFlags.has(flag))) return 'failure';
  if (flags.some((flag) => !informationalContentFlags.has(flag))) {
    return 'warning';
  }
  return 'pass';
}

const WORD_PATTERN = /[A-Za-zſﬀﬁﬂﬃﬄ]+/g;
const LETTER = 'A-Za-zſﬀﬁﬂﬃﬄ';

export function normalizeWord(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ſ]/g, 's')
    .replace(/[ﬀﬁﬂﬃﬄ]/g, (ligature) => ({
      'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl',
    })[ligature] ?? ligature)
    .replace(/[^a-z]/g, '');
}

export function normalizeOcrText(value: string): string {
  // Tesseract preserves a line-break hyphen as "forti- fications". It is a
  // single printed word, not evidence that the rendered suffix is incomplete.
  return value.replace(
    new RegExp(`([${LETTER}])-\\s+([${LETTER}])`, 'g'),
    '$1$2',
  );
}

export function tokenizeWords(value: string): string[] {
  return [...normalizeOcrText(value).matchAll(WORD_PATTERN)]
    .map((match) => normalizeWord(match[0]))
    .filter(Boolean);
}

/**
 * Validate a canonical boundary token found by OCR on a focused edge strip.
 *
 * Tesseract commonly ignores an isolated one-word final line in a full block
 * even when the word is visibly complete. A focused strip can recover it, but
 * only when the full crop already covers nearly all canonical text, the
 * physical edge is clear, and the strip contains the exact exterior token.
 */
export function assessFocusedBoundaryRecovery(args: {
  side: BoundarySide;
  fullAlignment: ContentAlignment;
  stripAlignment: ContentAlignment;
  edgeInk: number;
}): FocusedBoundaryRecovery {
  const { side, fullAlignment, stripAlignment, edgeInk } = args;
  const boundary = side === 'start'
    ? stripAlignment.leading
    : stripAlignment.trailing;
  const canonicalToken = side === 'start'
    ? fullAlignment.canonicalTokens[0]
    : fullAlignment.canonicalTokens.at(-1);
  const stripBoundaryToken = side === 'start'
    ? stripAlignment.ocrTokens[boundary.boundaryOffset ?? 0]
    : stripAlignment.ocrTokens[
      stripAlignment.ocrTokens.length - 1 - (boundary.boundaryOffset ?? 0)
    ];
  const exactBoundaryToken = Boolean(
    canonicalToken && stripBoundaryToken === canonicalToken,
  );
  const canonicalGap = side === 'start'
    ? fullAlignment.sequence.leadingCanonicalGap
    : fullAlignment.sequence.trailingCanonicalGap;
  const boundaryGap = side === 'start'
    ? fullAlignment.sequence.leadingCanonicalGap
    : fullAlignment.sequence.trailingCanonicalGap;
  const accepted =
    boundary.boundaryRun >= 1 &&
    exactBoundaryToken &&
    fullAlignment.sequence.canonicalCoverage >= 0.90 &&
    canonicalGap <= 2 &&
    boundaryGap <= 2 &&
    edgeInk < 0.10;
  return {
    accepted,
    side,
    boundaryRun: boundary.boundaryRun,
    exactBoundaryToken,
    reason: accepted
      ? 'focused edge OCR recovered an exact isolated canonical token'
      : `focused recovery rejected: run=${boundary.boundaryRun}, ` +
        `exact=${exactBoundaryToken}, coverage=` +
        `${fullAlignment.sequence.canonicalCoverage.toFixed(3)}, ` +
        `gap=${canonicalGap}, boundaryGap=${boundaryGap}, ` +
        `edgeInk=${edgeInk.toFixed(3)}`,
  };
}

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1 || Math.min(left.length, right.length) < 3) {
    return false;
  }
  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex++;
      rightIndex++;
      continue;
    }
    if (++edits > 1) return false;
    if (left.length > right.length) leftIndex++;
    else if (right.length > left.length) rightIndex++;
    else {
      leftIndex++;
      rightIndex++;
    }
  }
  return edits + Number(leftIndex < left.length || rightIndex < right.length) <= 1;
}

export function sameWord(left: string, right: string): boolean {
  return left === right || editDistanceAtMostOne(left, right);
}

function tokenFromBoundary(tokens: string[], offset: number, side: BoundarySide): string | null {
  const index = side === 'start' ? offset : tokens.length - 1 - offset;
  return index >= 0 && index < tokens.length ? tokens[index]! : null;
}

function compactSegment(
  tokens: string[],
  offset: number,
  count: number,
  side: BoundarySide,
): string | null {
  const start = side === 'start'
    ? offset
    : tokens.length - offset - count;
  const end = start + count;
  if (start < 0 || end > tokens.length) return null;
  return tokens.slice(start, end).join('');
}

/**
 * Count canonical tokens from a specified OCR/canonical boundary offset.
 *
 * Besides ordinary fuzzy token equality, allow up to three canonical tokens
 * collapsed into one OCR token ("was in them" -> "wasinthem") and up to three
 * OCR tokens split from one canonical token ("for ever" -> "forever").
 */
export function alignedRunAt(
  ocr: string[],
  canonical: string[],
  side: BoundarySide,
  initialOcrOffset: number,
): number {
  const memo = new Map<string, number>();
  const visit = (ocrOffset: number, canonicalOffset: number): number => {
    const key = `${ocrOffset}|${canonicalOffset}`;
    const cached = memo.get(key);
    if (cached != null) return cached;
    const ocrWord = tokenFromBoundary(ocr, ocrOffset, side);
    const canonicalWord = tokenFromBoundary(canonical, canonicalOffset, side);
    if (!ocrWord || !canonicalWord) return 0;

    let best = 0;
    if (sameWord(ocrWord, canonicalWord)) {
      best = Math.max(best, 1 + visit(ocrOffset + 1, canonicalOffset + 1));
    }
    for (let canonicalCount = 2; canonicalCount <= 3; canonicalCount++) {
      const compactCanonical = compactSegment(
        canonical,
        canonicalOffset,
        canonicalCount,
        side,
      );
      if (compactCanonical && sameWord(ocrWord, compactCanonical)) {
        best = Math.max(
          best,
          canonicalCount + visit(ocrOffset + 1, canonicalOffset + canonicalCount),
        );
      }
    }
    for (let ocrCount = 2; ocrCount <= 3; ocrCount++) {
      const compactOcr = compactSegment(ocr, ocrOffset, ocrCount, side);
      if (compactOcr && sameWord(compactOcr, canonicalWord)) {
        best = Math.max(
          best,
          1 + visit(ocrOffset + ocrCount, canonicalOffset + 1),
        );
      }
    }
    memo.set(key, best);
    return best;
  };
  return visit(initialOcrOffset, 0);
}

export function alignBoundary(
  ocr: string[],
  canonical: string[],
  side: BoundarySide,
  toleratedBoundaryNoise = 4,
): BoundaryAlignment {
  let boundaryRun = 0;
  let boundaryOffset: number | null = null;
  let bestRun = 0;
  let bestOffset: number | null = null;
  let boundarySubstitution = false;
  for (let offset = 0; offset < ocr.length; offset++) {
    const run = alignedRunAt(ocr, canonical, side, offset);
    if (run > bestRun) {
      bestRun = run;
      bestOffset = offset;
    }
    if (offset < toleratedBoundaryNoise && run > boundaryRun) {
      boundaryRun = run;
      boundaryOffset = offset;
    }
  }
  // A damaged scan can make exactly the exterior token unreadable while the
  // token is still visibly present. Treat that as an OCR substitution only
  // when token 2 onward aligns strongly. Do not forgive a truly omitted first
  // or last token: in that case the OCR boundary equals canonical token 2.
  if (boundaryRun === 0 && ocr.length >= 4 && canonical.length >= 4) {
    const ocrBoundary = tokenFromBoundary(ocr, 0, side)!;
    const canonicalNeighbor = tokenFromBoundary(canonical, 1, side)!;
    if (!sameWord(ocrBoundary, canonicalNeighbor)) {
      const remainderRun = side === 'start'
        ? alignedRunAt(ocr.slice(1), canonical.slice(1), side, 0)
        : alignedRunAt(ocr.slice(0, -1), canonical.slice(0, -1), side, 0);
      if (remainderRun >= 3) {
        boundaryRun = remainderRun + 1;
        boundaryOffset = 0;
        boundarySubstitution = true;
        bestRun = Math.max(bestRun, boundaryRun);
        if (bestRun === boundaryRun) bestOffset = 0;
      }
    }
  }
  return {
    boundaryRun,
    boundaryOffset,
    bestRun,
    bestOffset,
    boundarySubstitution,
  };
}

export function longestSharedRun(ocr: string[], canonical: string[]): number {
  const previous = new Array<number>(canonical.length + 1).fill(0);
  let best = 0;
  for (const ocrWord of ocr) {
    const current = new Array<number>(canonical.length + 1).fill(0);
    for (let index = 1; index <= canonical.length; index++) {
      if (sameWord(ocrWord, canonical[index - 1]!)) {
        current[index] = previous[index - 1]! + 1;
        best = Math.max(best, current[index]!);
      }
    }
    for (let index = 0; index < current.length; index++) previous[index] = current[index]!;
  }
  return best;
}

/**
 * Measure ordered whole-passage coverage with fuzzy word equality.
 *
 * Boundary runs alone cannot detect a missing middle fragment when a crop
 * contains the first and last lines. LCS coverage and the largest unmatched
 * interior canonical run make that omission measurable without image models.
 */
export function orderedSequenceCoverage(
  ocr: string[],
  canonical: string[],
): SequenceCoverage {
  const rows = ocr.length + 1;
  const columns = canonical.length + 1;
  const table = Array.from({ length: rows }, () => new Uint16Array(columns));
  for (let ocrIndex = 1; ocrIndex < rows; ocrIndex++) {
    for (let canonicalIndex = 1; canonicalIndex < columns; canonicalIndex++) {
      table[ocrIndex]![canonicalIndex] = sameWord(
        ocr[ocrIndex - 1]!,
        canonical[canonicalIndex - 1]!,
      )
        ? table[ocrIndex - 1]![canonicalIndex - 1]! + 1
        : Math.max(
          table[ocrIndex - 1]![canonicalIndex]!,
          table[ocrIndex]![canonicalIndex - 1]!,
        );
    }
  }

  const canonicalMatches: number[] = [];
  let ocrIndex = ocr.length;
  let canonicalIndex = canonical.length;
  while (ocrIndex > 0 && canonicalIndex > 0) {
    if (sameWord(ocr[ocrIndex - 1]!, canonical[canonicalIndex - 1]!) &&
        table[ocrIndex]![canonicalIndex] ===
          table[ocrIndex - 1]![canonicalIndex - 1]! + 1) {
      canonicalMatches.push(canonicalIndex - 1);
      ocrIndex--;
      canonicalIndex--;
    } else if (
      table[ocrIndex - 1]![canonicalIndex]! >=
      table[ocrIndex]![canonicalIndex - 1]!
    ) {
      ocrIndex--;
    } else {
      canonicalIndex--;
    }
  }
  canonicalMatches.reverse();

  const matched = canonicalMatches.length;
  const leadingCanonicalGap = matched ? canonicalMatches[0]! : canonical.length;
  const trailingCanonicalGap = matched
    ? canonical.length - 1 - canonicalMatches.at(-1)!
    : canonical.length;
  let largestInteriorCanonicalGap = 0;
  for (let index = 1; index < canonicalMatches.length; index++) {
    largestInteriorCanonicalGap = Math.max(
      largestInteriorCanonicalGap,
      canonicalMatches[index]! - canonicalMatches[index - 1]! - 1,
    );
  }

  return {
    matchedCanonicalTokens: matched,
    matchedOcrTokens: matched,
    canonicalCoverage: canonical.length ? matched / canonical.length : 0,
    ocrPrecision: ocr.length ? matched / ocr.length : 0,
    leadingCanonicalGap,
    trailingCanonicalGap,
    largestInteriorCanonicalGap,
  };
}

export function alignRenderedContent(ocrText: string, canonicalText: string): ContentAlignment {
  const ocrTokens = tokenizeWords(ocrText);
  const canonicalTokens = tokenizeWords(canonicalText);
  return {
    canonicalTokens,
    ocrTokens,
    leading: alignBoundary(ocrTokens, canonicalTokens, 'start'),
    trailing: alignBoundary(ocrTokens, canonicalTokens, 'end'),
    longestRun: longestSharedRun(ocrTokens, canonicalTokens),
    sequence: orderedSequenceCoverage(ocrTokens, canonicalTokens),
  };
}

/**
 * Rank alternate deterministic OCR layouts. Boundary agreement is weighted
 * more heavily than interior agreement because the QA question is whether the
 * crop owns its first and last words.
 */
export function scoreContentAlignment(alignment: ContentAlignment): number {
  return Math.min(12, alignment.leading.boundaryRun) * 5 +
    Math.min(12, alignment.trailing.boundaryRun) * 5 +
    Math.min(20, alignment.longestRun) +
    Math.round(alignment.sequence.canonicalCoverage * 30) -
    Math.min(20, alignment.sequence.largestInteriorCanonicalGap * 2);
}
