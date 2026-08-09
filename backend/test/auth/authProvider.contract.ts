import { expect, it } from 'vitest';
import type { AuthProvider } from '../../src/auth/authProvider.js';

/** Run the identical behavioral contract against any provider. */
export function runAuthProviderContract(
  makeProvider: () => Promise<{ provider: AuthProvider; username: string; password: string }>,
) {
  it('authenticate + verify round-trips a valid credential', async () => {
    const { provider, username, password } = await makeProvider();
    const res = await provider.authenticate({ username, password });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect((await provider.verify(res.session.token))?.userId).toBe(username);
  });

  it('rejects a bad password', async () => {
    const { provider, username } = await makeProvider();
    expect((await provider.authenticate({ username, password: 'wrong-xyz' })).ok).toBe(false);
  });

  it('revoke invalidates a single session', async () => {
    const { provider, username, password } = await makeProvider();
    const res = await provider.authenticate({ username, password });
    if (!res.ok) throw new Error('setup');
    await provider.revoke(res.session.token);
    expect(await provider.verify(res.session.token)).toBeNull();
  });

  it('revokeAll invalidates a still-unexpired session (the property a naive stateless impl fails)', async () => {
    const { provider, username, password } = await makeProvider();
    const res = await provider.authenticate({ username, password });
    if (!res.ok) throw new Error('setup');
    await provider.revokeAll(username);
    expect(await provider.verify(res.session.token)).toBeNull();
  });

  it('refresh yields a new session that verifies to the same user', async () => {
    const { provider, username, password } = await makeProvider();
    const res = await provider.authenticate({ username, password });
    if (!res.ok) throw new Error('setup');
    const next = await provider.refresh(res.session.token);
    expect(next).not.toBeNull();
    // A provider that just returns null (or a junk token) from refresh must fail here.
    expect((await provider.verify(next!.token))?.userId).toBe(username);
  });

  it('revoke invalidates ONLY the target session, not other live ones', async () => {
    const { provider, username, password } = await makeProvider();
    const a = await provider.authenticate({ username, password });
    const b = await provider.authenticate({ username, password });
    if (!a.ok || !b.ok) throw new Error('setup');
    await provider.revoke(a.session.token);
    // A provider implementing revoke() as revokeAll() would wrongly kill b too.
    expect(await provider.verify(a.session.token)).toBeNull();
    expect((await provider.verify(b.session.token))?.userId).toBe(username);
  });
}
