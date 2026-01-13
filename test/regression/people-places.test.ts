import { executeQuery } from '../helpers/graphql';
import { expectedShapes } from '../helpers/fixtures';

describe('People & Places Queries Regression Tests', () => {
  describe('person', () => {
    it('should return person by slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          person(slug: ["nephi-1"]) {
            slug
            name
            title
            classification
            description
            relations {
              relation
              person {
                name
                slug
              }
            }
            index {
              slug
              ref
              text
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.person).toBeDefined();
      if (data?.person.length > 0) {
        expect(data?.person[0]).toHaveProperty('name');
        expect(data?.person[0]).toHaveProperty('slug');
      }
    });

    it('should return multiple people', async () => {
      const { data, errors } = await executeQuery(`
        query {
          person(slug: ["nephi-1", "lehi-1"]) {
            slug
            name
          }
        }
      `);

      expect(errors).toBeUndefined();
      // May return fewer if slugs don't exist
      expect(data?.person).toBeDefined();
    });
  });

  describe('peoplenetwork', () => {
    it('should return relationship network', async () => {
      const { data, errors } = await executeQuery(`
        query {
          peoplenetwork {
            nodes {
              slug
              name
              group
              title
              cluster
            }
            links {
              source
              target
              value
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      // peoplenetwork may return null if no network data is available
      if (data?.peoplenetwork !== null) {
        expect(data?.peoplenetwork.nodes.length).toBeGreaterThan(0);
        expect(data?.peoplenetwork.links.length).toBeGreaterThan(0);
      }
    });
  });

  describe('place', () => {
    it('should return place by slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          place(slug: ["jerusalem"]) {
            slug
            name
            info
            type
            location
            description
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.place).toBeDefined();
    });
  });

  describe('maps', () => {
    it('should return all maps', async () => {
      const { data, errors } = await executeQuery(`
        query {
          maps {
            slug
            name
            desc
            centerx
            centery
            zoom
            tiles
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.maps).toBeDefined();
      expect(data?.maps.length).toBeGreaterThan(0);
    });
  });

  describe('mapstories', () => {
    it('should return map stories', async () => {
      const { data, errors } = await executeQuery(`
        query {
          mapstories(map: ["arabian-peninsula"]) {
            slug
            title
            description
            moves {
              guid
              seq
              description
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.mapstories).toBeDefined();
    });
  });

  describe('timeline', () => {
    it('should return timeline events', async () => {
      const { data, errors } = await executeQuery(`
        query {
          timeline {
            slug
            heading
            date
            x
            y
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.timeline).toBeDefined();
      expect(data?.timeline.length).toBeGreaterThan(0);
    });
  });
});
