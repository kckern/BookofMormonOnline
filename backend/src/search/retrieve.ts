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
