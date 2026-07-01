#!/usr/bin/env python3
"""Draft-match canvas battle tiles (gridTiles.json k='battle') to bom_timeline
slugs, so battles become clickable (audit §3.1). Emits a DRAFT mapping +
report; a human reviews/edits the draft, then saves it as battleSlugs.json.

Usage: python3 scripts/timeline-grid/bind_battles.py \
    [--api http://localhost:5006/graphql] [--outdir scripts/timeline-grid]
"""
import argparse, json, re, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TILES = ROOT / "frontend/webapp/src/views/Timeline/gridTiles.json"
BATTLE_RE = re.compile(
    r"battle|attack|war|-vs-|siege|assault|conflict|massacre|raid|army|invasion|destruction",
    re.I,
)

def year_of(date_str):
    # Handles both DB dates ("326 AD", "590 BC") and axis decade ticks with the
    # suffix-s form ("30s AD", "385s AD", "~3100 BC") — the era must be searched
    # AFTER the optional 's', or every AD tick silently defaults to BC and the
    # whole post-Christ era becomes unmatchable.
    m = re.search(r"(\d+)s?\s*(BC|AD)", date_str or "", re.I)
    if not m:
        m = re.search(r"(\d+)", date_str or "")
        if not m:
            return None
        return -int(m.group(1))  # era-less: assume BC (dominant in this data)
    n = int(m.group(1))
    return -n if m.group(2).upper() == "BC" else n

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:5006/graphql")
    ap.add_argument("--outdir", default=str(ROOT / "scripts/timeline-grid"))
    args = ap.parse_args()

    tiles = json.loads(TILES.read_text())
    battles = [t for t in tiles["tiles"] if t.get("k") == "battle"]

    # Row → year via linear interpolation between dateAxis ticks.
    axis = sorted(
        [(d["r"], year_of(d["t"])) for d in tiles.get("dateAxis", []) if year_of(d["t"]) is not None]
    )
    def row_year(r):
        prev = next((a for a in reversed(axis) if a[0] <= r), axis[0])
        nxt = next((a for a in axis if a[0] > r), axis[-1])
        if nxt[0] == prev[0]:
            return prev[1]
        return prev[1] + (nxt[1] - prev[1]) * (r - prev[0]) / (nxt[0] - prev[0])

    q = '{"query":"{timeline{slug p heading date html grid{row col}}}"}'
    req = urllib.request.Request(args.api, q.encode(), {"Content-Type": "application/json"})
    rows = json.loads(urllib.request.urlopen(req).read())["data"]["timeline"]
    cands = [
        r for r in rows
        if r["p"] and not r.get("grid") and BATTLE_RE.search(r["slug"] + " " + (r.get("heading") or ""))
    ]

    # Greedy nearest-year assignment, one slug per tile.
    scored = []
    for b in battles:
        by = row_year(b["r"])
        for c in cands:
            cy = year_of(c.get("date"))
            if cy is None:
                continue
            scored.append((abs(by - cy), f'{b["r"]},{b["c"]}', c["slug"]))
    scored.sort()
    mapping, used_tiles, used_slugs = {}, set(), set()
    for dist, key, slug in scored:
        if key in used_tiles or slug in used_slugs or dist > 15:
            continue
        mapping[key] = slug
        used_tiles.add(key)
        used_slugs.add(slug)

    outdir = Path(args.outdir)
    (outdir / "battleSlugs.draft.json").write_text(json.dumps(mapping, indent=1, sort_keys=True) + "\n")
    unmatched_tiles = [f'{b["r"]},{b["c"]}' for b in battles if f'{b["r"]},{b["c"]}' not in mapping]
    unmatched_slugs = sorted({c["slug"] for c in cands} - used_slugs)
    report = [
        f"battle tiles: {len(battles)}  candidate slugs: {len(cands)}  matched: {len(mapping)}",
        f"UNMATCHED TILES ({len(unmatched_tiles)}): {', '.join(unmatched_tiles)}",
        f"UNMATCHED SLUGS ({len(unmatched_slugs)}): {', '.join(unmatched_slugs)}",
    ]
    (outdir / "battle-binding-report.md").write_text("\n\n".join(report) + "\n")
    print("\n".join(report))

if __name__ == "__main__":
    main()
