import { describe, expect, test } from 'vitest';
import {
  TYPE_CONFIGS,
  personRowToSource,
  placeRowToSource,
  commentaryRowToSource,
  narrationRowToSource,
  pageRowToSource,
  eventRowToSource,
  matterRowToSource,
  dedupeMattersByWeight,
} from '../../src/search/adapters.js';

describe('TYPE_CONFIGS', () => {
  test('registers all seven types with chunk flags', () => {
    const byType = Object.fromEntries(TYPE_CONFIGS.map((c) => [c.cfg.type, c.cfg.chunk]));
    expect(byType).toMatchObject({ person: false, place: false, commentary: true, narration: false, page: false, event: false, matter: true });
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

  test('commentaryRowToSource joins title+text, slug null, ref is verse_id as string', () => {
    const r = commentaryRowToSource({ id: 42, title: 'Faith', text: 'Faith is the first principle', verse_id: 1001 });
    expect(r).toEqual({ entity_id: '42', title: 'Faith', text: 'Faith Faith is the first principle', slug: null, ref: '1001' });
  });

  test('commentaryRowToSource uses null ref when verse_id is null', () => {
    const r = commentaryRowToSource({ id: 7, title: 'Introduction', text: 'An overview', verse_id: null });
    expect(r).toEqual({ entity_id: '7', title: 'Introduction', text: 'Introduction An overview', slug: null, ref: null });
  });

  test('narrationRowToSource uses description as both title and text, slug and ref null', () => {
    const r = narrationRowToSource({ guid: 'abc-123', description: 'Lehi leaves Jerusalem' });
    expect(r).toEqual({ entity_id: 'abc-123', title: 'Lehi leaves Jerusalem', text: 'Lehi leaves Jerusalem', slug: null, ref: null });
  });

  test('pageRowToSource uses title as both title and text, ref cleaned, slug null', () => {
    const r = pageRowToSource({ guid: 'page-guid-1', title: 'About the Book of Mormon', ref: '1-nephi-1' });
    expect(r).toEqual({ entity_id: 'page-guid-1', title: 'About the Book of Mormon', text: 'About the Book of Mormon', slug: null, ref: '1-nephi-1' });
  });

  test('eventRowToSource: entity_id from id, title from document, slug history/<slug>, ref from event_year', () => {
    const r = eventRowToSource({ id: 5, slug: 'first-vision', document: 'The First Vision', source: 'Joseph Smith History', teaser: 'Joseph sees God', year: 1820, event_year: 1820 });
    expect(r).toEqual({ entity_id: '5', title: 'The First Vision', text: 'The First Vision Joseph Smith History Joseph sees God', slug: 'history/first-vision', ref: '1820' });
  });

  test('eventRowToSource: falls back to slug as entity_id when id is null, ref from year when event_year null', () => {
    const r = eventRowToSource({ id: null, slug: 'translation', document: null, source: 'Book of Mormon', teaser: null, year: 1829, event_year: null });
    expect(r).toEqual({ entity_id: 'translation', title: 'Book of Mormon', text: 'Book of Mormon', slug: 'history/translation', ref: '1829' });
  });
});

describe('matter mapper', () => {
  test('matterRowToSource joins name+subtitle+description+aliases+tags, matters/ slug, ref null', () => {
    const r = matterRowToSource({
      slug: 'faith', name: 'Faith', subtitle: 'Belief unto action',
      description: 'The first principle', aliases: 'belief', tags: 'doctrine',
    });
    expect(r).toEqual({
      entity_id: 'faith',
      title: 'Faith',
      text: 'Faith Belief unto action The first principle belief doctrine',
      slug: 'matters/faith',
      ref: null,
    });
  });

  test('matterRowToSource falls back to slug when name is blank', () => {
    const r = matterRowToSource({ slug: 'x', name: '   ', subtitle: null, description: null, aliases: null, tags: null });
    expect(r).toEqual({ entity_id: 'x', title: 'x', text: '', slug: 'matters/x', ref: null });
  });
});

describe('dedupeMattersByWeight', () => {
  test('keeps the highest-weight row per slug', () => {
    const rows = [
      { slug: 'a', weight: 1, name: 'lo' },
      { slug: 'a', weight: 5, name: 'hi' },
      { slug: 'b', weight: 2, name: 'b' },
    ];
    const out = dedupeMattersByWeight(rows).sort((x, y) => x.slug.localeCompare(y.slug));
    expect(out).toEqual([{ slug: 'a', weight: 5, name: 'hi' }, { slug: 'b', weight: 2, name: 'b' }]);
  });
});
