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
}
