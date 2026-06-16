import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getSearchConfig } from './config.js';

/** Default embedding model from config. Passed explicitly in tests for mocking. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defaultEmbedModel(): any {
  return openai.textEmbeddingModel(getSearchConfig().embedModel);
}

/** Embed a single string → vector. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function embedOne(value: string, model: any = defaultEmbedModel()): Promise<number[]> {
  const { embedding } = await embed({ model, value });
  return embedding;
}

/** Embed many strings → vectors (order preserved). Empty in → empty out. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function embedBatch(values: string[], model: any = defaultEmbedModel()): Promise<number[][]> {
  if (!values.length) return [];
  const { embeddings } = await embedMany({ model, values });
  return embeddings;
}
