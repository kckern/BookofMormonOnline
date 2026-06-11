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

/**
 * createBotRagTool — the retrieval tool given to each bot agent. STUB: returns no
 * chunks until the vector infra is built. The signature + wiring are final so
 * only the `execute` body changes later.
 */
export function createBotRagTool(db: Kysely<DB>, botId: string) {
  return createTool({
    id: 'bot_rag_retrieve',
    description:
      'Retrieve reference material (the bot\'s own works, sources) relevant to a query. ' +
      'Returns grounding passages. (RAG infrastructure pending — currently returns nothing.)',
    inputSchema: z.object({ query: z.string().describe('what to look up') }),
    outputSchema: z.object({ chunks: z.array(z.string()) }),
    execute: async () => {
      // TODO(rag): loadRagResources(db, { botId }) → embed query → vector search → top-k chunks.
      void db;
      void botId;
      return { chunks: [] };
    },
  });
}
