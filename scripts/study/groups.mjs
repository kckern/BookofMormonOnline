// scripts/study/groups.mjs
// Resolve a `--group` value that may be a channel_url OR a (partial) group name.
// Channel urls here are 11-char base64-ish tokens with no spaces; names have
// spaces or don't match that shape.

export function looksLikeChannelUrl(s) {
  return typeof s === "string" && /^[A-Za-z0-9_-]{9,}$/.test(s) && /[A-Z0-9]/.test(s) && !/\s/.test(s);
}

// channels: [{ channel_url, name }]. Returns a channel_url or throws.
export function resolveGroupRef(input, channels) {
  if (looksLikeChannelUrl(input)) return input;
  const needle = String(input).toLowerCase();
  const hits = (channels || []).filter((c) => (c.name || "").toLowerCase().startsWith(needle));
  if (hits.length === 0) throw new Error(`no group matches name "${input}" (run 'mychannels' to list)`);
  if (hits.length > 1) throw new Error(`ambiguous group "${input}" — matches: ${hits.map((c) => c.name).join(", ")}`);
  return hits[0].channel_url;
}
