#!/usr/bin/env node
/**
 * build-media-variants — resized WebP variants of the entity images the Home
 * tiles render (people / places / matters), so a 104px card no longer pulls a
 * 1024px, 150-650KB JPEG (audit 2026-10-15, J1).
 *
 * Variant key:  variants/<width>/<type>/<slug>.webp   (e.g. variants/256/people/nephi1.webp)
 * Source:       https://media.bookofmormon.online/<type>/<slug>   (original JPEG)
 * Frontend:     tiles/_ds/mediaVariants.js builds the same URL; TileImage falls back
 *               to the original on error, so a missing variant never breaks a tile.
 *
 * Modes (default is a dry run that touches nothing remote):
 *   --out <dir>        write variants locally (inspect sizes)          [dry run]
 *   --upload           PUT to S3 (needs S3_BUCKET + AWS credentials in env;
 *                      never logs them). Idempotent: HEADs each key first and
 *                      skips existing ones unless --force.
 *   --types people,places,matters   which entity types (default: all three)
 *   --limit N          only the first N slugs per type (sampling)
 *   --api <url>        GraphQL endpoint for slug lists (default dev Vite proxy)
 *   --widths 256,640   variant widths (default 256,640)
 *   --families a,b     archive families (art, history-thumbs, history-fax, fax-thumb, fax-covers,
 *                      source-cover): enumerate the ORIGINAL keys with S3 ListObjectsV2 and write
 *                      variants/<w>/<original key>.webp (lib/mediaVariantKeys.mjs). Needs AWS creds
 *                      (read-only for --list-only / --out; --upload also writes).
 *   --list-only        with --families: print per-family counts and original bytes, then exit.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { FAMILIES, variantKey, plan } from "./lib/mediaVariantKeys.mjs";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};

const MEDIA = "https://media.bookofmormon.online";
const API = opt("api", "http://localhost:8201/graphql/en");
const TYPES = opt("types", "people,places,matters").split(",");
const WIDTHS = opt("widths", "256,640").split(",").map(Number);
const LIMIT = Number(opt("limit", "0")) || Infinity;
const OUT = opt("out", null);
const UPLOAD = flag("upload");
const FORCE = flag("force");
const FAMILY_ARG = opt("families", null);
const LIST_ONLY = flag("list-only");
const QUALITY = 72;
const CONCURRENCY = 6;

// GraphQL list query per media type (the app's singular list fields).
const LIST = { people: "person", places: "place", matters: "matter" };

if (!OUT && !UPLOAD && !LIST_ONLY) {
  console.error("Nothing to do: pass --out <dir> (dry run) or --upload.");
  process.exit(1);
}
if ((UPLOAD || FAMILY_ARG) && !process.env.S3_BUCKET) {
  console.error("ABORT: --upload needs S3_BUCKET (and AWS credentials) in the environment.");
  process.exit(1);
}

async function slugs(type) {
  const field = LIST[type];
  if (!field) throw new Error(`unknown type ${type}`);
  const r = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: `{${field}{slug}}` }),
  });
  const j = await r.json();
  const list = j?.data?.[field];
  if (!Array.isArray(list)) throw new Error(`${type}: no list from ${API}`);
  return [...new Set(list.map((x) => x.slug).filter(Boolean))].slice(0, LIMIT);
}

let s3, HeadObjectCommand, PutObjectCommand, ListObjectsV2Command;
async function s3Client() {
  if (!s3) {
    const mod = await import("@aws-sdk/client-s3");
    ({ HeadObjectCommand, PutObjectCommand, ListObjectsV2Command } = mod);
    s3 = new mod.S3Client({ region: process.env.AWS_REGION || "us-west-2" });
  }
  return s3;
}

async function exists(key) {
  const c = await s3Client();
  try {
    await c.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    return true;
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === "NotFound") return false;
    throw e;
  }
}

const stats = { sources: 0, missing: 0, written: 0, skipped: 0, failed: 0, srcBytes: 0, outBytes: {} };

async function processOne(type, slug) {
  const keys = WIDTHS.map((w) => ({ w, key: `variants/${w}/${type}/${slug}.webp` }));
  if (UPLOAD && !FORCE) {
    const have = await Promise.all(keys.map((k) => exists(k.key)));
    if (have.every(Boolean)) { stats.skipped += keys.length; return; }
  }
  const res = await fetch(`${MEDIA}/${type}/${slug}`);
  if (!res.ok) { stats.missing++; return; }
  const src = Buffer.from(await res.arrayBuffer());
  stats.sources++;
  stats.srcBytes += src.length;
  for (const { w, key } of keys) {
    // never upscale: a 200px original stays 200px
    const body = await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer();
    stats.outBytes[w] = (stats.outBytes[w] || 0) + body.length;
    if (OUT) {
      const file = path.join(OUT, key);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, body);
    }
    if (UPLOAD) {
      const c = await s3Client();
      await c.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }));
    }
    stats.written++;
  }
}

async function pool(items, fn) {
  let i = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) {
      const item = items[i++];
      try { await fn(item); } catch (e) { stats.failed++; console.error("fail", Array.isArray(item) ? item.join("/") : item.key, e?.message || e); }
    }
  });
  await Promise.all(workers);
}

/** All { key, size } under a prefix (paginated). */
async function listPrefix(prefix) {
  const c = await s3Client();
  const out = [];
  let token;
  do {
    const r = await c.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of r.Contents || []) out.push({ key: o.Key, size: o.Size });
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/** One original key -> its missing widths (archive families). */
async function processKey({ key, served, missing }) {
  const res = await fetch(`${MEDIA}/${key}`);
  if (!res.ok) { stats.missing++; return; }
  const src = Buffer.from(await res.arrayBuffer());
  stats.sources++;
  stats.srcBytes += src.length;
  for (const w of missing) {
    const vk = variantKey(w, served);
    // never upscale; keep alpha for PNG-like sources
    const body = await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: QUALITY, alphaQuality: 80 }).toBuffer();
    stats.outBytes[w] = (stats.outBytes[w] || 0) + body.length;
    if (OUT) { const file = path.join(OUT, vk); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); }
    if (UPLOAD) {
      const c = await s3Client();
      await c.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: vk, Body: body, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));
    }
    stats.written++;
  }
}

