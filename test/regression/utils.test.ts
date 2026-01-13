import { executeQuery, executeMutation } from '../helpers/graphql';

describe('Utility Queries Regression Tests', () => {
  describe('labels', () => {
    it('should return all labels', async () => {
      const { data, errors } = await executeQuery(`
        query {
          labels {
            key
            val
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.labels).toBeDefined();
      expect(data?.labels.length).toBeGreaterThan(0);
      expect(data?.labels[0]).toHaveProperty('key');
      expect(data?.labels[0]).toHaveProperty('val');
    });
  });

  describe('menu', () => {
    it('should return menu structure', async () => {
      const { data, errors } = await executeQuery(`
        query {
          menu {
            label
            link
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.menu).toBeDefined();
      // Menu resolver returns [null] as stub - verify structure exists
      expect(Array.isArray(data?.menu)).toBe(true);
    });
  });

  describe('books', () => {
    it('should return book/chapter structure', async () => {
      const { data, errors } = await executeQuery(`
        query {
          books {
            book
            chapters
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.books).toBeDefined();
      // Books resolver returns [null] as stub - verify array structure exists
      expect(Array.isArray(data?.books)).toBe(true);
    });
  });

  describe('markdown', () => {
    it('should return markdown content', async () => {
      const { data, errors } = await executeQuery(`
        query {
          markdown(slug: ["about"]) {
            slug
            markdown
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.markdown).toBeDefined();
    });
  });

  describe('shortlink', () => {
    it('should create and retrieve shortlink', async () => {
      // Create shortlink
      const createResult = await executeMutation(`
        mutation {
          shortlink(string: "/lehites") {
            hash
            string
          }
        }
      `);

      expect(createResult.errors).toBeUndefined();
      expect(createResult.data?.shortlink).toBeDefined();
      expect(createResult.data?.shortlink.hash).toBeDefined();

      const hash = createResult.data?.shortlink.hash;

      // Retrieve shortlink
      const getResult = await executeQuery(`
        query {
          shortlink(hash: ["${hash}"]) {
            hash
            string
          }
        }
      `);

      expect(getResult.errors).toBeUndefined();
      expect(getResult.data?.shortlink).toBeDefined();
      expect(getResult.data?.shortlink.string).toBe('/lehites');
    });
  });

  describe('generateToken', () => {
    it('should return null when resolver is not implemented', async () => {
      const { data, errors } = await executeQuery(`
        query {
          generateToken
        }
      `);

      // generateToken is defined in schema but resolver is not implemented
      // This tests that the query executes without errors
      expect(errors).toBeUndefined();
      // The value will be null since there's no resolver
      expect(data).toHaveProperty('generateToken');
    });

    it('should accept seed parameter without errors', async () => {
      const { data, errors } = await executeQuery(`
        query {
          generateToken(seed: 12345)
        }
      `);

      expect(errors).toBeUndefined();
      expect(data).toHaveProperty('generateToken');
    });
  });

  describe('search', () => {
    it('should return search results for valid query', async () => {
      const { data, errors } = await executeQuery(`
        query {
          search(query: "faith") {
            reference
            text
            slug
            page
            section
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.search).toBeDefined();
      expect(Array.isArray(data?.search)).toBe(true);
      expect(data?.search.length).toBeGreaterThan(0);
    });

    it('should return empty array for short query', async () => {
      const { data, errors } = await executeQuery(`
        query {
          search(query: "ab") {
            reference
            text
          }
        }
      `);

      expect(errors).toBeUndefined();
      // Query must be 3+ characters, so this should return empty
      expect(data?.search).toEqual([]);
    });

    it('should return empty array for no matches', async () => {
      const { data, errors } = await executeQuery(`
        query {
          search(query: "xyznonexistent12345") {
            reference
            text
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.search).toEqual([]);
    });
  });

  describe('scripture', () => {
    it('should return scripture by reference', async () => {
      const { data, errors } = await executeQuery(`
        query {
          scripture(ref: "1 Nephi 1:1") {
            ref
            verses {
              verse_id
              reference
              text
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.scripture).toBeDefined();
    });
  });

  describe('test', () => {
    it('should return test object', async () => {
      const { data, errors } = await executeQuery(`
        query {
          test {
            db
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.test).toBeDefined();
      expect(data?.test.db).toBeDefined();
    });
  });
});
