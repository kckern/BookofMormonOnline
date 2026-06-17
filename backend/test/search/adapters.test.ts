import { describe, expect, test } from 'vitest';
import { TYPE_CONFIGS, personRowToSource, placeRowToSource } from '../../src/search/adapters.js';

describe('TYPE_CONFIGS', () => {
  test('registers the six new types with chunk flags', () => {
    const byType = Object.fromEntries(TYPE_CONFIGS.map((c) => [c.cfg.type, c.cfg.chunk]));
    expect(byType).toMatchObject({ person: false, place: false, commentary: true, narration: false, page: false, event: false });
  });
});

describe('row mappers', () => {
  test('personRowToSource builds name+title text and people/ slug', () => {
    const r = personRowToSource({ slug: 'abinadi', name: 'Abinadi', title: 'Prophet', classification: null, identification: null });
    expect(r).toEqual({ entity_id: 'abinadi', title: 'Abinadi', text: 'Abinadi Prophet', slug: 'people/abinadi', ref: null });
  });
  test('placeRowToSource builds name+aka text and places/ slug', () => {
    const r = placeRowToSource({ slug: 'nephi', name: 'Land of Nephi', aka: 'Lehi-Nephi' });
    expect(r).toEqual({ entity_id: 'nephi', title: 'Land of Nephi', text: 'Land of Nephi Lehi-Nephi', slug: 'places/nephi', ref: null });
  });
});
