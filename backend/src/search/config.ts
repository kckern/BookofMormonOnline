/** Search/RAG configuration, read from env once per call. */
export interface SearchConfig {
  backend: 'qdrant' | 'like';
  qdrantUrl: string;
  qdrantApiKey: string | undefined;
  embedModel: string;
}

export function getSearchConfig(): SearchConfig {
  const raw = process.env['SEARCH_BACKEND'];
  const backend = raw === 'qdrant' ? 'qdrant' : 'like';
  return {
    backend,
    qdrantUrl: process.env['QDRANT_URL'] || 'http://127.0.0.1:6333',
    qdrantApiKey: process.env['QDRANT_API_KEY'] || undefined,
    embedModel: process.env['SEARCH_EMBED_MODEL'] || 'text-embedding-3-small',
  };
}