if (FAMILY_ARG) {
  const want = FAMILY_ARG.split(",");
  const fams = FAMILIES.filter((f) => want.includes(f.name));
  if (fams.length !== want.length) { console.error("unknown family in --families; known:", FAMILIES.map((f) => f.name).join(",")); process.exit(1); }
  const listed = [];
  const bytes = {};
  for (const f of fams) {
    const objs = (await listPrefix(f.prefix)).filter((o) => o.key.length > f.prefix.length && !o.key.endsWith("/"));
    bytes[f.name] = { count: objs.length, originalBytes: objs.reduce((a, o) => a + o.size, 0) };
    listed.push(...objs.map((o) => o.key));
  }
  const existing = new Set();
  for (const f of fams) for (const w of f.widths) for (const o of await listPrefix(`variants/${w}/${f.prefix}`)) existing.add(o.key);
  let todo = plan(listed, existing);
  if (LIMIT !== Infinity) todo = todo.slice(0, LIMIT);
  const mb = (n) => (n / 1048576).toFixed(1) + "MB";
  console.log(JSON.stringify({ families: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, { count: v.count, original: mb(v.originalBytes) }])), alreadyDone: existing.size, toGenerate: todo.length }, null, 1));
  if (LIST_ONLY) process.exit(0);
  console.log(`mode ${UPLOAD ? "UPLOAD" : "dry run → " + OUT}`);
  await pool(todo, (t) => processKey(t));
  const kb = (n) => `${Math.round(n / 1024)}KB`;
  console.log(JSON.stringify({ sources: stats.sources, missingOriginals: stats.missing, variantsWritten: stats.written, failed: stats.failed,
    avgSource: stats.sources ? kb(stats.srcBytes / stats.sources) : null,
    avgVariant: Object.fromEntries(Object.entries(stats.outBytes).map(([w, b]) => [w, kb(b / Math.max(1, stats.sources))])) }, null, 1));
  process.exit(stats.failed ? 1 : 0);
}

const work = [];
for (const type of TYPES) for (const slug of await slugs(type)) work.push([type, slug]);
console.log(`${work.length} sources (${TYPES.join(", ")}), widths ${WIDTHS.join("/")}, mode ${UPLOAD ? "UPLOAD" : "dry run → " + OUT}`);
await pool(work, ([t, s]) => processOne(t, s));
const kb = (n) => `${Math.round(n / 1024)}KB`;
console.log(JSON.stringify({
  sources: stats.sources, missingOriginals: stats.missing, variantsWritten: stats.written, skippedExisting: stats.skipped, failed: stats.failed,
  avgSource: stats.sources ? kb(stats.srcBytes / stats.sources) : null,
  avgVariant: Object.fromEntries(Object.entries(stats.outBytes).map(([w, b]) => [w, kb(b / Math.max(1, stats.sources))])),
  totalVariantBytes: kb(Object.values(stats.outBytes).reduce((a, b) => a + b, 0)),
}, null, 1));
process.exit(stats.failed ? 1 : 0);
