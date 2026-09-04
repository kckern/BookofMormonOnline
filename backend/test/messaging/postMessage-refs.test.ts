/**
 * test/messaging/postMessage-refs.test.ts
 *
 * TDD — Phase 3 write path: postMessage persists anchor + content_refs.
 *
 * Pure helper unit tests: no DB connection required.
 * Tests the exported `insertRefFields` helper from messages.ts.
 */

import { describe, expect, it } from 'vitest';
import { insertRefFields } from '../../src/messaging/messages.js';

describe('insertRefFields (pure)', () => {
  it('passes anchor through unchanged', () => {
    const result = insertRefFields({
      anchor: 'lehites',
      references: [{ type: 'verse', id: 31103, role: 'subject' }],
    });
    expect(result.anchor).toBe('lehites');
  });

  it('serialises references array to a JSON string', () => {
    const refs = [{ type: 'verse', id: 31103, role: 'subject' }];
    const result = insertRefFields({ anchor: 'lehites', references: refs });
    expect(result.content_refs).toBe(JSON.stringify(refs));
  });

  it('returns null anchor when anchor is undefined', () => {
    const result = insertRefFields({});
    expect(result.anchor).toBeNull();
  });

  it('returns null content_refs when references is undefined', () => {
    const result = insertRefFields({});
    expect(result.content_refs).toBeNull();
  });
});
