import type { SearchContentArgs, SearchHit, ContentType } from './types.js';
import { embedOne } from './embed.js';
import { getQdrant, COLLECTION } from './qdrant.js';

/** Build a Qdrant payload filter from the args, or undefined when no filters apply. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildFilter(args: SearchContentArgs): any | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const must: any[] = [];
  if (args.types?.length) must.push({ key: 'type', match: { any: args.types } });
  if (args.lang) must.push({ key: 'lang', match: { value: args.lang } });
  if (args.version?.length) must.push({ key: 'version', match: { any: args.version } });
  return must.length ? { must } : undefined;
}

/** Hash a token to a stable 32-bit sparse-vector index. */
function tokenIndex(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) { h ^= token.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Deterministic keyword sparse vector: one entry per distinct lowercased term. */
export function queryToSparse(query: string): { indices: number[]; values: number[] } {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  return { indices: terms.map(tokenIndex), values: terms.map(() => 1) };
}

/** The shared retrieval seam. Throws if Qdrant/embeddings are unavailable (caller falls back). */
export async function searchContent(args: SearchContentArgs): Promise<SearchHit[]> {
  const limit = args.limit ?? 50;
  const dense = await embedOne(args.query);
  const sparse = queryToSparse(args.query);
  const filter = buildFilter(args);

  const res = await getQdrant().query(COLLECTION, {
    prefetch: [
      { query: dense, using: 'dense', limit, filter },
      { query: { indices: sparse.indices, values: sparse.values }, using: 'keywords', limit, filter },
    ],
    query: { fusion: 'rrf' },
    limit,
    with_payload: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res.points ?? []).map((p: any) => ({
    type: (p.payload?.type ?? 'verse') as ContentType,
    entity_id: String(p.payload?.entity_id ?? ''),
    score: p.score ?? 0,
    text: String(p.payload?.text ?? ''),
    ref: (p.payload?.ref ?? null) as string | null,
    slug: (p.payload?.slug ?? null) as string | null,
    version: (p.payload?.version ?? null) as string | null,
  }));
}
