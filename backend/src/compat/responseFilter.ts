/**
 * COMPAT SHIM — legacy Apollo `formatResponse` replication.
 *
 * The legacy backend (src/config/apollo.ts) deletes every object key whose value
 * is `''`, `null`, or an empty array — recursively — before serializing `data`.
 * All regression baselines (tests/baselines/) were captured through that filter,
 * so byte-identical output requires it. Quirks preserved deliberately:
 *   - `0` and `false` are KEPT (only '', null, [] are stripped)
 *   - null/empty items INSIDE arrays are kept (only object keys are deleted)
 *   - strings/primitives inside arrays are untouched
 * Retirable only with a deliberate full recapture + frontend audit.
 */
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Object.prototype.toString.call(v) === '[object Object]';

export function stripEmptyDeep(node: unknown): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      if (isPlainObject(item) || Array.isArray(item)) stripEmptyDeep(item);
    }
    return;
  }
  if (!isPlainObject(node)) return;
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
      delete node[key];
    } else if (isPlainObject(value)) {
      stripEmptyDeep(value);
    } else if (Array.isArray(value)) {
      stripEmptyDeep(value);
    }
  }
}
