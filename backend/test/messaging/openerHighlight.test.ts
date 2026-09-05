import { describe, expect, test } from 'vitest';
import { normalizePhrase, parseOpenerHighlight } from '../../src/bots/openerHighlight.js';

describe('localized opener highlights', () => {
  test('preserves Hangul while normalizing punctuation', () => {
    expect(normalizePhrase('  하나님의—말씀! ')).toBe('하나님의 말씀');
  });

  test('accepts an exact Korean phrase from the linked block', () => {
    expect(parseOpenerHighlight(
      '논평입니다.\nHIGHLIGHT: "하나님의 말씀"',
      '<p>그들은 하나님의 말씀을 들었다.</p>',
    )).toEqual({ body: '논평입니다.', highlight: '하나님의 말씀', thesis: null });
  });
});
