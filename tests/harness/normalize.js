// Volatile keys masked under the "scrubbed" tier. Applied ONLY to scrubbed-tier
// queries, so e.g. stable content `duration` on text blocks (exact tier) is untouched.
const SCRUB_KEYS = new Set([
  'access_token', 'token', 'time', 'timestamp', 'datetime', 'date',
  'lastseen', 'laststudied', 'last_seen_at', 'joined_ts', 'created_at',
  'duration', 'first', 'startdate', 'duedate',
  // session counts grow with every run; cost: page item counts are masked too
  'count',
]);

function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SCRUB_KEYS.has(k) && v != null ? '[SCRUBBED]' : scrub(v);
    }
    return out;
  }
  return value;
}

function mergeShapes(a, b) {
  if (a === 'null') return b;
  if (b === 'null') return a;
  if (typeof a === 'string' || typeof b === 'string') return a === b ? a : 'mixed';
  if (Array.isArray(a) && Array.isArray(b)) {
    if (!a.length) return b;
    if (!b.length) return a;
    return [mergeShapes(a[0], b[0])];
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = k in out ? mergeShapes(out[k], v) : v;
    return out;
  }
  return 'mixed';
}

function shapeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (!value.length) return [];
    return [value.map(shapeOf).reduce(mergeShapes)];
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = shapeOf(v);
    return out;
  }
  return typeof value;
}

// Compares two shape trees; 'null' acts as a wildcard on either side so nullable
// fields don't flake. Returns a list of human-readable mismatch paths (empty = ok).
function shapesCompatible(expected, actual, path = '$', problems = []) {
  if (expected === 'null' || actual === 'null') return problems;
  if (typeof expected === 'string' || typeof actual === 'string') {
    if (expected !== actual) {
      problems.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
    return problems;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      problems.push(`${path}: array/object mismatch`);
      return problems;
    }
    if (expected.length && actual.length) shapesCompatible(expected[0], actual[0], `${path}[]`, problems);
    return problems;
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const k of keys) {
    if (!(k in expected)) problems.push(`${path}.${k}: unexpected key`);
    else if (!(k in actual)) problems.push(`${path}.${k}: missing key`);
    else shapesCompatible(expected[k], actual[k], `${path}.${k}`, problems);
  }
  return problems;
}

// GraphQL error entries carry Apollo stacktraces (server filesystem paths — this
// repo is public) and, for racing resolver crashes, unstable paths/indices.
// Reduce every error to its sorted, deduplicated messages: deterministic and
// leak-free, while still pinning the error contract.
function stabilizeErrors(body) {
  if (!body || !Array.isArray(body.errors)) return body;
  const messages = [...new Set(body.errors.map((e) => (e && e.message ? e.message : JSON.stringify(e))))].sort();
  return { ...body, errors: messages.map((message) => ({ message })) };
}

function normalize(body, tier) {
  const stable = stabilizeErrors(body);
  if (tier === 'shape') return shapeOf(stable);
  if (tier === 'scrubbed') return scrub(stable);
  return stable;
}

module.exports = { SCRUB_KEYS, scrub, shapeOf, mergeShapes, shapesCompatible, normalize, stabilizeErrors };
