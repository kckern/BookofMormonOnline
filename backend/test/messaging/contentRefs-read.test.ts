/**
 * TDD Phase 2: parseContentRefs — surfaces content_refs column on MessageDTO.
 *
 * Confirms the exported helper correctly normalises the DB column value
 * (which mysql2 may hand back as a JSON string, a pre-parsed array, or null)
 * into a Reference[] for the DTO.
 */

process.env.MYSQL_HOST ||= 'test';
process.env.MYSQL_USER ||= 'test';
process.env.MYSQL_PASSWORD ||= 'test';
process.env.SANDBOX ||= '1';

import { describe, it, expect } from 'vitest';
import { parseContentRefs } from '../../src/messaging/messages.js';

describe('parseContentRefs', () => {
  it('parses a JSON string into an array of references', () => {
    const raw = JSON.stringify([{ type: 'verse', id: 1234, role: 'subject' }]);
    const result = parseContentRefs(raw);
    expect(result).toEqual([{ type: 'verse', id: 1234, role: 'subject' }]);
  });

  it('returns an already-parsed array as-is', () => {
    const arr = [{ type: 'image', id: 'abc', role: 'highlight' }];
    const result = parseContentRefs(arr);
    expect(result).toEqual(arr);
  });

  it('returns [] for null', () => {
    expect(parseContentRefs(null)).toEqual([]);
  });

  it('returns [] for invalid JSON string', () => {
    expect(parseContentRefs('not valid json {')).toEqual([]);
  });

  it('returns [] for a non-array object (e.g. {})', () => {
    expect(parseContentRefs({ type: 'verse', id: 1 })).toEqual([]);
  });
});
