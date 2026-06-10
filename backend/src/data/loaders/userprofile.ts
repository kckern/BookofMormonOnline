/** userprofile data access — see docs/reference/backend-mutation-porting-guide.md */
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function userprofileLoaders(db: Kysely<DB>, lang: string, core: Loaders) {
  return {};
}
