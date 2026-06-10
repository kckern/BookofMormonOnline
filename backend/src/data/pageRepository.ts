/**
 * Page root: page rows by slug (or all). The tree below resolves lazily
 * through per-request loaders (see data/loaders.ts) — selection-driven, no
 * fetch for unrequested branches.
 */
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { PageRow } from './loaders.js';

export class PageRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async pages(slugArgs: readonly string[] | null): Promise<PageRow[]> {
    const tips = (slugArgs ?? []).map((s) => s.split('/').pop() ?? s);
    let q = this.db
      .selectFrom('bom_page')
      .select(['guid', 'parent', 'title', 'weight'])
      .orderBy('weight', 'asc')
      .orderBy('guid', 'asc');
    if (tips.length) {
      q = q.where('guid', 'in', (eb) =>
        eb.selectFrom('bom_slug').select('link').where('slug', 'in', tips),
      );
    }
    return q.execute();
  }
}
