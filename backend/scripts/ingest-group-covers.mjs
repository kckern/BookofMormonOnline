// Ingest ALL group cover images to our own S3, so runtime never depends on an
// external image domain (Sendbird is decommissioned; dicebear/Wikimedia are
// external). Rehosts to groups/<channel>.jpg under S3_PUBLIC_URL.
//
//   sources:
//     - Sendbird cover (real uploaded photo)  → fetch (follows 302→signed S3)
//     - Reformers (981706be…, null cover)     → Ferdinand Pauwels "95 theses" (public domain, Wikimedia)
//     - dicebear cover OR null                → self-GENERATED initials SVG (never fetch dicebear)
//     - already on S3_PUBLIC_URL host          → skip
//
// Modes: (default) dry-run report | --local writes JPEGs to /tmp to verify the
// pipeline (no S3/DB) | --apply uploads to S3 + updates cover_url. Runs on prod
// (S3 write needs the EC2 instance role). Reads DB creds from process.env.
import { readFileSync, writeFileSync } from 'fs';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const MODE = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--local') ? 'local' : 'dry';
const REFORMERS = '981706be763a135623f56e621e39f9b9';
const PAUWELS = 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Ferdinand_Pauwels_-_Luther_hammers_his_95_theses_to_the_door.jpg';

// DB creds: prefer process.env (prod container), fall back to the dev runtime file.
function loadEnv() {
  const e = { ...process.env };
  if (!e.MYSQL_HOST) {
    try {
      for (const l of readFileSync('/run/user/1003/bom-dev.env', 'utf8').split('\n')) {
        const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !e[m[1]]) e[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* not on dev */ }
  }
  return e;
}
const env = loadEnv();
const S3_PUBLIC_URL = (env.S3_PUBLIC_URL || 'https://assets.bookofmormon.online').replace(/\/+$/, '');
const publicHost = new URL(S3_PUBLIC_URL).host;

const initialsSvg = (name) => {
  const label = (name || 'Group').trim() || 'Group';
  const initials = label.split(/\s+/).slice(0, 2).map((w) => [...w][0] || '').join('').toUpperCase() || 'G';
  let h = 0; for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="hsl(${h},42%,36%)"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Georgia,serif" font-size="220" fill="#f2ead9">${initials}</text></svg>`);
};

const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };

async function sourceBufferFor(ch) {
  const cover = ch.cover_url;
  if (ch.channel_url === REFORMERS && !cover) {
    const r = await fetch(PAUWELS, { headers: { 'User-Agent': 'BoMOnline/1.0' } });
    return { buf: Buffer.from(await r.arrayBuffer()), kind: 'wikimedia(Pauwels 95 theses)' };
  }
  const host = cover ? hostOf(cover) : '';
  if (host === publicHost) return { buf: null, kind: 'already-s3 (skip)' };
  if (host.includes('sendbird.com')) {
    const r = await fetch(cover, { redirect: 'follow', headers: { 'User-Agent': 'BoMOnline/1.0' } });
    if (!r.ok) throw new Error(`sendbird fetch ${r.status}`);
    return { buf: Buffer.from(await r.arrayBuffer()), kind: 'sendbird→rehost' };
  }
  // dicebear (external) or null → leave cover_url NULL so the frontend renders
  // the SELF-HOSTED data-URI initials fallback (browser fonts, incl. CJK).
  // Don't rasterize SVG text here — the prod Alpine container has no fonts, so
  // sharp/librsvg renders tofu boxes (and Korean names would need CJK fonts).
  return { buf: null, kind: cover ? 'dicebear→fallback' : 'null→fallback', fallback: true };
}

const conn = await mysql.createConnection({ host: env.MYSQL_HOST, port: +(env.MYSQL_PORT || 3306), user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DB }); // pragma: allowlist secret
const [rows] = await conn.query("SELECT channel_url, name, cover_url FROM messenger_channels WHERE custom_type IN ('public','open') ORDER BY name");
const s3 = MODE === 'apply' ? new S3Client({ region: env.AWS_REGION || 'us-west-2' }) : null;
if (MODE === 'apply' && !env.S3_BUCKET) { console.error('ABORT: S3_BUCKET not set'); process.exit(1); }

console.log(`MODE=${MODE}  channels=${rows.length}  S3_PUBLIC_URL=${S3_PUBLIC_URL}\n`);
let done = 0, skip = 0, fail = 0;
for (const ch of rows) {
  try {
    const { buf, kind, fallback } = await sourceBufferFor(ch);
    if (fallback) {
      if (MODE === 'apply') await conn.query('UPDATE messenger_channels SET cover_url=NULL WHERE channel_url=?', [ch.channel_url]);
      console.log(`  ○ FALLBACK ${(ch.name || '').slice(0, 30).padEnd(30)} ${kind} → cover_url=NULL`);
      done++; continue;
    }
    if (!buf) { console.log(`  ⤳ SKIP  ${(ch.name || '').slice(0, 30).padEnd(30)} ${kind}`); skip++; continue; }
    const jpeg = await sharp(buf, { density: 200 }).resize(512, 512, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toBuffer();
    // Under profiles/ (the prefix the EC2 instance role can write); grp_ marks
    // group covers vs user avatars (profiles/<userId>.jpg).
    const key = `profiles/grp_${ch.channel_url}.jpg`;
    const url = `${S3_PUBLIC_URL}/${key}`;
    if (MODE === 'local') { writeFileSync(`/tmp/gc_${ch.channel_url}.jpg`, jpeg); }
    if (MODE === 'apply') {
      await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: jpeg, ContentType: 'image/jpeg', CacheControl: 'public, max-age=604800' }));
      await conn.query('UPDATE messenger_channels SET cover_url=? WHERE channel_url=?', [`${url}?v=${Date.now()}`, ch.channel_url]);
    }
    console.log(`  ✓ ${MODE === 'apply' ? 'INGEST' : MODE === 'local' ? 'LOCAL ' : 'PLAN  '} ${(ch.name || '').slice(0, 30).padEnd(30)} ${kind}  ${jpeg.length}b → ${key}`);
    done++;
  } catch (e) { console.log(`  ✗ FAIL  ${(ch.name || '').slice(0, 30).padEnd(30)} ${e.message}`); fail++; }
}
console.log(`\n${MODE}: ${done} processed, ${skip} skipped, ${fail} failed.`);
await conn.end();
