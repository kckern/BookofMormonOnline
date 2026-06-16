import { executeQuery } from '../helpers/graphql';

describe('Notes & Commentary Queries Regression Tests', () => {
  describe('commentary', () => {
    it('should return commentary by ID', async () => {
      const { data, errors } = await executeQuery(`
        query {
          commentary(id: ["1"]) {
            id
            slug
            title
            text
            reference
            publication {
              source_title
              source_name
              source_year
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.commentary).toBeDefined();
    });
  });

  describe('publications', () => {
    it('should return all publication sources', async () => {
      const { data, errors } = await executeQuery(`
        query {
          publications {
            source_id
            source_title
            source_name
            source_short
            source_year
            source_publisher
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.publications).toBeDefined();
      expect(data?.publications.length).toBeGreaterThan(0);
    });
  });

  describe('image', () => {
    it('should return image by ID', async () => {
      const { data, errors } = await executeQuery(`
        query {
          image(id: ["1"]) {
            id
            title
            artist
            link
            width
            height
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.image).toBeDefined();
    });
  });

  describe('chiasmus', () => {
    it('should return all chiasmus structures', async () => {
      const { data, errors } = await executeQuery(`
        query {
          chiasmus {
            chiasmus_id
            title
            reference
            scheme
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.chiasmus).toBeDefined();
      expect(data?.chiasmus.length).toBeGreaterThan(0);
    });

    it('should return chiasmus with lines by ID', async () => {
      const { data, errors } = await executeQuery(`
        query {
          chiasmus(id: ["1"]) {
            chiasmus_id
            title
            reference
            scheme
            lines {
              line_key
              line_text
              highlights
              label
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      if (data?.chiasmus?.length > 0) {
        expect(data?.chiasmus[0].lines).toBeDefined();
      }
    });
  });

  describe('passagenotes', () => {
    it('should return comprehensive passage notes', async () => {
      const { data, errors } = await executeQuery(`
        query {
          passagenotes(verse_ids: [31103001, 31103002, 31103003]) {
            commentary {
              id
              title
              preview
            }
            people {
              name
              slug
            }
            places {
              name
              slug
            }
            images {
              title
              file
            }
            chiasmus {
              title
              reference
            }
            refs {
              verse_id
              ref
              type
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.passagenotes).toBeDefined();
    });
  });

  describe('history', () => {
    it('should return historical document by slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          history(slug: ["1832-11-16-mormonism"]) {
            id
            slug
            year
            date
            type
            source
            author
            document
            teaser
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.history).toBeDefined();
      if (data?.history?.length > 0) {
        expect(data?.history[0].slug).toBe("1832-11-16-mormonism");
      }
    });
  });

  describe('fax', () => {
    it('should return facsimile pages', async () => {
      const { data, errors } = await executeQuery(`
        query {
          fax(filter: "1830") {
            slug
            title
            info
            code
            pages
            format
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.fax).toBeDefined();
    });
  });
});
