/**
 * Ingest DB-approved reformer sources into Qdrant with corpus/rights scoping.
 * No source inventory is embedded in code: bom_ai_corpus is the authority.
 *
 * Dry run: npm run corpus:ingest -- --all
 * Apply:   npm run corpus:ingest -- --all --apply
 */
import 'dotenv/config';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { promisify } from 'node:util';
import { closeDb, getDb } from '../src/data/db.js';
import { chunkText } from '../src/search/chunk.js';
import { embedBatch } from '../src/search/embed.js';
import { upsertPoints } from '../src/search/indexer.js';
import { pointId } from '../src/search/points.js';
import { ensureCollection } from '../src/search/qdrant.js';
import { textToSparse } from '../src/search/sparse.js';
import type { IndexPoint } from '../src/search/types.js';

const run = promisify(execFile);
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const selected = args.includes('--all') ? null : args[args.indexOf('--corpus') + 1];
if (!args.includes('--all') && !selected) throw new Error('pass --all or --corpus <corpus_id>');

function localPath(uri: string): string {
  if (uri.startsWith('file://')) return new URL(uri).pathname;
  if (uri.startsWith('/')) return uri;
  throw new Error(`only local absolute/file:// sources can be ingested: ${uri}`);
}

async function extract(path: string): Promise<{ text: string; paged: boolean }> {
  const extension = extname(path).toLowerCase();
  if (['.txt', '.md', '.html', '.htm'].includes(extension)) {
    return { text: await readFile(path, 'utf8'), paged: false };
  }
  if (extension === '.pdf') {
    const { stdout } = await run('pdftotext', ['-layout', path, '-'], { maxBuffer: 512 * 1024 * 1024 });
    return { text: stdout, paged: true };
  }
  if (['.epub', '.docx', '.odt', '.rtf'].includes(extension)) {
    const { stdout } = await run('pandoc', [path, '-t', 'plain'], { maxBuffer: 512 * 1024 * 1024 });
    return { text: stdout, paged: false };
  }
  throw new Error(`unsupported source extension: ${extension}`);
}

function units(text: string, title: string, paged: boolean): Array<{ text: string; locator: string }> {
  const pages = paged ? text.split('\f') : [text];
  const out: Array<{ text: string; locator: string }> = [];
  pages.forEach((page, pageIndex) => {
    chunkText(page.replace(/\0/g, '').trim(), 1200).forEach((chunk, chunkIndex) => {
      const locator = paged
        ? `${title}, page ${pageIndex + 1}`
        : `${title}, section ${chunkIndex + 1}`;
      out.push({ text: chunk, locator });
    });
  });
  return out;
}

async function main(): Promise<void> {
  const db = getDb();
  try {
    let query = db.selectFrom('bom_ai_corpus').selectAll().where('enabled', '=', 1)
      .where('rights_class', '!=', 'blocked');
    if (selected) query = query.where('corpus_id', '=', selected);
    const corpora = await query.execute();
    if (!corpora.length) throw new Error('no enabled matching corpus records');
    if (apply) await ensureCollection();

    for (const corpus of corpora) {
      const path = localPath(corpus.source_uri);
      const bytes = await readFile(path);
      const sha = createHash('sha256').update(bytes).digest('hex');
      if (apply && !corpus.source_sha256) {
        throw new Error(`${corpus.corpus_id}: apply refused without a reviewed source_sha256`);
      }
      if (corpus.source_sha256 && corpus.source_sha256 !== sha) {
        throw new Error(`${corpus.corpus_id}: SHA-256 differs from approved source`);
      }
      const extracted = await extract(path);
      const chunks = units(extracted.text, corpus.title, extracted.paged);
      console.log(`${corpus.corpus_id}: ${chunks.length} chunks; ${corpus.rights_class}; sha256=${sha}`);
      if (!apply) continue;

      for (let start = 0; start < chunks.length; start += 64) {
        const batch = chunks.slice(start, start + 64);
        const vectors = await embedBatch(batch.map((chunk) => chunk.text));
        const points: IndexPoint[] = batch.map((chunk, offset) => {
          const chunkIndex = start + offset;
          return {
            id: pointId('corpus', corpus.corpus_id, chunkIndex),
            type: 'corpus',
            entity_id: `${corpus.corpus_id}:${chunkIndex}`,
            chunkIndex,
            text: chunk.text,
            title: corpus.title,
            ref: null,
            slug: null,
            lang: 'en',
            version: corpus.edition,
            corpus_id: corpus.corpus_id,
            locator: chunk.locator,
            rights_class: corpus.rights_class,
            dense: vectors[offset]!,
            sparse: textToSparse(chunk.text),
          };
        });
        await upsertPoints(points);
      }
      await db.updateTable('bom_ai_corpus').set({ source_sha256: sha, ingested_at: new Date() })
        .where('corpus_id', '=', corpus.corpus_id).execute();
    }
  } finally {
    await closeDb();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
