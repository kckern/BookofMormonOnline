/**
 * Bot RAG retrieval — STUB.
 *
 * A Mastra tool the bot agents are wired with now, so the retrieval interface
 * exists before the infra does. Future work: read the bot's `bom_bot_rag` rows
 * (resource_type / uri / config) and query a vector store (pgvector / Mastra
 * RAG) to return grounding chunks. For now it returns nothing.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import { searchContent } from '../../search/retrieve.js';
import type { SearchHit } from '../../search/types.js';

export interface RagResource {
  id: number;
  resource_type: string;
  uri: string | null;
  config: unknown;
}

/** Load a bot's configured RAG resources (bot-level, tag-level, channel-level). */
export async function loadRagResources(
  db: Kysely<DB>,
  opts: { botId?: string; tags?: string[]; channelUrl?: string },
): Promise<RagResource[]> {
  const q = db.selectFrom('bom_bot_rag').select(['id', 'resource_type', 'uri', 'config']).where('enabled', '=', 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ors: Array<(eb: any) => any> = [];
  if (opts.botId) ors.push((eb) => eb('bot_id', '=', opts.botId));
  if (opts.channelUrl) ors.push((eb) => eb('channel_url', '=', opts.channelUrl));
  if (opts.tags?.length) ors.push((eb) => eb('tag', 'in', opts.tags));
  if (!ors.length) return [];
  const rows = await q.where((eb) => eb.or(ors.map((f) => f(eb)))).execute();
  return rows as unknown as RagResource[];
}

/** Retrieve grounding chunk texts for a query. Never throws — returns [] on failure. */
export async function retrieveChunks(
  query: string,
  retriever: (q: string) => Promise<SearchHit[]> = (q) => searchContent({ query: q, limit: 8 }),
): Promise<string[]> {
  try {
    const hits = await retriever(query);
    return hits.map((h) => h.text).filter((t) => t.length > 0);
  } catch {
    return [];
  }
}

/**
 * createBotRagTool — the retrieval tool given to each bot agent. Delegates to
 * retrieveChunks → searchContent (hybrid dense+sparse Qdrant search). Never
 * throws so the bot continues even when the vector store is unavailable.
 *
 * Phase 2: filter by loadRagResources(db, { botId }) resource types.
 */
export function createBotRagTool(db: Kysely<DB>, botId: string) {
  return createTool({
    id: 'bot_rag_retrieve',
    description:
      'Retrieve reference material (the bot\'s own works, sources) relevant to a query. ' +
      'Returns grounding passages.',
    inputSchema: z.object({ query: z.string().describe('what to look up') }),
    outputSchema: z.object({ chunks: z.array(z.string()) }),
    execute: async (inputData) => {
      // Phase 2: loadRagResources(db, { botId }) → filter by resource types.
      void db;
      void botId;
      return { chunks: await retrieveChunks(inputData.query) };
    },
  });
}
