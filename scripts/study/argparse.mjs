// scripts/study/argparse.mjs
// The one arg grammar shared by the one-shot CLI and the REPL.
//   parseVerbArgs(verb, tokens) -> params object.
// - `--key value` becomes { key: value }; `--key` alone becomes { key: true }.
// - LIST_FLAGS values are comma-split into arrays.
// - a bare (non-flag) trailing string maps to the verb's PRIMARY field.

const PRIMARY = { post: "text", reply: "text", edit: "text", "group.create": "name", group: "name", join: "url", request: "url" };
const LIST_FLAGS = new Set(["invite", "users"]);

export function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export function parseVerbArgs(verb, tokens) {
  const p = {};
  const bare = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const hasVal = tokens[i + 1] !== undefined && !tokens[i + 1].startsWith("--");
      const val = hasVal ? tokens[++i] : "true";
      p[key] = LIST_FLAGS.has(key)
        ? val.split(",").map((x) => x.trim()).filter(Boolean)
        : val === "true" ? true : val;
    } else bare.push(t);
  }
  if (bare.length && PRIMARY[verb]) p[PRIMARY[verb]] = bare.join(" ");
  return p;
}
