/** Entity kinds indexed in the shared `bom_content` collection. Phase 1 uses 'verse'. */
export type ContentType = 'verse' | 'person' | 'place' | 'page' | 'narration' | 'commentary' | 'event' | 'matter' | 'corpus';

/** One Qdrant point to upsert. */
export interface IndexPoint {
  id: string;            // deterministic uuidv5
  type: ContentType;
  entity_id: string;     // e.g. verse_id as string
  chunkIndex: number;
  text: string;
  title: string | null;   // display title (entity name, page/section title); null for verses
  ref: string | null;
  slug: string | null;
  lang: string;
  version: string | null;
  corpus_id?: string | null;
  locator?: string | null;
  rights_class?: 'citation_eligible' | 'inference_only' | 'blocked' | null;
  dense: number[];       // embedding vector
  sparse: { indices: number[]; values: number[] }; // keyword sparse vector
}

/** A ranked retrieval hit returned by searchContent. */
export interface SearchHit {
  type: ContentType;
  entity_id: string;
  score: number;
  text: string;
  title: string | null;
  ref: string | null;
  slug: string | null;
  version: string | null;
  corpus_id?: string | null;
  locator?: string | null;
  rights_class?: 'citation_eligible' | 'inference_only' | 'blocked' | null;
}

/** Arguments to the shared retrieval seam. */
export interface SearchContentArgs {
  query: string;
  types?: ContentType[];
  lang?: string;
  version?: string[];
  corpusIds?: string[];
  limit?: number;
}
