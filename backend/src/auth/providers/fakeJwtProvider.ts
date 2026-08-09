// Test-only reference impl: proves the interface is satisfiable by a provider
// whose internals are NOTHING like the opaque store (no bom_user_token table).
// "Stateless" token + a denylist — exactly the shape a real JwtProvider needs so
// revoke()/revokeAll() are honored. If this passes the SAME contract as the
// opaque provider, the seam is real.
import type { AuthProvider, AuthResult } from '../authProvider.js';
import type { Session, Principal } from '../sessionStore.js';

export class FakeJwtProvider implements AuthProvider {
  private users = new Map<string, string>();       // username → password
  private denylist = new Set<string>();            // revoked jti
  private revokedUsers = new Map<string, number>(); // username → revoked-at (seq)
  private seq = 0;

  seed(username: string, password: string) { this.users.set(username, password); }

  private decode(token: string): { userId: string; jti: string; iat: number } | null {
    try {
      const [userId, jti, iat] = Buffer.from(token, 'base64url').toString('utf8').split('|');
      if (!userId || !jti || !iat) return null;
      return { userId, jti, iat: Number(iat) };
    } catch { return null; }
  }

  async verify(token: string): Promise<Principal | null> {
    const c = this.decode(token);
    if (!c || this.denylist.has(c.jti)) return null;
    const ru = this.revokedUsers.get(c.userId);
    if (ru !== undefined && c.iat <= ru) return null;
    return { userId: c.userId };
  }
  async authenticate(input: { username: string; password: string }): Promise<AuthResult> {
    if (this.users.get(input.username) !== input.password) return { ok: false, error: 'Invalid credentials' };
    return { ok: true, principal: { userId: input.username }, session: await this.issue(input.username) };
  }
  async issue(userId: string): Promise<Session> {
    const jti = `j${this.seq++}`;
    const iat = this.seq; // monotonic stand-in (no Date/random in the fake)
    return { token: Buffer.from(`${userId}|${jti}|${iat}`, 'utf8').toString('base64url') };
  }
  async revoke(token: string): Promise<boolean> {
    const c = this.decode(token);
    if (!c) return false;
    const had = !this.denylist.has(c.jti);
    this.denylist.add(c.jti);
    return had;
  }
  async revokeAll(userId: string): Promise<number> {
    this.revokedUsers.set(userId, this.seq); // everything issued so far is now invalid
    return 1;
  }
  async refresh(token: string): Promise<Session | null> {
    const p = await this.verify(token);
    if (!p) return null;
    await this.revoke(token);
    return this.issue(p.userId);
  }
}
