const { prepareQueries } = require('../../frontend/webapp/src/models/GraphQLQueries');

describe('frontend GraphQLQueries import', () => {
  test('builds a person query from the real frontend module', () => {
    const built = prepareQueries({ person: ['nephi'] });
    expect(built).toHaveLength(1);
    expect(built[0].type).toBe('person');
    expect(built[0].query).toContain('person (slug: "nephi")');
  });

  test('builds a mutation string for signout', () => {
    const built = prepareQueries({ signout: [{ token: 'abc' }] });
    expect(built[0].query).toContain('mutation signout');
  });

  test('builds the dynamic passagenotes_7 alias', () => {
    const built = prepareQueries({ passagenotes_7: [31103] });
    expect(built[0].query).toContain('passagenotes_7: passagenotes (verse_ids: 31103)');
  });
});
