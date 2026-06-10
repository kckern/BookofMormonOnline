/**
 * Translator — the single point of truth for the translation join.
 *
 * Legacy scattered `includeTranslation`/`translatedValue` across every resolver;
 * here, repositories declare their translatable fields once and call
 * `translate()`. English (or missing lang) short-circuits: the base column IS
 * the English source of truth, translations are overlays keyed by
 * (guid, refkey, lang) in bom_translation.
 */
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';

export class Translator {
  constructor(
    private readonly db: Kysely<DB>,
    private readonly lang: string,
  ) {}

  get active(): boolean {
    return !!this.lang && this.lang !== 'en';
  }

  /** guid → translated value for one refkey; empty map when inactive. */
  async forGuids(guids: readonly string[], refkey: string): Promise<Map<string, string>> {
    if (!this.active || guids.length === 0) return new Map();
    const rows = await this.db
      .selectFrom('bom_translation')
      .select(['guid', 'value'])
      .where('lang', '=', this.lang)
      .where('refkey', '=', refkey)
      .where('guid', 'in', [...guids])
      .execute();
    return new Map(rows.map((r) => [r.guid, String(r.value)]));
  }

  /** Overlay helper: translated value if present, else the base value. */
  pick(map: Map<string, string>, guid: string, base: string | null): string | null {
    return map.get(guid) ?? base;
  }
}
