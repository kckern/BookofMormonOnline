// Reports how many legacy references (link_type='text') lift to a canonical
// verse-id via the same path media/fax legacyUnitToVerseIds uses:
//   bom_slug(slug,type=PG).link -> bom_text(page,link).heading -> lookup.verse_ids
// Read-only. Run: node scripts/derisk-reference-lift.mjs
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';
import { lookup as lookupReference } from 'scripture-guide';
const env = {};
for (const l of readFileSync('/run/user/1003/bom-dev.env', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const c = await mysql.createConnection({ host: env.MYSQL_HOST, port: +(env.MYSQL_PORT||3306), user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DB }); // pragma: allowlist secret
const [rows] = await c.query(
  "SELECT custom_type slug, link_target id FROM messenger_messages WHERE link_type='text' AND custom_type<>'' AND link_target REGEXP '^[0-9]+$'");
let ok = 0, empty = 0; const fails = [];
const pageCache = new Map();
for (const r of rows) {
  let pageLink = pageCache.get(r.slug);
  if (pageLink === undefined) {
    const [[pg]] = await c.query("SELECT link FROM bom_slug WHERE slug=? AND type='PG' LIMIT 1", [r.slug]);
    pageLink = pg?.link ?? null; pageCache.set(r.slug, pageLink);
  }
  if (!pageLink) { empty++; fails.push(`no-page ${r.slug}/${r.id}`); continue; }
  const [[unit]] = await c.query("SELECT heading FROM bom_text WHERE page=? AND link=? LIMIT 1", [pageLink, r.id]);
  const ids = unit?.heading ? (lookupReference(String(unit.heading).replace(/[–—]/g,'-'))?.verse_ids ?? []) : [];
  if (ids.length) ok++; else { empty++; fails.push(`no-ids ${r.slug}/${r.id} "${unit?.heading ?? ''}"`); }
}
console.log(`text links: ${rows.length}  lifted=${ok}  failed=${empty}`);
console.log('sample failures:', fails.slice(0, 20));
await c.end();
