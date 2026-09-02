/**
 * test/messaging/profileUrlClaim.test.ts
 *
 * Regression guard for docs/bugs/2026-09-01-profile-photo-reverts.md.
 *
 * uploadProfileImage used to write S3 only. toUserDTO returns
 * `row.profile_url || deriveProfileUrl(row)`, so any stored URL — a gravatar
 * or provider avatar inherited at migration time — shadowed the uploaded
 * object forever and the photo "reverted" on the next page load.
 *
 * Since the 2026-09-02 merge (invariant I1) a person owns exactly one
 * messenger row, keyed by md5(username), so the claim targets that row and
 * nothing else. Compiled against a driverless Kysely so the shape of the
 * write is asserted without touching the DB.
 */
import {
  DummyDriver,
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
} from 'kysely';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../codegen/db.js';
import { claimUploadedProfileUrl } from '../../src/messaging/users.js';

const db = new Kysely<DB>({
  dialect: {
    createAdapter: () => new MysqlAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (kysely) => new MysqlIntrospector(kysely),
    createQueryCompiler: () => new MysqlQueryCompiler(),
  },
});

const USER_ID = '9b4291984af9d3c3baaae5af3ece9962';
const URL = `https://assets.bookofmormon.online/profiles/${USER_ID}.jpg?v=1756742000000`;

describe('claimUploadedProfileUrl', () => {
  it('claims exactly the md5-keyed row', () => {
    const compiled = claimUploadedProfileUrl(db, { userId: USER_ID, profileUrl: URL }).compile();

    expect(compiled.sql).toContain('update `messenger_users`');
    expect(compiled.sql).toContain('set `profile_url` = ?');
    expect(compiled.sql).toContain('where `user_id` = ?');
    expect(compiled.sql).not.toContain('bom_user_id');
    expect(compiled.parameters).toEqual([URL, USER_ID]);
  });
});
