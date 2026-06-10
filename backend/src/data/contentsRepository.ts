/**
 * Contents root: division rows. Everything below (titlepage title/slug, pages,
 * sections, counts) resolves lazily through per-request loaders — only what
 * the query selects gets fetched.
 */
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';

export interface DivisionRow {
  guid: string;
  page: string;
  description: string | null;
  weight: number;
}

export class ContentsRepository {
  constructor(private readonly db: Kysely<DB>) {}

  /** Legacy getSlugTip: incoming slugs may be paths; the last segment matters. */
  private static slugTips(slugs: readonly string[]): string[] {
    return slugs.map((s) => s.split('/').pop() ?? s);
  }

  async divisions(slugArgs: readonly string[] | null): Promise<DivisionRow[]> {
    // Tiebreak on guid: legacy emitted equal-weight rows in engine order;
    // (weight, guid) reproduces it for divisions (no weight ties exist there).
    let q = this.db
      .selectFrom('bom_division')
      .select(['guid', 'page', 'description', 'weight'])
      .orderBy('weight', 'asc')
      .orderBy('guid', 'asc');
    if (slugArgs && slugArgs.length) {
      const tips = ContentsRepository.slugTips(slugArgs);
      q = q.where('page', 'in', (eb) =>
        eb.selectFrom('bom_slug').select('link').where('slug', 'in', tips),
      );
    }
    return q.execute();
  }
}
