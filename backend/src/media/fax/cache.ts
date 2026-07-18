import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

export interface KeyParts { version: string; mode: 'page' | 'crop'; width: number | 'full'; selector: string; ext: 'jpg' | 'webp'; }

export function keyFor(p: KeyParts): string {
  const w = p.width === 'full' ? 'wfull' : `w${p.width}`;
  return `fax/render/${p.version}/${p.mode}/${w}/${p.selector}.${p.ext}`;
}

/** Legacy alias key (§12): fax/text/{version}/{slug}-{id}.jpg */
export function legacyKey(version: string, slug: string, id: number): string {
  return `fax/text/${version}/${slug}-${id}.jpg`;
}

// ── request coalescing ───────────────────────────────────────────────
const inFlight = new Map<string, Promise<Buffer>>();
export function _resetInFlight() { inFlight.clear(); }
export function coalesce(key: string, producer: () => Promise<Buffer>): Promise<Buffer> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = producer().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

// ── render concurrency semaphore (§6: bound sharp memory) ────────────
const MAX_CONCURRENT_RENDERS = Number(process.env['FAX_MAX_RENDERS'] ?? 4);
let active = 0;
const waiters: (() => void)[] = [];
export async function withRenderSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT_RENDERS) await new Promise<void>((r) => waiters.push(r));
  active++;
  try { return await fn(); }
  finally { active--; waiters.shift()?.(); }
}

// ── S3 write-back (fire-and-forget with bounded retry) ───────────────
const s3 = new S3Client({});
const contentType = (ext: 'jpg' | 'webp') => (ext === 'webp' ? 'image/webp' : 'image/jpeg');

export function writeBack(key: string, body: Buffer, ext: 'jpg' | 'webp'): void {
  if (env.SANDBOX) return;   // sandbox must not touch S3 (matches s3.ts convention)
  const bucket = process.env['FAX_S3_BUCKET'] || process.env['S3_BUCKET'];
  if (!bucket) return;                       // unconfigured -> skip silently
  void (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await s3.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: body,
          ContentType: contentType(ext),
          CacheControl: 'public, max-age=31536000, immutable',
        }));
        return;
      } catch (err) {
        if (attempt === 2) console.error(`[fax] writeBack failed key=${key}:`, err);
        else await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
  })();
}
