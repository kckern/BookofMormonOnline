#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Separate wrong-neighbor crops from OCR digit confusions.
 *
 * Input is a family-adjusted render-QA report. For each high-confidence printed
 * verse-number mismatch, compare the target OCR with both the expected family
 * reference and the family reference named by the detected number. Word-level
 * agreement, not the digit itself, determines the classification.
 */
import fs from 'node:fs';
import path from 'node:path';
import { alignRenderedContent } from './lib/fax-render-content-qa.ts';

type AlignmentSummary = {
  coverage: number;
  precision: number;
  longestRun: number;
  score: number;
};

type QaResult = {
  version: string;
  verseId: number;
  selector: string;
  flags: string[];
  ocrText: string | null;
  familyReference?: {
    expectedLeadingNumber?: number | null;
    referenceLeadingNumber?: number | null;
    targetLeadingNumber?: number | null;
    leadingNumberMismatch?: boolean;
  };
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const adjustedFile = path.resolve(flag('adjusted-qa'));
const referenceFile = path.resolve(flag('reference-qa'));
const outputFile = path.resolve(flag('out'));
if (!flag('adjusted-qa') || !fs.existsSync(adjustedFile) ||
    !flag('reference-qa') || !fs.existsSync(referenceFile) ||
    !flag('out')) {
  throw new Error('--adjusted-qa, --reference-qa, and --out are required');
}

const adjusted = JSON.parse(fs.readFileSync(adjustedFile, 'utf8')) as {
  results: QaResult[];
};
const reference = JSON.parse(fs.readFileSync(referenceFile, 'utf8')) as {
  results: QaResult[];
};
const referenceBySelector = new Map(
  reference.results.map((result) => [result.selector, result]),
);

function summarize(targetOcr: string, referenceOcr: string): AlignmentSummary {
  const alignment = alignRenderedContent(targetOcr, referenceOcr);
  const coverage = alignment.sequence.canonicalCoverage;
  const precision = alignment.sequence.ocrPrecision;
  return {
    coverage,
    precision,
    longestRun: alignment.longestRun,
    score: (coverage + precision) / 2,
  };
}

const results = adjusted.results
  .filter((result) =>
    result.familyReference?.leadingNumberMismatch === true &&
    result.ocrText)
  .map((result) => {
    const family = result.familyReference!;
    const expectedNumber = family.expectedLeadingNumber!;
    const detectedNumber = family.targetLeadingNumber!;
    const chapterPrefix = result.selector.replace(/\.\d+$/, '');
    const detectedSelector = `${chapterPrefix}.${detectedNumber}`;
    const expectedReference = referenceBySelector.get(result.selector);
    const detectedReference = referenceBySelector.get(detectedSelector);
    const expectedAlignment = expectedReference?.ocrText
      ? summarize(result.ocrText!, expectedReference.ocrText)
      : null;
    const detectedAlignment = detectedReference?.ocrText
      ? summarize(result.ocrText!, detectedReference.ocrText)
      : null;
    let classification:
      | 'wrong-neighbor'
      | 'ocr-digit-confusion'
      | 'ambiguous';
    let reason: string;
    if (detectedAlignment &&
        detectedAlignment.coverage >= 0.82 &&
        detectedAlignment.precision >= 0.82 &&
        detectedAlignment.score >= (expectedAlignment?.score ?? 0) + 0.15) {
      classification = 'wrong-neighbor';
      reason =
        `target words match ${detectedSelector} substantially better than ` +
        `${result.selector}`;
    } else if (expectedAlignment &&
        expectedAlignment.score >= 0.80 &&
        expectedAlignment.score >= (detectedAlignment?.score ?? 0) + 0.25) {
      classification = 'ocr-digit-confusion';
      reason =
        'target words match the expected family reference substantially better ' +
        'than the verse suggested by the OCR digit';
    } else {
      classification = 'ambiguous';
      reason = 'word-level family evidence does not decisively identify a verse';
    }
    return {
      version: result.version,
      verseId: result.verseId,
      selector: result.selector,
      expectedNumber,
      detectedNumber,
      detectedSelector,
      classification,
      reason,
      expectedAlignment,
      detectedAlignment,
      targetFlags: result.flags,
    };
  });

const counts = Object.fromEntries(
  ['wrong-neighbor', 'ocr-digit-confusion', 'ambiguous'].map((classification) => [
    classification,
    results.filter((result) => result.classification === classification).length,
  ]),
);
const report = {
  generatedAt: new Date().toISOString(),
  method:
    'deterministic OCR word alignment against expected and detected-number family references',
  adjustedQaFile: adjustedFile,
  referenceQaFile: referenceFile,
  summary: {
    candidates: results.length,
    ...counts,
  },
  findings: results.map((result) => ({
    severity: result.classification === 'wrong-neighbor' ? 'error' : 'warning',
    code: 'LEADING_PRINTED_VERSE_NUMBER_MISMATCH',
    version: result.version,
    verseId: result.verseId,
    selector: result.selector,
    classification: result.classification,
  })),
  results,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  ...report.summary,
}, null, 2));
