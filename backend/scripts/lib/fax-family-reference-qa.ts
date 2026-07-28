import {
  alignRenderedContent,
  type ContentAlignment,
} from './fax-render-content-qa.ts';

export type FamilyReferenceRegistration = {
  accepted: boolean;
  sourceCoverage?: number;
  targetCoverage?: number;
};

export type FamilyReferenceAssessment = {
  accepted: boolean;
  tier: 'strong-ocr-equivalence' | 'registered-short-text' | 'rejected';
  reason: string;
  alignment: ContentAlignment;
  referenceTokenCount: number;
  targetTokenCount: number;
  expectedLeadingNumber: number | null;
  referenceLeadingNumber: number | null;
  targetLeadingNumber: number | null;
  referenceBoundaryNumbers: number[];
  targetBoundaryNumbers: number[];
  unexpectedBoundaryNumbers: number[];
  adjacentNumberLeak: boolean;
  leadingNumberDisagreement: boolean;
  leadingNumberMismatch: boolean;
  registrationAccepted: boolean;
  registrationCoverageFloor: number | null;
};

const unsafeReferenceFlags = [
  'source-media-unavailable',
  'missing-box-row',
  'suspiciously-small-response',
  'suspicious-dimensions',
  'width-exceeds-request',
  'nearly-blank',
  'mostly-dark',
  'ocr-content-unreliable',
  'unmatched-leading-content',
  'unmatched-trailing-content',
  'preceding-content-before-verse',
  'following-content-after-verse',
  'request-decode-or-ocr-error',
];

const unsafeTargetFlags = [
  'source-media-unavailable',
  'missing-box-row',
  'suspiciously-small-response',
  'suspicious-dimensions',
  'width-exceeds-request',
  'nearly-blank',
  'mostly-dark',
  'ocr-content-unreliable',
  'preceding-neighbor-text-leak',
  'following-neighbor-text-leak',
  'preceding-content-before-verse',
  'following-content-after-verse',
  'internal-canonical-span-missing',
  'request-decode-or-ocr-error',
];

/**
 * Read an explicit printed verse number only at the OCR boundary.
 *
 * Requiring punctuation and a following word avoids treating a page number or
 * an incidental number inside the passage as a verse label.
 */
