/**
 * test/bots/opener-highlight.test.ts — HIGHLIGHT line parse + validation.
 */
import { describe, it, expect } from 'vitest';
import { parseOpenerHighlight, htmlToPlain, normalizePhrase } from '../../src/bots/openerHighlight.js';

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
