import { describe, expect, test } from 'vitest';
import { stripEmptyDeep } from '../src/compat/responseFilter.js';

describe('stripEmptyDeep (legacy Apollo formatResponse compat)', () => {
  test('deletes null, empty-string, and empty-array keys recursively', () => {
    const data = {
      a: null,
      b: '',
      c: [],
      d: { e: null, f: 'keep', g: { h: '' } },
    };
    stripEmptyDeep(data);
    expect(data).toEqual({ d: { f: 'keep', g: {} } });
  });

  test('keeps 0 and false (legacy only strips "", null, [])', () => {
    const data = { zero: 0, no: false, yes: true };
    stripEmptyDeep(data);
    expect(data).toEqual({ zero: 0, no: false, yes: true });
  });

  test('recurses into array items but keeps null/empty items in place', () => {
    const data = {
      list: [{ x: null, y: 1 }, null, 'str', 42],
    };
    stripEmptyDeep(data);
    expect(data).toEqual({ list: [{ y: 1 }, null, 'str', 42] });
  });

  test('leaves strings inside arrays untouched', () => {
    const data = { tags: ['a', '', 'b'] };
    stripEmptyDeep(data);
    expect(data).toEqual({ tags: ['a', '', 'b'] });
  });
});
