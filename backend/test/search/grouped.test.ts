import { describe, expect, test } from 'vitest';
import { hitToCard, GROUP_TYPES } from '../../src/search/grouped.js';
import type { SearchHit } from '../../src/search/types.js';

const hit = (o: Partial<SearchHit>): SearchHit => ({ type: 'person', entity_id: 'x', score: 0.5, text: '', title: null, ref: null, slug: null, version: null, ...o });

describe('GROUP_TYPES', () => {
  test('covers the six non-verse groups in display order', () => {
    expect(GROUP_TYPES).toEqual(['person', 'place', 'commentary', 'narration', 'page', 'event']);
  });
});

describe('hitToCard', () => {
  test('maps a person hit to a card DTO', () => {
    const c = hitToCard(hit({ type: 'person', entity_id: 'abinadi', title: 'Abinadi', slug: 'people/abinadi', score: 0.9 }));
    expect(c).toEqual({ slug: 'people/abinadi', title: 'Abinadi', snippet: '', ref: null, score: 0.9 });
  });
  test('maps a commentary hit (snippet from text)', () => {
    const c = hitToCard(hit({ type: 'commentary', entity_id: 'c1', title: null, text: 'a note', slug: 'x', score: 0.7 }));
    expect(c).toMatchObject({ slug: 'x', snippet: 'a note', score: 0.7 });
  });
});
