import { executeQuery } from '../helpers/graphql';

describe('Scripture Queries Regression Tests', () => {
  describe('scripture', () => {
    it('should return verses by reference', async () => {
      const { data, errors } = await executeQuery(`
        query {
          scripture(ref: "1 Nephi 1:1-3") {
            ref
            passages {
              reference
              heading
              verses {
                verse
                verse_id
                text
              }
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.scripture).toBeDefined();
      expect(data?.scripture.ref).toBeDefined();
      expect(data?.scripture.passages.length).toBeGreaterThan(0);
    });

    it('should return verses by verse_ids', async () => {
      const { data, errors } = await executeQuery(`
        query {
          scripture(verse_ids: [31103, 31104]) {
            passages {
              verses {
                verse_id
                text
              }
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.scripture.passages[0].verses.length).toBe(2);
    });
  });

  describe('verses', () => {
    it('should return verses by ID array', async () => {
      const { data, errors } = await executeQuery(`
        query {
          verses(verse_ids: [31103, 31104, 31105]) {
            verse_id
            reference
            text
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.verses).toHaveLength(3);
      data?.verses.forEach((verse: any) => {
        expect(verse).toHaveProperty('verse_id');
        expect(verse).toHaveProperty('reference');
        expect(verse).toHaveProperty('text');
      });
    });
  });

  describe('read', () => {
    it('should return reading block with navigation', async () => {
      const { data, errors } = await executeQuery(`
        query {
          read(ref: "1 Nephi 1") {
            ref
            verse_id
            verse_count
            prev_ref
            next_ref
            sections {
              ref
              heading
              blocks {
                ref
                voice
                lines {
                  ref
                  verse_num
                  text
                }
              }
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.read).toBeDefined();
      expect(data?.read.ref).toBeDefined();
      expect(data?.read.sections.length).toBeGreaterThan(0);
    });
  });

  describe('versehighlights', () => {
    it('should return highlights for verse pairs', async () => {
      const { data, errors } = await executeQuery(`
        query {
          versehighlights(verse_pairs: [[31103, 1001]]) {
            isQuote
            bom_verse_id
            bible_verse_id
            bom_highlight
            bible_highlight
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.versehighlights).toBeDefined();
    });
  });
});
