/** @format */
// Real feature flags: each flag has a rollout percentage (0 = off, 100 = on for everyone,
// anything between = that share of visitors, stable per browser) and can be overridden per
// browser from the URL for testing. Source of truth: the `flags:` block of config/features.yml
// (compiled into the bundle; changing a rollout is an edit + deploy).
//
//   ?ff=theology,-matters   turn theology ON and matters OFF in this browser (remembered)
//   ?ff=reset               forget this browser's overrides
//
// Dev/test builds (NODE_ENV !== 'production') have every flag ON unless overridden, so
// unfinished work stays visible to us while it is dark to visitors.
import features from "../config/features.generated.json";

const OVERRIDE_KEY = "bom.ff";
const BUCKET_KEY = "bom.bucket";

const safe = (fn, fallback) => { try { return fn(); } catch (e) { return fallback; } };

/** "a,-b" -> { a: true, b: false }. "reset" -> null (clear). */
export function parseOverrides(value) {
  if (value == null) return {};
  const v = String(value).trim();
  if (v === "reset" || v === "") return v === "reset" ? null : {};
  const out = {};
  for (const part of v.split(",")) {
    const p = part.trim();
    if (!p) continue;
    if (p.startsWith("-")) out[p.slice(1)] = false;
    else out[p] = true;
  }
  return out;
}

/** The 0-99 bucket this browser lives in (random once, then stable). */
export function bucketFor(storage, random = Math.random) {
  const stored = safe(() => storage.getItem(BUCKET_KEY), null);
  const n = Number(stored);
  if (stored != null && Number.isInteger(n) && n >= 0 && n < 100) return n;
  const fresh = Math.floor(random() * 100);
  safe(() => storage.setItem(BUCKET_KEY, String(fresh)));
  return fresh;
}

/** Overrides from the URL (persisted) merged over what this browser stored earlier. */
export function loadOverrides(storage, search) {
  const stored = safe(() => JSON.parse(storage.getItem(OVERRIDE_KEY) || "{}"), {}) || {};
  const fromUrl = parseOverrides(safe(() => new URLSearchParams(search || "").get("ff"), null));
  if (fromUrl === null) { safe(() => storage.removeItem(OVERRIDE_KEY)); return {}; }
  const merged = { ...stored, ...fromUrl };
  if (Object.keys(fromUrl).length) safe(() => storage.setItem(OVERRIDE_KEY, JSON.stringify(merged)));
  return merged;
}

/** Pure decision. */
export function decide(name, { config, overrides, bucket, isProd }) {
  if (Object.prototype.hasOwnProperty.call(overrides || {}, name)) return !!overrides[name];
  if (!isProd) return true;
  const cfg = config && config[name];
  if (!cfg) return false;
  const r = Number(cfg.rollout ?? 0);
  if (r >= 100) return true;
  if (r <= 0) return false;
  return bucket < r;
}

const IS_PROD = process.env.NODE_ENV === "production";
let cache = null;
const env = () => {
  if (cache) return cache;
  const storage = typeof window !== "undefined" ? window.localStorage : { getItem() { return null; }, setItem() {}, removeItem() {} };
  const search = typeof window !== "undefined" ? window.location.search : "";
  cache = { overrides: loadOverrides(storage, search), bucket: bucketFor(storage), config: features.flags || {} };
  return cache;
};

export const isEnabled = (name) => decide(name, { ...env(), isProd: IS_PROD });
export const _resetFlagCache = () => { cache = null; };
