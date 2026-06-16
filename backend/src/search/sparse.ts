/** FNV-1a hash a token to a stable 32-bit sparse-vector index. */
function tokenIndex(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) { h ^= token.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Deterministic keyword sparse vector: one entry per distinct lowercased
 * alphanumeric term, weight 1. Used identically on the index and query sides
 * so the Qdrant `keywords` sparse vector is coherent.
 */
export function textToSparse(text: string): { indices: number[]; values: number[] } {
  const terms = [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  return { indices: terms.map(tokenIndex), values: terms.map(() => 1) };
}
