const { scrub, shapeOf, shapesCompatible, normalize } = require('./normalize');

describe('scrub', () => {
  test('masks volatile keys recursively, preserves nulls', () => {
    const input = {
      data: {
        tokensignin: {
          user: { name: 'Test', time: 1749480000, access_token: 'abc', bookmark: null },
          sessions: [{ datetime: '2026-06-09', duration: 42 }],
        },
      },
    };
    expect(scrub(input)).toEqual({
      data: {
        tokensignin: {
          user: { name: 'Test', time: '[SCRUBBED]', access_token: '[SCRUBBED]', bookmark: null },
          sessions: [{ datetime: '[SCRUBBED]', duration: '[SCRUBBED]' }],
        },
      },
    });
  });
});

describe('shapeOf', () => {
  test('maps primitives to type names and merges array element shapes', () => {
    expect(shapeOf({ a: 'x', b: 3, c: null, d: [{ e: 1 }, { e: null }] }))
      .toEqual({ a: 'string', b: 'number', c: 'null', d: [{ e: 'number' }] });
  });

  test('empty arrays stay empty', () => {
    expect(shapeOf({ a: [] })).toEqual({ a: [] });
  });
});

describe('shapesCompatible', () => {
  test('accepts matching shapes and treats null as wildcard', () => {
    expect(shapesCompatible({ a: 'string', b: 'null' }, { a: 'string', b: 'number' })).toEqual([]);
  });

  test('reports mismatch paths', () => {
    const problems = shapesCompatible({ a: 'string' }, { a: 'number' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('.a');
  });

  test('reports missing and unexpected keys', () => {
    expect(shapesCompatible({ a: 'string' }, { b: 'string' })).toHaveLength(2);
  });
});

describe('normalize', () => {
  test('exact passes through, scrubbed scrubs, shape shapes', () => {
    const body = { data: { x: { timestamp: 5, name: 'n' } } };
    expect(normalize(body, 'exact')).toEqual(body);
    expect(normalize(body, 'scrubbed').data.x.timestamp).toBe('[SCRUBBED]');
    expect(normalize(body, 'shape')).toEqual({ data: { x: { timestamp: 'number', name: 'string' } } });
  });
});
