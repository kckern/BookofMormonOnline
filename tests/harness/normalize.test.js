const { scrub, shapeOf, shapesCompatible, normalize, stabilizeErrors } = require('./normalize');

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

describe('stabilizeErrors', () => {
  test('reduces errors to sorted deduplicated messages', () => {
    const body = {
      data: { x: 1 },
      errors: [
        { message: 'B crash', path: ['object', 1], extensions: { exception: { stacktrace: ['at /srv/app.js:1'] } } },
        { message: 'A crash', path: ['object', 0] },
        { message: 'B crash', path: ['object', 3] },
      ],
    };
    expect(stabilizeErrors(body)).toEqual({
      data: { x: 1 },
      errors: [{ message: 'A crash' }, { message: 'B crash' }],
    });
  });

  test('passes through bodies without errors', () => {
    expect(stabilizeErrors({ data: { x: 1 } })).toEqual({ data: { x: 1 } });
  });

  test('normalize applies error stabilization at every tier', () => {
    const body = { data: { v: 1 }, errors: [{ message: 'crash', extensions: { exception: { stacktrace: ['leak'] } } }] };
    expect(normalize(body, 'exact').errors).toEqual([{ message: 'crash' }]);
    expect(normalize(body, 'scrubbed').errors).toEqual([{ message: 'crash' }]);
    expect(normalize(body, 'shape').errors).toEqual([{ message: 'string' }]);
  });
});
