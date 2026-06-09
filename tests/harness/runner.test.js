const { fillPlaceholders, buildQuery } = require('./runner');

describe('fillPlaceholders', () => {
  test('replaces tokens deep in arrays and objects', () => {
    const input = [{ token: '{{TOKEN}}', items: [{ slug: 'abinadi' }] }];
    expect(fillPlaceholders(input, { TOKEN: 'abc123' }))
      .toEqual([{ token: 'abc123', items: [{ slug: 'abinadi' }] }]);
  });

  test('leaves non-strings untouched', () => {
    expect(fillPlaceholders([31103, true, null], { TOKEN: 'x' })).toEqual([31103, true, null]);
  });
});

describe('buildQuery', () => {
  test('builds exactly one query through the real frontend module', () => {
    const query = buildQuery('person', ['nephi']);
    expect(query).toContain('person (slug: "nephi")');
  });

  test('passes token to arity-2 builders', () => {
    const query = buildQuery('divisionProgress', ['bofm'], 'tok123');
    expect(query).toContain('progress(token: "tok123")');
  });

  test('throws on unknown query types', () => {
    expect(() => buildQuery('nosuchquery', ['x'])).toThrow(/nosuchquery/);
  });
});
