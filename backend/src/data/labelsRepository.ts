import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { Label } from '../domain/label.js';
import { Translator } from './translator.js';

export class LabelsRepository {
  constructor(
    private readonly db: Kysely<DB>,
    private readonly translator: Translator,
  ) {}

  /**
   * All UI labels except relationship labels (type 'peoplerel'), in clustered
   * (guid) order — the legacy query had no ORDER BY, so MySQL returned
   * primary-key order; we pin it explicitly (baselines are order-sensitive).
   */
  async list(): Promise<Label[]> {
    const rows = await this.db
      .selectFrom('bom_label')
      .select(['guid', 'label_id', 'label_text'])
      .where('type', '!=', 'peoplerel')
      .orderBy('guid', 'asc')
      .execute();
    const translations = await this.translator.forGuids(
      rows.map((r) => r.guid),
      'label_text',
    );
    return rows.map((r) => ({
      key: r.label_id,
      val: this.translator.pick(translations, r.guid, r.label_text),
    }));
  }
}
