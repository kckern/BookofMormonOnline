/**
 * test/messaging/buildDataString-refs.test.ts
 *
 * TDD — content-model phase 2: buildDataString reads from content_refs (Reference[])
 * instead of legacy link_type/link_target/link_aux columns + messenger_highlights table.
 *
 * Pure unit tests — no DB connection required.
 */

// Minimal env stubs so module-level imports in messages.ts don't blow up.
process.env['MYSQL_HOST'] ||= 'test';
process.env['MYSQL_PORT'] ||= '3306';
process.env['MYSQL_USER'] ||= 'test';
process.env['MYSQL_PASSWORD'] ||= 'test';
process.env['MYSQL_DB'] ||= 'test';
process.env['SANDBOX'] ||= '1';

import { describe, expect, it } from 'vitest';
import { buildDataString } from '../../src/messaging/messages.js';
import type { Reference } from '../../src/messaging/contentRefs.js';

describe('buildDataString (from Reference[])', () => {
  it('verse ref → links.text = String(ordinal)', () => {
    const refs: Reference[] = [{ type: 'verse', ordinal: 56, role: 'subject' }];
    const result = JSON.parse(buildDataString(refs));
    expect(result.links).toEqual({ text: '56' });
    expect(result.highlights).toBeUndefined();
  });

  it('legacy_text ref → links.text = String(ordinal)', () => {
    const refs: Reference[] = [{ type: 'legacy_text', ordinal: 12, role: 'subject' }];
    const result = JSON.parse(buildDataString(refs));
    expect(result.links).toEqual({ text: '12' });
  });

  it('commentary ref → links.com = String(id)', () => {
    const refs: Reference[] = [{ type: 'commentary', id: 1306505301, role: 'subject' }];
    const result = JSON.parse(buildDataString(refs));
    expect(result.links).toEqual({ com: '1306505301' });
  });

  it('image ref → links.img = String(id)', () => {
    const refs: Reference[] = [{ type: 'image', id: 42, role: 'subject' }];
    const result = JSON.parse(buildDataString(refs));
    expect(result.links).toEqual({ img: '42' });
  });

  it('section ref → links.section = String(id)', () => {
    const refs: Reference[] = [{ type: 'section', id: 7, role: 'subject' }];
    const result = JSON.parse(buildDataString(refs));
    expect(result.links).toEqual({ section: '7' });
  });

  it('fax ref with aux → links.fax = id.aux', () => {
    const refs: Reference[] = [{ type: 'fax', id: 12, aux: 'kjv', role: 'subject' }];
    const result = JSON.parse(buildDataString(refs));
    expect(result.links.fax).toBe('12.kjv');
  });

  it('fax ref without aux → links.fax = String(id)', () => {
    const refs: Reference[] = [{ type: 'fax', id: 12, role: 'subject' }];
    const result = JSON.parse(buildDataString(refs));
    expect(result.links.fax).toBe('12');
  });

  it('person/place/object → no links key', () => {
    const refs: Reference[] = [{ type: 'person', id: 'lehi', role: 'subject' }];
    const result = JSON.parse(buildDataString(refs));
    expect(result.links).toBeUndefined();
  });

  it('highlight ref with span.text → highlights array', () => {
    const refs: Reference[] = [
      { type: 'verse', ordinal: 56, role: 'subject' },
      { type: 'verse', id: 0, role: 'highlight', span: { text: 'hello' } },
    ];
    const result = JSON.parse(buildDataString(refs));
    expect(result.links).toEqual({ text: '56' });
    expect(result.highlights).toContain('hello');
  });

  it('only first non-highlight ref produces a links entry', () => {
    const refs: Reference[] = [
      { type: 'verse', ordinal: 56, role: 'subject' },
      { type: 'commentary', id: 999, role: 'subject' },
    ];
    const result = JSON.parse(buildDataString(refs));
    // Only the first non-highlight link is emitted (legacy at-most-one semantics)
    expect(result.links).toEqual({ text: '56' });
    expect(result.links['com']).toBeUndefined();
  });

  it('empty refs with metadata → passthrough, no links key', () => {
    const result = JSON.parse(buildDataString([], '{"mentions":{"x":1}}'));
    expect(result.mentions).toEqual({ x: 1 });
    expect(result.links).toBeUndefined();
  });

  it('metadata links/highlights keys are stripped in favour of derived values', () => {
    const refs: Reference[] = [{ type: 'verse', ordinal: 10, role: 'subject' }];
    const result = JSON.parse(buildDataString(refs, '{"links":{"old":"stale"},"mentions":{"y":2}}'));
    // metadata links key is stripped; derived links.text wins
    expect(result.links).toEqual({ text: '10' });
    expect(result.mentions).toEqual({ y: 2 });
  });

  it('verse ref with undefined ordinal → no links key', () => {
    const refs: Reference[] = [{ type: 'verse', role: 'subject' }];
    const result = JSON.parse(buildDataString(refs));
    expect(result.links).toBeUndefined();
  });

  it('empty refs, no metadata → empty object (no links, no highlights)', () => {
    const result = JSON.parse(buildDataString([]));
    expect(result.links).toBeUndefined();
    expect(result.highlights).toBeUndefined();
  });
});
