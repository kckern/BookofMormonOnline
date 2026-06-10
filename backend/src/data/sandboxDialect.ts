/**
 * sandboxDialect.ts — enforce read-only "sandbox" at the Kysely DRIVER layer.
 *
 * Legacy sandbox (src/library/sandboxMode.ts) monkey-patched Sequelize; the
 * green-field first attempt was `runWrite()` (src/data/writes.ts), a per-CALL
 * helper. That is a discipline every resolver must remember — and the messenger
 * mutations didn't, writing through raw `ctx.db.insertInto(...).execute()` which
 * bypassed sandbox entirely (safe here only because the dev DB user is read-only,
 * but it would mutate a writable "sandbox" DB).
 *
 * This wraps the dialect's driver so that ANY INSERT/UPDATE/DELETE/MERGE built
 * with the Kysely query builder is intercepted at the connection and returns a
 * synthetic empty result instead of hitting MySQL — when SANDBOX is on. Now every
 * write path (resolvers, services, socket handlers) is uniformly suppressed and
 * raw `ctx.db` writes are safe by construction; no caller has to remember a wrapper.
 *
 * Limitation (documented): only query-builder writes carry a write node kind.
 * A raw `sql\`UPDATE …\`` template compiles to a RawNode and is NOT detected — keep
 * mutations on the query builder. (Same gap the legacy notes call out.)
 */
import type {
  CompiledQuery,
  DatabaseConnection,
  Dialect,
  Driver,
  Kysely,
  QueryResult,
  TransactionSettings,
} from 'kysely';

const WRITE_KINDS = new Set([
  'InsertQueryNode',
  'UpdateQueryNode',
  'DeleteQueryNode',
  'MergeQueryNode',
]);

const noted = new Set<string>();
function noteOnce(kind: string): void {
  if (noted.has(kind)) return;
  noted.add(kind);
  // eslint-disable-next-line no-console
  console.log(`🧪 sandbox: ${kind} suppressed at the driver (no write reaches MySQL)`);
}

function emptyResult<R>(): QueryResult<R> {
  return { rows: [], numAffectedRows: 0n, numChangedRows: 0n };
}

function isWrite(cq: CompiledQuery): boolean {
  return WRITE_KINDS.has(cq.query.kind);
}

/** Connection wrapper that no-ops write statements. */
class SandboxConnection implements DatabaseConnection {
  constructor(readonly inner: DatabaseConnection) {}

  async executeQuery<R>(cq: CompiledQuery): Promise<QueryResult<R>> {
    if (isWrite(cq)) {
      noteOnce(cq.query.kind);
      return emptyResult<R>();
    }
    return this.inner.executeQuery<R>(cq);
  }

  async *streamQuery<R>(cq: CompiledQuery, chunkSize: number): AsyncIterableIterator<QueryResult<R>> {
    if (isWrite(cq)) {
      noteOnce(cq.query.kind);
      return;
    }
    yield* this.inner.streamQuery<R>(cq, chunkSize);
  }
}

const unwrap = (c: DatabaseConnection): DatabaseConnection =>
  c instanceof SandboxConnection ? c.inner : c;

/** Wrap a Dialect so its driver suppresses query-builder writes when sandboxed. */
export function sandboxDialect(inner: Dialect): Dialect {
  return {
    createAdapter: () => inner.createAdapter(),
    createQueryCompiler: () => inner.createQueryCompiler(),
    createIntrospector: (db: Kysely<unknown>) => inner.createIntrospector(db),
    createDriver: (): Driver => {
      const d = inner.createDriver();
      return {
        init: () => d.init(),
        acquireConnection: async () => new SandboxConnection(await d.acquireConnection()),
        beginTransaction: (c: DatabaseConnection, s: TransactionSettings) => d.beginTransaction(unwrap(c), s),
        commitTransaction: (c: DatabaseConnection) => d.commitTransaction(unwrap(c)),
        rollbackTransaction: (c: DatabaseConnection) => d.rollbackTransaction(unwrap(c)),
        releaseConnection: (c: DatabaseConnection) => d.releaseConnection(unwrap(c)),
        destroy: () => d.destroy(),
      };
    },
  };
}
