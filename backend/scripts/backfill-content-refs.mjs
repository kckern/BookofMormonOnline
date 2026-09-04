// Phase 4 backfill: populate messenger_messages.anchor + content_refs from the
// legacy model, so posts carry canonical references. Additive (only writes the
// two new columns; never touches legacy columns), so re-runnable and reversible
// (set them NULL to undo). Dry-run default; --apply writes to bom_prd.
//
//   anchor      = custom_type when it's a page slug (not '', 'comment', 'formatted_comment')
//   content_refs = references built from:
//     - link_type='text'  ordinal -> {type:'verse', id:verseId} (lift: bom_slug PG /
//        leaf-slug -> bom_text.min_verse_id); unliftable -> {type:'legacy_text', slug, ordinal}
//     - link_type='com'   -> {type:'commentary', id}
//     - link_type='img'   -> {type:'image', id}
//     - link_type='section' -> {type:'section', id, slug}
//     - link_type='fax'   -> {type:'fax', id, aux}
//     - messenger_highlights rows -> {role:'highlight', span:{text}}
//     - NO link but the body contains a scripture ref (bot posts): detectReferences
//        -> {type:'verse', id:verseId, role:'subject'} + anchor = that verse's page slug
//   role = 'highlight' when message body is '•', else 'subject'.
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';
import { lookup as lookupReference, detectReferences } from 'scripture-guide';

const APPLY = process.argv.includes('--apply');
const env = {};
for (const l of readFileSync('/run/user/1003/bom-dev.env', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const c = await mysql.createConnection({ host: env.MYSQL_HOST, port: +(env.MYSQL_PORT||3306), user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DB }); // pragma: allowlist secret

const NON_ANCHOR = new Set(['', 'comment', 'formatted_comment']);
const pgCache = new Map();
async function pgLink(slug) {
  if (pgCache.has(slug)) return pgCache.get(slug);
  const [[pg]] = await c.query("SELECT link FROM bom_slug WHERE slug=? AND type='PG' LIMIT 1", [slug]);
  const v = pg?.link ?? null; pgCache.set(slug, v); return v;
}
async function legacyTextToVerseId(slug, ordinal) {
  let page = await pgLink(slug);
  if (!page) { const leaf = String(slug).split('/').pop(); if (leaf && leaf !== slug) page = await pgLink(leaf); }
  if (!page) return null;
  const [[u]] = await c.query("SELECT min_verse_id FROM bom_text WHERE page=? AND link=? LIMIT 1", [page, ordinal]);
  return u?.min_verse_id ? Number(u.min_verse_id) : null;
}
const verseSlugCache = new Map();
async function verseIdToSlug(vid) {
  if (verseSlugCache.has(vid)) return verseSlugCache.get(vid);
  // bom_text unit for the verse -> page guid -> PG slug
  const [[u]] = await c.query("SELECT page FROM bom_text WHERE min_verse_id=? LIMIT 1", [vid]);
  let slug = null;
  if (u?.page) { const [[s]] = await c.query("SELECT slug FROM bom_slug WHERE link=? AND type='PG' LIMIT 1", [u.page]); slug = s?.slug ?? null; }
  verseSlugCache.set(vid, slug); return slug;
}

const [rows] = await c.query(
  "SELECT message_id, custom_type, message, link_type, link_target, link_aux FROM messenger_messages WHERE message_type='MESG' AND (is_deleted=0 OR is_deleted IS NULL)");
const stats = { total: rows.length, anchored: 0, verse: 0, legacyText: 0, com: 0, img: 0, section: 0, fax: 0, highlights: 0, inlineDetected: 0, refsRows: 0 };
let n = 0;
for (const m of rows) {
  const role = m.message === '•' ? 'highlight' : 'subject';
  let anchor = (m.custom_type && !NON_ANCHOR.has(m.custom_type)) ? m.custom_type : null;
  const refs = [];
  if (m.link_type === 'text') {
    const vid = await legacyTextToVerseId(m.custom_type, Number(m.link_target));
    if (vid) { refs.push({ type: 'verse', id: vid, role }); stats.verse++; }
    else { refs.push({ type: 'legacy_text', slug: m.custom_type, ordinal: Number(m.link_target), role }); stats.legacyText++; }
  } else if (m.link_type === 'com') { refs.push({ type: 'commentary', id: Number(m.link_target), role }); stats.com++; }
  else if (m.link_type === 'img') { refs.push({ type: 'image', id: Number(m.link_target), role }); stats.img++; }
  else if (m.link_type === 'section') { refs.push({ type: 'section', id: m.link_target, slug: m.custom_type, role }); stats.section++; }
  else if (m.link_type === 'fax') { refs.push({ type: 'fax', id: m.link_target, aux: m.link_aux, role }); stats.fax++; }
  else if (!m.link_type && m.message && m.message !== '•') {
    // link-less post (e.g. reformer bot): detect an inline scripture reference in
    // the body. detectReferences uses a CALLBACK per match (a text-rewriter) —
    // collect the strings (same pattern as scriptureBridge.detectReferenceStrings).
    const found = [];
    try { detectReferences(m.message, (r) => { found.push(r); return r; }); } catch { /* ignore */ }
    const refStr = found.length ? found[0] : null;
    const vids = refStr ? (lookupReference(String(refStr).replace(/[–—]/g,'-'))?.verse_ids ?? []) : [];
    if (vids.length) {
      const vid = [...new Set(vids)].sort((a,z)=>a-z)[0];
      refs.push({ type: 'verse', id: vid, role: 'subject' });
      stats.inlineDetected++;
      if (!anchor) { const s = await verseIdToSlug(vid); if (s) anchor = s; }
    }
  }
  // highlights
  const [hls] = await c.query("SELECT text FROM messenger_highlights WHERE message_id=? ORDER BY ordinal", [m.message_id]);
  for (const h of hls) { refs.push({ type: 'highlight', role: 'highlight', span: { text: h.text } }); stats.highlights++; }

  if (anchor) stats.anchored++;
  if (refs.length) stats.refsRows++;
  if (APPLY && (anchor || refs.length)) {
    await c.query("UPDATE messenger_messages SET anchor=?, content_refs=? WHERE message_id=?",
      [anchor, refs.length ? JSON.stringify(refs) : null, m.message_id]);
  }
  if (++n % 1000 === 0) console.log(`  …${n}/${rows.length}`);
}
console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'}:`, JSON.stringify(stats, null, 2));
await c.end();
