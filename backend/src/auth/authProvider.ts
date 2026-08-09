import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { Principal, Session } from './sessionStore.js';
import { env } from '../config/env.js';
import { OpaqueTokenProvider } from './providers/opaqueTokenProvider.js';

export type { Principal, Session };
export type AuthResult =
  | { ok: true; principal: Principal; session: Session }
  | { ok: false; error: string };

export class NotSupportedError extends Error {
  constructor(method: string) { super(`AuthProvider.${method} not supported by this provider`); }
}

export interface AuthProvider {
  verify(rawCredential: string): Promise<Principal | null>;
  authenticate(input: { username: string; password: string; anonToken?: string }): Promise<AuthResult>;
  issue(userId: string): Promise<Session>;
  revoke(rawCredential: string): Promise<boolean>;
  revokeAll(userId: string): Promise<number>;
  refresh(rawCredential: string): Promise<Session | null>;
}

export function makeAuthProvider(ctx: { db: Kysely<DB>; sandbox: boolean }): AuthProvider {
  switch (env.AUTH_PROVIDER) {
    case 'opaque':
      return new OpaqueTokenProvider(ctx);
    default:
      // 'jwt'/'cognito' are declared in the env enum but not implemented yet.
      // Fail loud rather than silently running opaque under a misleading config.
      throw new Error(`AUTH_PROVIDER="${env.AUTH_PROVIDER}" is not implemented (only "opaque")`);
  }
}
