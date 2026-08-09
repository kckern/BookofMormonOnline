import { describe } from 'vitest';
import { FakeJwtProvider } from '../../src/auth/providers/fakeJwtProvider.js';
import { runAuthProviderContract } from './authProvider.contract.js';

describe('AuthProvider contract — FakeJwtProvider', () => {
  runAuthProviderContract(async () => {
    const provider = new FakeJwtProvider();
    provider.seed('alice', 'pw-alice');
    return { provider, username: 'alice', password: 'pw-alice' };
  });
});
