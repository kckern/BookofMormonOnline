import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { AuthProvider, AuthResult } from '../authProvider.js';
import type { Session, Principal } from '../sessionStore.js';
import * as store from '../sessionStore.js';
import { findUserByCredential, maybeRehash } from '../../data/loaders/userauth.js';
import { verifyPassword } from '../password.js';

export class OpaqueTokenProvider implements AuthProvider {
  constructor(private ctx: { db: Kysely<DB>; sandbox: boolean }) {}

  verify(raw: string): Promise<Principal | null> {
    return store.verifyToken(this.ctx.db, raw);
  }

  async authenticate(input: { username: string; password: string; anonToken?: string }): Promise<AuthResult> {
    const user = await findUserByCredential(this.ctx.db, input.username);
    if (!user || !(await verifyPassword(input.password, user.pass))) {
      return { ok: false, error: 'Invalid credentials' };
    }
    await maybeRehash(this.ctx, user.user, input.password, user.pass);
    const session = await this.issue(user.user);
    return { ok: true, principal: { userId: user.user, displayName: user.name ?? undefined, email: user.email ?? undefined }, session };
  }

  issue(userId: string): Promise<Session> { return store.issueToken(this.ctx, userId); }
  revoke(raw: string): Promise<boolean> { return store.revokeToken(this.ctx, raw); }
  revokeAll(userId: string): Promise<number> { return store.revokeAllForUser(this.ctx, userId); }

  async refresh(raw: string): Promise<Session | null> {
    const p = await store.verifyToken(this.ctx.db, raw);
    if (!p) return null;
    const next = await store.issueToken(this.ctx, p.userId);
    await store.revokeToken(this.ctx, raw);
    return next;
  }
}
