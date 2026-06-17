import type { SearchContentArgs, SearchHit, ContentType } from './types.js';
import { embedOne } from './embed.js';
import { getQdrant, COLLECTION } from './qdrant.js';
import { textToSparse } from './sparse.js';

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

/** Deterministic keyword sparse vector for a query (see textToSparse). */
export function queryToSparse(query: string): { indices: number[]; values: number[] } {
  return textToSparse(query);
}

/** Dense + sparse vectors for a single query string. */
export interface QueryVectors {
  dense: number[];
  sparse: { indices: number[]; values: number[] };
}

/** Build dense+sparse vectors for a query (embeds dense once). Injectable embedder for tests. */
export async function searchVectors(
  query: string,
  embedder: (q: string) => Promise<number[]> = embedOne,
): Promise<QueryVectors> {
  const dense = await embedder(query);
  return { dense, sparse: queryToSparse(query) };
}

/** Hybrid Qdrant query with prebuilt vectors + the args' filters. */
export async function queryWithVectors(vectors: QueryVectors, args: SearchContentArgs): Promise<SearchHit[]> {
  const limit = args.limit ?? 50;
  const filter = buildFilter(args);
  const res = await getQdrant().query(COLLECTION, {
    prefetch: [
      { query: vectors.dense, using: 'dense', limit, filter },
      { query: { indices: vectors.sparse.indices, values: vectors.sparse.values }, using: 'keywords', limit, filter },
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
    title: (p.payload?.title ?? null) as string | null,
    ref: (p.payload?.ref ?? null) as string | null,
    slug: (p.payload?.slug ?? null) as string | null,
    version: (p.payload?.version ?? null) as string | null,
  }));
}

/** The shared retrieval seam. Throws if Qdrant/embeddings are unavailable (caller falls back). */
export async function searchContent(args: SearchContentArgs): Promise<SearchHit[]> {
  const vectors = await searchVectors(args.query);
  return queryWithVectors(vectors, args);
}
