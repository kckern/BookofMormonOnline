import { v5 as uuidv5 } from 'uuid';
import type { ContentType, SearchHit } from './types.js';

/** Fixed namespace so point IDs are stable across runs/machines.
 *  Using RFC 4122 DNS namespace as a seed — stable, well-known, valid UUIDv1. */
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/** Deterministic Qdrant point ID from (type, entity_id, chunkIndex). */
export function pointId(type: ContentType, entityId: string, chunkIndex: number): string {
  return uuidv5(`${type}:${entityId}:${chunkIndex}`, NAMESPACE);
}

/**
 * Reciprocal Rank Fusion of several ranked id lists.
 * score(id) = sum over lists of 1/(k + rank). Higher is better.
 */
export function fuseRrf(rankedLists: string[][], k: number): string[] {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    });
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Ranked, de-duplicated verse_ids from verse hits (best first). */
export function hitsToRankedVerseIds(hits: SearchHit[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hits) {
    if (h.type !== 'verse') continue;
    if (seen.has(h.entity_id)) continue;
    seen.add(h.entity_id);
    out.push(h.entity_id);
  }
  return out;
}
