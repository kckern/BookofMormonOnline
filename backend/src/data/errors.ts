/**
 * DB error helpers. Lets resolvers distinguish a benign duplicate-key (e.g. "already
 * a member") from a genuine write failure, so they don't mask real errors as success.
 */

/** True when the error is a MySQL duplicate-key violation (ER_DUP_ENTRY / errno 1062). */
export function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: string; errno?: number } | null | undefined;
  return e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062;
}
