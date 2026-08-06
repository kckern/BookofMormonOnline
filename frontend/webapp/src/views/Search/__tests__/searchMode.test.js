import { parseMode, buildSearchPath, shouldOfferRich, isRichDegraded } from '../searchMode';

describe('parseMode', () => {
  test('rich only when ?mode=rich', () => {
    expect(parseMode('?mode=rich')).toBe('rich');
    expect(parseMode('?mode=keyword')).toBe('keyword');
    expect(parseMode('')).toBe('keyword');
    expect(parseMode(undefined)).toBe('keyword');
  });
});

describe('buildSearchPath', () => {
  test('appends ?mode=rich only in rich mode', () => {
    expect(buildSearchPath('faith', 'rich')).toBe('/search/faith?mode=rich');
    expect(buildSearchPath('faith', 'keyword')).toBe('/search/faith');
  });
});

describe('shouldOfferRich', () => {
  test('offers only in keyword mode, non-semantic, over 100 matches', () => {
    expect(shouldOfferRich('keyword', false, 101)).toBe(true);
    expect(shouldOfferRich('keyword', false, 100)).toBe(false);
    expect(shouldOfferRich('keyword', true, 500)).toBe(false); // fallback already went semantic
    expect(shouldOfferRich('rich', false, 500)).toBe(false);
    expect(shouldOfferRich('keyword', false, undefined)).toBe(false);
  });
});

describe('isRichDegraded', () => {
  test('true only when rich mode came back non-semantic (vector backend down)', () => {
    expect(isRichDegraded('rich', false)).toBe(true);
    expect(isRichDegraded('rich', true)).toBe(false);
    expect(isRichDegraded('keyword', false)).toBe(false);
  });
});
