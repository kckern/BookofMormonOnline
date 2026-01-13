import { executeQuery } from '../helpers/graphql';
import { fixtures, invalidFixtures, expectedShapes } from '../helpers/fixtures';

describe('Content Queries Regression Tests', () => {
  describe('division', () => {
    it('should return all divisions when no slug provided', async () => {
      const { data, errors } = await executeQuery(`
        query {
          division {
            title
            slug
            description
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.division).toBeDefined();
      expect(Array.isArray(data?.division)).toBe(true);
      expect(data?.division.length).toBeGreaterThan(0);

      // Verify shape
      const division = data?.division[0];
      expectedShapes.division.forEach(field => {
        expect(division).toHaveProperty(field);
      });
    });

    it('should return specific division by slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          division(slug: ["lehites"]) {
            title
            slug
            description
            pages {
              title
              slug
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.division).toHaveLength(1);
      expect(data?.division[0].slug).toBe('lehites');
      expect(data?.division[0].title).toContain('Lehites');
      expect(data?.division[0].pages.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          division(slug: ["${invalidFixtures.nonExistentSlug}"]) {
            title
            slug
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.division).toEqual([]);
    });
  });

  describe('page', () => {
    it('should return page with sections', async () => {
      const { data, errors } = await executeQuery(`
        query {
          page(slug: ["lehites"]) {
            title
            slug
            sections {
              title
              slug
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.page).toHaveLength(1);
      expect(data?.page[0].slug).toBe('lehites');
      expect(data?.page[0].sections.length).toBeGreaterThan(0);
    });

    it('should return multiple pages', async () => {
      // Query each page separately and include sections (required by resolver)
      const slugs = ['lehites', 'jaredites'];
      const results = await Promise.all(
        slugs.map(slug => executeQuery(`
          query {
            page(slug: ["${slug}"]) {
              title
              slug
              sections {
                title
                slug
              }
            }
          }
        `))
      );

      expect(results[0].errors).toBeUndefined();
      expect(results[1].errors).toBeUndefined();
      expect(results[0].data?.page.length).toBe(1);
      expect(results[1].data?.page.length).toBe(1);
      expect(results[0].data?.page[0].slug).toBe('lehites');
      expect(results[1].data?.page[0].slug).toBe('jaredites');
    });
  });

  describe('section', () => {
    it('should return section by slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          section(slug: ["lehites/lehis-prophetic-call"]) {
            title
            slug
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.section).toBeDefined();
      expect(data?.section.length).toBeGreaterThan(0);
      expect(data?.section[0].title).toContain('Prophetic Call');
    });
  });

  describe('text', () => {
    it('should return text block by slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          text(slug: ["lehites/1"]) {
            guid
            slug
            heading
            content
            duration
            people { name slug }
            places { name slug }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.text).toBeDefined();
      if (data?.text.length > 0) {
        expect(data?.text[0]).toHaveProperty('slug');
        expect(data?.text[0]).toHaveProperty('content');
        expect(data?.text[0].slug).toBe('lehites/1');
      }
    });
  });

  describe('lookup', () => {
    it('should lookup text by scripture reference', async () => {
      const { data, errors } = await executeQuery(`
        query {
          lookup(ref: ["1 Nephi 1:1"]) {
            slug
            heading
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.lookup).toBeDefined();
      expect(data?.lookup.length).toBeGreaterThan(0);
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

      // Verify shape
      const result = data?.search[0];
      expectedShapes.searchResult.forEach(field => {
        expect(result).toHaveProperty(field);
      });
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
});
