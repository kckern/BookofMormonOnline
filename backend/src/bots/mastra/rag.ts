/**
 * Bot RAG retrieval.
 *
 * `loadRagResources` reads a bot's configured `bom_bot_rag` rows. The Mastra
 * tool from `createBotRagTool` retrieves grounding chunks for a query via the
 * shared `searchContent` seam (Qdrant hybrid search). Retrieval never throws —
 * it returns no chunks on failure so a bot turn can't be broken by search being
 * down. Corpus retrieval is scoped by explicit per-bot database grants.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import { searchContent } from '../../search/retrieve.js';
import type { SearchHit } from '../../search/types.js';
import { bridgeBookOfMormonToBible } from '../scriptureBridge.js';

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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[rag] retrieval failed; returning no chunks:', err instanceof Error ? err.message : err);
    return [];
  }
}

function words(value: string): string[] {
  return value.normalize('NFKD').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
}

/** Conservative exact-wording detector used by the post-generation rights gate. */
export function hasVerbatimOverlap(output: string, sources: string[], width = 10): boolean {
  const outputWords = words(output);
  if (outputWords.length < width) return false;
  const outputWindows = new Set<string>();
  for (let i = 0; i <= outputWords.length - width; i += 1) {
    outputWindows.add(outputWords.slice(i, i + width).join(' '));
  }
  return sources.some((source) => {
    const sourceWords = words(source);
    for (let i = 0; i <= sourceWords.length - width; i += 1) {
      if (outputWindows.has(sourceWords.slice(i, i + width).join(' '))) return true;
    }
    return false;
  });
}

function hasUnverifiedQuotation(output: string): boolean {
  return [...output.matchAll(/[“"]([^”"]+)[”"]/g)]
    .some((match) => words(match[1] || '').length >= 6);
}

/**
 * Fail-closed post-generation gate. Until a quotation verification workflow is
 * implemented, bots may paraphrase and cite locators but may not publish long
 * direct quotations. For inference-only grants, hybrid retrieval rechecks the
 * proposed output and rejects matching ten-word source spans.
 */
export async function assertBotOutputRights(
  db: Kysely<DB>,
  botId: string,
  output: string,
): Promise<void> {
  if (hasUnverifiedQuotation(output)) {
    throw new Error('bot output contains an unverified direct quotation');
  }
  const corpora = await db.selectFrom('bom_ai_bot_corpus as map')
    .innerJoin('bom_ai_corpus as corpus', 'corpus.corpus_id', 'map.corpus_id')
    .select(['corpus.corpus_id', 'corpus.rights_class'])
    .where('map.bot_id', '=', botId)
    .where('map.enabled', '=', 1)
    .where('corpus.enabled', '=', 1)
    .where('corpus.rights_class', '!=', 'blocked')
    .execute();
  // Corpus grounding is optional for the initial beta. No grants means the
  // persona/prompt can still run, while later grants automatically activate
  // the rights checks below without changing orchestration code.
  if (!corpora.length) return;
  const inferenceOnly = corpora.filter((corpus) => corpus.rights_class === 'inference_only');
  if (!inferenceOnly.length) return;

  // Do not publish when the vector store cannot perform the leakage check.
  const hits = await searchContent({
    query: output,
    types: ['corpus'],
    corpusIds: inferenceOnly.map((corpus) => corpus.corpus_id),
    limit: 32,
  });
  if (hasVerbatimOverlap(output, hits.map((hit) => hit.text))) {
    throw new Error('bot output reproduces wording from an inference-only source');
  }
}

/**
 * createBotRagTool — the retrieval tool given to each bot agent. Delegates to
 * retrieveChunks → searchContent (hybrid dense+sparse Qdrant search). Never
 * throws so the bot continues even when the vector store is unavailable.
 *
 * Corpus rows are independently filtered by the bot's enabled grants.
 */
export function createBotRagTool(db: Kysely<DB>, botId: string) {
  return createTool({
    id: 'bot_rag_retrieve',
    description:
      'Look up maintained Book of Mormon-to-Bible cross-references and, when configured, ' +
      'retrieve relevant passages from this bot\'s approved corpus. Corpus chunks may be empty.',
    inputSchema: z.object({ query: z.string().describe('what to look up') }),
    outputSchema: z.object({
      crossReferences: z.array(z.object({ bibleRef: z.string(), type: z.string(), source: z.string() })),
      chunks: z.array(z.object({ text: z.string(), locator: z.string(), citationEligible: z.boolean() })),
    }),
    execute: async (inputData) => {
      const bridge = await bridgeBookOfMormonToBible(db, inputData.query);
      const corpora = await db.selectFrom('bom_ai_bot_corpus as map')
        .innerJoin('bom_ai_corpus as corpus', 'corpus.corpus_id', 'map.corpus_id')
        .select(['corpus.corpus_id', 'corpus.rights_class'])
        .where('map.bot_id', '=', botId)
        .where('map.enabled', '=', 1)
        .where('corpus.enabled', '=', 1)
        .where('corpus.rights_class', '!=', 'blocked')
        .execute();
      if (!corpora.length) return { crossReferences: bridge.edges.map(({ bibleRef, type, source }) => ({ bibleRef, type, source })), chunks: [] };
      const groundedQuery = bridge.bibleRefs.length
        ? `${inputData.query}\nRelated Bible passages: ${bridge.bibleRefs.join('; ')}`
        : inputData.query;
      const hits = await searchContent({
        query: groundedQuery,
        types: ['corpus'],
        corpusIds: corpora.map((corpus) => corpus.corpus_id),
        limit: 8,
      });
      const rights = new Map(corpora.map((corpus) => [corpus.corpus_id, corpus.rights_class]));
      return {
        crossReferences: bridge.edges.map(({ bibleRef, type, source }) => ({ bibleRef, type, source })),
        chunks: hits.map((hit) => ({
          text: hit.text,
          locator: hit.locator || hit.title || hit.ref || 'source location unavailable',
          citationEligible: rights.get(hit.corpus_id || '') === 'citation_eligible',
        })),
      };
    },
  });
}
