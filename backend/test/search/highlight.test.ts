import { describe, expect, test } from 'vitest';
import { splitClauses, candidateSpans, bestSpanByCosine, hasKeywordOverlap, computeHighlights, highlightText } from '../../src/search/highlight.js';

describe('splitClauses', () => {
  test('splits on punctuation and keeps correct offsets', () => {
    const text = 'Faith, hope; and charity.';
    const clauses = splitClauses(text);
    expect(clauses.map((c) => c.text)).toEqual(['Faith', 'hope', 'charity']);
    for (const c of clauses) expect(text.slice(c.start, c.end)).toBe(c.text);
  });
  test('single clause returns whole trimmed text', () => {
    expect(splitClauses('  the resurrection  ').map((c) => c.text)).toEqual(['the resurrection']);
  });
  test('empty/whitespace → no clauses', () => {
    expect(splitClauses('   ')).toEqual([]);
  });
});

describe('candidateSpans', () => {
  test('produces 1..maxClauses contiguous runs with original-text offsets', () => {
    const text = 'a, b, c';
    const spans = candidateSpans(splitClauses(text), text, 2);
    expect(spans.map((s) => s.text).sort()).toEqual(['a', 'a, b', 'b', 'b, c', 'c'].sort());
    for (const s of spans) expect(text.slice(s.start, s.end)).toBe(s.text);
  });
});

describe('bestSpanByCosine', () => {
  test('returns the offsets of the highest-cosine span', () => {
    const spans = [{ text: 'x', start: 0, end: 1 }, { text: 'y', start: 2, end: 3 }];
    const q = [1, 0];
    const vecs = [[0, 1], [1, 0]];
    expect(bestSpanByCosine(q, spans, vecs)).toEqual({ start: 2, end: 3 });
  });
  test('empty spans → null', () => {
    expect(bestSpanByCosine([1, 0], [], [])).toBeNull();
  });
});

describe('hasKeywordOverlap', () => {
  test('true when a query token (len>=3) appears literally', () => {
    expect(hasKeywordOverlap('what ye shall', 'what ye shall do')).toBe(true);
  });
  test('false for purely semantic match (no shared token)', () => {
    expect(hasKeywordOverlap('afterlife', 'a space betwixt the time of death and the resurrection')).toBe(false);
  });
});

describe('computeHighlights', () => {
  test('batches spans across texts and picks best per text; gates on keyword overlap & empties', async () => {
    const query = 'afterlife';
    const qVec = [1, 0];
    const texts = [
      'a space betwixt death, and the resurrection',
      'afterlife is mentioned here',
      '',
    ];
    const embedSpans = async (arr: string[]) => arr.map((s) => (/resurrection/.test(s) ? [1, 0] : [0, 1]));
    const out = await computeHighlights(query, qVec, texts, embedSpans);
    expect(out[1]).toBeNull();
    expect(out[2]).toBeNull();
    expect(out[0]).not.toBeNull();
    expect(texts[0].slice(out[0]!.start, out[0]!.end)).toMatch(/resurrection/);
  });
  test('all-ineligible → all null without calling the embedder', async () => {
    let called = false;
    const out = await computeHighlights('faith', [1, 0], ['faith is here', ''], async (a: string[]) => { called = true; return a.map(() => [0, 1]); });
    expect(out).toEqual([null, null]);
    expect(called).toBe(false);
  });
});

describe('highlightText', () => {
  test('embeds the query then delegates to computeHighlights for one text', async () => {
    const r = await highlightText(
      'afterlife',
      'the soul, and the resurrection',
      async () => [1, 0],
      async (arr: string[]) => arr.map((s) => (/resurrection/.test(s) ? [1, 0] : [0, 1])),
    );
    expect(r).not.toBeNull();
  });
  test('returns null when the query token appears literally (keyword overlap)', async () => {
    const r = await highlightText('resurrection', 'the resurrection of the dead', async () => [1,0], async (a: string[]) => a.map(()=>[1,0]));
    expect(r).toBeNull();
  });
});
