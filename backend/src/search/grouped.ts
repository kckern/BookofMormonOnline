import type { ContentType, SearchHit } from './types.js';
import { searchVectors, queryWithVectors } from './retrieve.js';

export const GROUP_TYPES: ContentType[] = ['person', 'place', 'commentary', 'narration', 'page', 'event'];

export interface ResultCard { slug: string | null; title: string | null; snippet: string; ref: string | null; score: number }

export function hitToCard(h: SearchHit): ResultCard {
  return { slug: h.slug, title: h.title, snippet: h.text, ref: h.ref, score: h.score };
}

/** Embed once, fan out one type-filtered query per non-verse group in parallel; each group degrades to [] on failure. */
export async function searchGroups(query: string, lang: string, perGroup = 8): Promise<Record<string, ResultCard[]>> {
  const vectors = await searchVectors(query);
  const entries = await Promise.all(
    GROUP_TYPES.map(async (type) => {
      try {
        const hits = await queryWithVectors(vectors, { query, types: [type], lang, limit: perGroup });
        return [type, hits.map(hitToCard)] as const;
      } catch {
        return [type, [] as ResultCard[]] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
