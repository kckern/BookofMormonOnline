/**
 * test/bots/opener-highlight.test.ts — HIGHLIGHT line parse + validation.
 */
import { describe, it, expect } from 'vitest';
import {
  highlightCentrality, highlightIsCentral, parseOpenerHighlight, htmlToPlain, normalizePhrase, validateHighlight,
} from '../../src/bots/openerHighlight.js';

const BLOCK = '<p>And now behold, my brethren, [c]11432 he shall come to redeem those who will be baptized unto repentance.</p>';

describe('htmlToPlain', () => {
  it('strips tags and footnote markers', () => {
    const plain = htmlToPlain(BLOCK);
    expect(plain).not.toContain('<p>');
    expect(plain).not.toContain('[c]');
    expect(plain).toContain('baptized unto repentance');
  });
});

describe('parseOpenerHighlight', () => {
  it('splits the HIGHLIGHT line off the body and validates it against the block', () => {
    const opening = 'Christ redeems those who repent.\n\nHIGHLIGHT: baptized unto repentance';
    const { body, highlight } = parseOpenerHighlight(opening, BLOCK);
    expect(body).toBe('Christ redeems those who repent.');
    expect(highlight).toBe('baptized unto repentance');
  });

  it('extracts audit thesis without displaying either metadata line', () => {
    const parsed = parseOpenerHighlight(
      'The argument.\nTHESIS: Repentance precedes baptism.\nHIGHLIGHT: baptized unto repentance',
      BLOCK,
    );
    expect(parsed).toEqual({
      body: 'The argument.',
      thesis: 'Repentance precedes baptism.',
      highlight: 'baptized unto repentance',
    });
  });

  it('validates a reviewer candidate independently', () => {
    expect(validateHighlight('« baptized unto repentance »', BLOCK)).toBe('baptized unto repentance');
    expect(validateHighlight('a peripheral invention', BLOCK)).toBeNull();
  });

  it('rejects a highlight that is not present in the block', () => {
    const opening = 'A point.\n\nHIGHLIGHT: faith without works is dead';
    const { body, highlight } = parseOpenerHighlight(opening, BLOCK);
    expect(body).toBe('A point.');
    expect(highlight).toBeNull();
  });

  it('tolerates quotes/punctuation around the phrase', () => {
    const opening = 'A point.\n\nHIGHLIGHT: "redeem those who will be baptized."';
    const { highlight } = parseOpenerHighlight(opening, BLOCK);
    expect(highlight).toBe('redeem those who will be baptized');
  });

  it('removes French guillemets from a validated phrase', () => {
    const opening = 'Un argument.\n\nHIGHLIGHT: « redeem those who will be baptized »';
    expect(parseOpenerHighlight(opening, BLOCK).highlight)
      .toBe('redeem those who will be baptized');
  });

  it('returns the whole text as body and null highlight when no HIGHLIGHT line', () => {
    const { body, highlight } = parseOpenerHighlight('Just an argument, no marker.', BLOCK);
    expect(body).toBe('Just an argument, no marker.');
    expect(highlight).toBeNull();
  });
});

describe('normalizePhrase', () => {
  it('lowercases and drops non-alphanumerics', () => {
    expect(normalizePhrase('  Baptized, unto—Repentance! ')).toBe('baptized unto repentance');
  });
});

describe('highlight centrality', () => {
  const commentary = '핵심 악은 불의한 법령과 가난한 자에게서 권리를 박탈하는 제도적 질서다.';
  const thesis = '법으로 약자의 권리를 빼앗는 권력을 비판한다.';

  it('accepts evidence discussed by the central argument', () => {
    expect(highlightIsCentral('가난한 자에게서 권리를 박탈하여', thesis, commentary)).toBe(true);
    expect(highlightCentrality('가난한 자에게서 권리를 박탈하여', thesis, commentary)).toBeGreaterThanOrEqual(0.25);
  });

  it('rejects exact but peripheral evidence absent from the argument', () => {
    expect(highlightIsCentral('그의 손은 여전히 뻗어 있느니라', thesis, commentary)).toBe(false);
  });
});