export function leadingPrintedVerseNumber(value: string): number | null {
  const match = /^\s*[^A-Za-z0-9]{0,8}(\d{1,3})\s*[.,:]\s+[A-Za-zſ“"'‘]/u
    .exec(value);
  return match ? Number(match[1]) : null;
}

/** Read printed verse labels at OCR line boundaries. */
export function printedVerseBoundaryNumbers(value: string): number[] {
  return [...value.matchAll(
    /^\s*[^A-Za-z0-9\n]{0,8}(\d{1,3})\s*[.,:]\s+[A-Za-zſ“"'‘]/gmu,
  )].map((match) => Number(match[1]));
}

/**
 * Decide whether a derivative crop is content-equivalent to a trusted
 * printing-family reference crop.
 *
 * Canonical scripture text is intentionally not part of this decision:
 * historical editions can differ in wording, abbreviations, or versification.
 * The strong tier requires near-complete bidirectional OCR agreement. The
 * relaxed tier is limited to short passages whose page-level OCR registration
 * independently passed with strong whole-page coverage.
 */
export function assessFamilyReference(args: {
  targetOcr: string;
  targetFlags?: string[];
  referenceOcr: string;
  referenceFlags?: string[];
  registrations?: FamilyReferenceRegistration[];
  expectedLeadingNumber?: number | null;
}): FamilyReferenceAssessment {
  const {
    targetOcr,
    targetFlags = [],
    referenceOcr,
    referenceFlags = [],
    registrations = [],
    expectedLeadingNumber = null,
  } = args;
  const alignment = alignRenderedContent(targetOcr, referenceOcr);
  const referenceTokenCount = alignment.canonicalTokens.length;
  const targetTokenCount = alignment.ocrTokens.length;
  const referenceLeadingNumber = leadingPrintedVerseNumber(referenceOcr);
  const targetLeadingNumber = leadingPrintedVerseNumber(targetOcr);
  const referenceBoundaryNumbers = printedVerseBoundaryNumbers(referenceOcr);
  const targetBoundaryNumbers = printedVerseBoundaryNumbers(targetOcr);
  const leadingNumberDisagreement =
    referenceLeadingNumber != null &&
    targetLeadingNumber != null &&
    referenceLeadingNumber !== targetLeadingNumber;
  const expectedWordAgreementScore =
    (alignment.sequence.canonicalCoverage + alignment.sequence.ocrPrecision) / 2;
  // OCR commonly confuses individual digits (30/80, 23/93, 31/381).
  // Treat the disagreement as geometry evidence only when the trusted source
  // reads the expected verse and the target reads a nearby verse number. This
  // catches adjacent-crop substitution without turning digit noise into a
  // corpus-wide hard failure.
  const leadingNumberMismatch =
    expectedLeadingNumber != null &&
    referenceLeadingNumber === expectedLeadingNumber &&
    targetLeadingNumber != null &&
    targetLeadingNumber !== expectedLeadingNumber &&
    Math.abs(targetLeadingNumber - expectedLeadingNumber) <= 3 &&
    expectedWordAgreementScore < 0.80;
  const unexpectedBoundaryNumbers = expectedLeadingNumber == null
    ? []
    : [...new Set(targetBoundaryNumbers.filter((number) =>
      number !== expectedLeadingNumber &&
      Math.abs(number - expectedLeadingNumber) <= 3))];
  const adjacentNumberLeak =
    expectedLeadingNumber != null &&
    referenceBoundaryNumbers.includes(expectedLeadingNumber) &&
    targetBoundaryNumbers.length >= 2 &&
    unexpectedBoundaryNumbers.length > 0;
  const registrationAccepted = registrations.length > 0 &&
    registrations.every((registration) => registration.accepted);
  const registrationCoverageFloor = registrations.length
    ? Math.min(...registrations.flatMap((registration) => [
      registration.sourceCoverage ?? 0,
      registration.targetCoverage ?? 0,
    ]))
    : null;
  const base = {
    alignment,
    referenceTokenCount,
    targetTokenCount,
    expectedLeadingNumber,
    referenceLeadingNumber,
    targetLeadingNumber,
    referenceBoundaryNumbers,
    targetBoundaryNumbers,
    unexpectedBoundaryNumbers,
    adjacentNumberLeak,
    leadingNumberDisagreement,
    leadingNumberMismatch,
    registrationAccepted,
    registrationCoverageFloor,
  };

  if (leadingNumberMismatch) {
    return {
      ...base,
      accepted: false,
      tier: 'rejected',
      reason:
        `printed verse number mismatch: reference=${referenceLeadingNumber}, ` +
        `target=${targetLeadingNumber}`,
    };
  }
  if (adjacentNumberLeak) {
    return {
      ...base,
      accepted: false,
      tier: 'rejected',
      reason:
        `adjacent printed verse number in target: expected=` +
        `${expectedLeadingNumber}, unexpected=${unexpectedBoundaryNumbers.join(',')}`,
    };
  }

  const unsafeReference = referenceFlags.find((flag) =>
    unsafeReferenceFlags.includes(flag) || /-edge-ink-review$/.test(flag));
  if (unsafeReference) {
    return {
      ...base,
      accepted: false,
      tier: 'rejected',
      reason: `unsafe reference evidence: ${unsafeReference}`,
    };
  }
  const unsafeTarget = targetFlags.find((flag) =>
    unsafeTargetFlags.includes(flag));
  if (unsafeTarget) {
    return {
      ...base,
      accepted: false,
      tier: 'rejected',
      reason: `unsafe target evidence: ${unsafeTarget}`,
    };
  }
  if (referenceTokenCount < 8 || targetTokenCount < 8) {
    return {
      ...base,
      accepted: false,
      tier: 'rejected',
      reason: 'insufficient OCR tokens for family comparison',
    };
  }

  const coverage = alignment.sequence.canonicalCoverage;
  const precision = alignment.sequence.ocrPrecision;
  const leadingGap = alignment.sequence.leadingCanonicalGap;
  const trailingGap = alignment.sequence.trailingCanonicalGap;
  const strongRunFloor = Math.min(
    12,
    Math.max(6, Math.floor(referenceTokenCount * 0.35)),
  );
  const strong =
    coverage >= 0.92 &&
    precision >= 0.92 &&
    leadingGap <= 1 &&
    trailingGap <= 2 &&
    alignment.longestRun >= strongRunFloor;
  if (strong) {
    return {
      ...base,
      accepted: true,
      tier: 'strong-ocr-equivalence',
      reason: 'target crop is bidirectionally equivalent to reference crop',
    };
  }

  const shortRunFloor = Math.min(
    10,
    Math.max(8, Math.floor(referenceTokenCount * 0.35)),
  );
  const registeredShortText =
    referenceTokenCount <= 40 &&
    registrationAccepted &&
    (registrationCoverageFloor ?? 0) >= 0.80 &&
    coverage >= 0.84 &&
    precision >= 0.80 &&
    leadingGap <= 1 &&
    trailingGap <= 1 &&
    alignment.longestRun >= shortRunFloor;
  if (registeredShortText) {
    return {
      ...base,
      accepted: true,
      tier: 'registered-short-text',
      reason:
        'short target crop agrees with reference under accepted page registration',
    };
  }

  return {
    ...base,
    accepted: false,
    tier: 'rejected',
    reason:
      `insufficient family agreement: coverage=${coverage.toFixed(3)}, ` +
      `precision=${precision.toFixed(3)}`,
  };
}
