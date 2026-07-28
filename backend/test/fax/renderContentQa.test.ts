import { describe, expect, it } from 'vitest';
import {
  alignRenderedContent,
  assessFocusedBoundaryRecovery,
  classifyRenderedContentFlags,
  tokenizeWords,
} from '../../scripts/lib/fax-render-content-qa.ts';

describe('fax rendered-content QA', () => {
  it('joins OCR line-break hyphenation at the canonical suffix', () => {
    const result = alignRenderedContent(
      'And it came to pass; possession of all their forti- fications.',
      'And it came to pass; possession of all their fortifications.',
    );
    expect(result.trailing.boundaryRun).toBeGreaterThanOrEqual(4);
  });

  it('matches canonical words collapsed into one OCR token', () => {
    const result = alignRenderedContent(
      'according to the spirit of prophecy which wasinthem',
      'according to the spirit of prophecy which was in them',
    );
    expect(result.trailing.boundaryRun).toBeGreaterThanOrEqual(4);
  });

  it('matches one canonical word split into OCR tokens', () => {
    const result = alignRenderedContent(
      'that ye be cut off and destroyed for ever',
      'that ye be cut off and destroyed forever',
    );
    expect(result.trailing.boundaryRun).toBeGreaterThanOrEqual(4);
  });

  it('tolerates one OCR error across a split canonical boundary word', () => {
    const result = alignRenderedContent(
      'it shall be blessed or ever',
      'it shall be blessed forever',
    );
    expect(result.trailing.boundaryRun).toBeGreaterThanOrEqual(5);
  });

  it('still catches the 1866 missing-leading-And regression', () => {
    const result = alignRenderedContent(
      'if they harden not their hearts against the Lamb of God',
      'And harden not their hearts against the Lamb of God',
    );
    expect(result.leading.boundaryRun).toBe(0);
    expect(result.longestRun).toBeGreaterThanOrEqual(6);
  });

  it('accepts one corrupted exterior OCR token when the remainder aligns', () => {
    const result = alignRenderedContent(
      'Bor if they will repent and hearken unto my words',
      'But if they will repent and hearken unto my words',
    );
    expect(result.leading.boundaryRun).toBeGreaterThanOrEqual(8);
  });

  it('does not call a genuinely missing first token an OCR substitution', () => {
    const result = alignRenderedContent(
      'if they will repent and hearken unto my words',
      'But if they will repent and hearken unto my words',
    );
    expect(result.leading.boundaryRun).toBe(0);
  });

  it('catches the 1874 premature-ending regression', () => {
    const result = alignRenderedContent(
      'For the time cometh, saith the Lamb of God, on the one hand or on the other',
      'For the time cometh, saith the Lamb of God, which I have spoken',
    );
    expect(result.leading.boundaryRun).toBeGreaterThanOrEqual(4);
    expect(result.trailing.boundaryRun).toBe(0);
    expect(result.longestRun).toBeGreaterThanOrEqual(7);
  });

  it('distinguishes preceding leaked text from a missing canonical start', () => {
    const result = alignRenderedContent(
      'the robbers did gain advantages over them And thus ended the fifteenth year',
      'And thus ended the fifteenth year',
    );
    expect(result.leading.boundaryRun).toBe(0);
    expect(result.leading.bestRun).toBeGreaterThanOrEqual(5);
    expect(result.leading.bestOffset).toBeGreaterThanOrEqual(6);
  });

  it('distinguishes following leaked text from a missing canonical end', () => {
    const result = alignRenderedContent(
      'Wherefore for their good have I written them And as one generation passed',
      'Wherefore for their good have I written them',
    );
    expect(result.trailing.boundaryRun).toBe(0);
    expect(result.trailing.bestRun).toBeGreaterThanOrEqual(4);
    expect(result.trailing.bestOffset).toBeGreaterThanOrEqual(4);
  });

  it('normalizes historical ligatures and long-s', () => {
    expect(tokenizeWords('ſatisfied ﬂesh')).toEqual(['satisfied', 'flesh']);
  });

  it('detects a missing middle even when both passage boundaries match', () => {
    const result = alignRenderedContent(
      'And again my beloved it that ye can attain unto faith save ye shall have hope',
      'And again my beloved brethren I would speak unto you concerning hope ' +
        'How is it that ye can attain unto faith save ye shall have hope',
    );
    expect(result.leading.boundaryRun).toBeGreaterThanOrEqual(4);
    expect(result.trailing.boundaryRun).toBeGreaterThanOrEqual(8);
    expect(result.sequence.canonicalCoverage).toBeLessThan(0.75);
    expect(result.sequence.largestInteriorCanonicalGap).toBeGreaterThanOrEqual(8);
  });

  it('reports high ordered coverage for ordinary OCR substitutions', () => {
    const result = alignRenderedContent(
      'And many of the pore did inquire concerning the place where the Son of God came',
      'And many of the people did inquire concerning the place where the Son of God came',
    );
    expect(result.sequence.canonicalCoverage).toBeGreaterThan(0.9);
    expect(result.sequence.largestInteriorCanonicalGap).toBeLessThanOrEqual(1);
  });
});

describe('focused boundary OCR recovery', () => {
  it('accepts an isolated exact final token on a clear crop edge', () => {
    const canonical =
      'Now these sons had searched the scriptures diligently to know the word of God';
    const full = alignRenderedContent(
      'Now these sons had searched the scriptures diligently to know the word of',
      canonical,
    );
    const strip = alignRenderedContent('God', canonical);
    expect(assessFocusedBoundaryRecovery({
      side: 'end',
      fullAlignment: full,
      stripAlignment: strip,
      edgeInk: 0.002,
    })).toMatchObject({
      accepted: true,
      boundaryRun: 1,
      exactBoundaryToken: true,
    });
  });

  it('rejects recovery when the crop edge still intersects ink', () => {
    const canonical =
      'Now these sons had searched the scriptures diligently to know the word of God';
    const full = alignRenderedContent(
      'Now these sons had searched the scriptures diligently to know the word of',
      canonical,
    );
    const strip = alignRenderedContent('God', canonical);
    expect(assessFocusedBoundaryRecovery({
      side: 'end',
      fullAlignment: full,
      stripAlignment: strip,
      edgeInk: 0.15,
    }).accepted).toBe(false);
  });
});

describe('rendered-content status gate', () => {
  it('treats incoherent OCR as a hard failure', () => {
    expect(classifyRenderedContentFlags([
      'left-edge-ink-review',
      'ocr-content-unreliable',
    ])).toBe('failure');
  });

  it('keeps exact focused-boundary recovery informational', () => {
    expect(classifyRenderedContentFlags([
      'trailing-token-recovered-by-focused-ocr',
    ])).toBe('pass');
  });
});
