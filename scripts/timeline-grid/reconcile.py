#!/usr/bin/env python3
"""
Timeline grid reconciliation — human audit report (one-time migration tool).

Maps the hand-authored spreadsheet layout (Sheet1.html) onto the GraphQL
`timeline` payload (labels.json) and emits a reconciliation report
(confident / ambiguous / unmatched both ways). It does NOT produce the tile
grid or placement data the app/DB consume — build_tiles.py does that, importing
the parser and matcher helpers from here so the two never drift.

Design: docs/plans/2026-06-13-timeline-grid-migration-design.md

Usage:
  python3 scripts/timeline-grid/reconcile.py \
      --sheet "~/Downloads/Timeline Grid/Sheet1.html" \
      --labels "~/Downloads/Timeline Grid/labels.json" \
      --out-report docs/audits/2026-06-13-timeline-grid-reconciliation.md
"""
import argparse, html, json, os, re, difflib
from collections import defaultdict

# --- thresholds ---
STRONG = 0.82   # accept automatically
MAYBE  = 0.60   # surface as ambiguous below this is "unmatched"
ARROWS = "▷◁◀▶◃▹➤➔→←"

# ---------------------------------------------------------------- parsing
def parse_table(src):
    """Return list of cells with occupancy-aware absolute grid coords.

    Each cell: {r, c, cs, rs, text, classes}. r/c are 0-based grid indices
    that account for colspan/rowspan carried over from earlier rows, so
    merged cells land on their true coordinates.
    """
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", src, re.S)
    occupied = set()           # (r,c) covered by a rowspan from above
    cells = []
    for r, row_html in enumerate(rows):
        c = 0
        for m in re.finditer(r"<t([dh])([^>]*)>(.*?)</t[dh]>", row_html, re.S):
            attrs, inner = m.group(2), m.group(3)
            while (r, c) in occupied:        # skip cells held by a rowspan
                c += 1
            cs = int(re.search(r'colspan="(\d+)"', attrs).group(1)) if re.search(r'colspan="(\d+)"', attrs) else 1
            rs = int(re.search(r'rowspan="(\d+)"', attrs).group(1)) if re.search(r'rowspan="(\d+)"', attrs) else 1
            classes = (re.search(r'class="([^"]+)"', attrs).group(1).split()
                       if re.search(r'class="([^"]+)"', attrs) else [])
            text = html.unescape(re.sub(r"<[^>]+>", "", inner)).strip()
            cells.append({"r": r, "c": c, "cs": cs, "rs": rs, "text": text, "classes": classes})
            for dr in range(rs):
                for dc in range(cs):
                    if dr or dc:
                        occupied.add((r + dr, c + dc))
            c += cs
    return cells


def extract_styles(src):
    """Parse the inline <style> block for `s*` cell classes → resolved style.

    Cell colors live in Sheet1.html's inline <style> (sheet.css is just the
    Google editor chrome). We keep background, text color, alignment, weight.
    """
    m = re.search(r"<style[^>]*>(.*?)</style>", src, re.S)
    if not m:
        return {}
    styles = {}
    for name, body in re.findall(r"\.(s\d+)\s*\{([^}]*)\}", m.group(1)):
        def grab(prop):
            g = re.search(prop + r":([^;]+)", body)
            return g.group(1).strip() if g else None
        styles[name] = {
            "bg": grab("background-color"),
            "fg": grab("color"),
            "align": grab("text-align"),
            "bold": "font-weight:bold" in body or "font-weight:700" in body,
        }
    return styles


def classify(text):
    if text.startswith("📍"):
        return "place"
    if "💥" in text:
        return "battle"
    return "named"


def clean(text):
    """Strip emoji/arrows/box glyphs for matching + display label."""
    t = re.sub(r"[📍💥]+", "", text)
    t = "".join(ch for ch in t if ch not in ARROWS)
    return t.strip()


def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()


WORLDHIST_RE = re.compile(r"^\d{1,4}s? ?(BC|AD)$|^\d{1,4}\s*-\s*\d{1,4}\s*(BC|AD)$", re.I)
# The secular world-history track is a fixed left rail: col 1 = event text,
# col 2 = decade. Excluded wholesale for the BoM-only v1 scope.
WORLDHIST_COLS = {1, 2}
WORLDHIST_KW = ("assyria", "babylon", "persia", "egypt", "greece", "rome", "pharaoh",
                "nebuchadnezzar", "cyrus", "athens", "maccabean", "lusitanian")

def looks_world_history(text):
    t = clean(text)
    if WORLDHIST_RE.match(t):
        return True
    tl = t.lower()
    return any(k in tl for k in WORLDHIST_KW)


# ---------------------------------------------------------------- matching
def build_label_index(labels):
    """Index labels.json entries for matching. Tracks duplicate headings."""
    headed = [e for e in labels if e.get("heading")]
    by_norm_heading = defaultdict(list)
    for e in headed:
        by_norm_heading[norm(e["heading"])].append(e)
    return headed, by_norm_heading


def score(cell_text, entry):
    n = norm(clean(cell_text))
    hn = norm(entry.get("heading", ""))
    sn = entry["slug"].replace("-", " ")
    ratio = max(
        difflib.SequenceMatcher(None, n, hn).ratio(),
        difflib.SequenceMatcher(None, n, sn).ratio(),
    )
    # substring boost, but require a real word (>=4 chars) to avoid Jared->Jaredite
    if n and len(n) >= 4 and (n == hn or (" " + n + " ") in (" " + hn + " ")):
        ratio = max(ratio, 0.95)
    return ratio


def match_cell(cell, headed):
    cands = sorted(((score(cell["text"], e), e) for e in headed),
                   key=lambda x: x[0], reverse=True)
    return cands[:3]


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", default="~/Downloads/Timeline Grid/Sheet1.html")
    ap.add_argument("--labels", default="~/Downloads/Timeline Grid/labels.json")
    ap.add_argument("--out-report", default="docs/audits/2026-06-13-timeline-grid-reconciliation.md")
    ap.add_argument("--overrides", default="scripts/timeline-grid/overrides.json")
    args = ap.parse_args()

    sheet_path = os.path.expanduser(args.sheet)
    labels_path = os.path.expanduser(args.labels)
    src = open(sheet_path, encoding="utf-8").read()
    labels = json.load(open(labels_path))["timeline"]
    slug_lookup = {e["slug"]: e for e in labels}

    # Manual reconciliation overrides: { "<row>,<col>": "<slug>" | "SKIP" }.
    # Persists across re-runs (the generated map/report are derived artifacts).
    overrides = {}
    if os.path.exists(args.overrides):
        raw = json.load(open(args.overrides))
        overrides = {k: v for k, v in raw.items() if not k.startswith("_")}

    cells = parse_table(src)
    cell_styles = extract_styles(src)

    # origin offset: header row(s) + ruler column. Drop the first two rows
    # (col letters + number ruler), the first column (row ruler), the secular
    # left rail (cols 1-2), pure-digit rulers, and any cell with no alphanumeric
    # content (box/arrow glyphs like ◜◝◟◞ ◂◣◗▷◃).
    def has_alnum(s):
        return any(ch.isalnum() for ch in clean(s))
    content = [c for c in cells if c["r"] >= 2 and c["c"] >= 1
               and c["c"] not in WORLDHIST_COLS
               and not c["text"].isdigit()
               and (has_alnum(c["text"]) or "💥" in c["text"])]

    named  = [c for c in content if classify(c["text"]) == "named" and not looks_world_history(c["text"])]
    places = [c for c in content if classify(c["text"]) == "place"]
    battles = [c for c in content if classify(c["text"]) == "battle"]
    world  = [c for c in content if classify(c["text"]) == "named" and looks_world_history(c["text"])]

    headed, by_norm_heading = build_label_index(labels)

    # rebase coords so the grid starts at row 1 / col 1 (CSS-grid friendly)
    min_r = min((c["r"] for c in content), default=2)
    min_c = min((c["c"] for c in content), default=1)

    def grid_coords(cell):
        return {"row": cell["r"] - min_r + 1, "col": cell["c"] - min_c + 1,
                "rowSpan": cell["rs"], "colSpan": cell["cs"]}

    def color_lane(cell):
        styles = [c for c in cell["classes"] if re.fullmatch(r"s\d+", c)]
        return styles[0] if styles else None

    def resolve_style(cell):
        lane = color_lane(cell)
        st = cell_styles.get(lane, {})
        # drop pure-white/black noise so the component can fall back to defaults
        bg = st.get("bg")
        if bg in ("#ffffff", "#fff", None):
            bg = None
        return {"lane": lane, "bg": bg, "fg": st.get("fg"),
                "align": st.get("align"), "bold": st.get("bold", False)}

    confident = {}     # slug -> placement (first/largest footprint wins)
    ambiguous = []     # cells needing human decision
    unmatched_cells = []

    matched_slugs = set()
    named_placed = []   # (cell, slug) for matched named cells — used for battle pairing

    def place_named(cell, slug, sc):
        placement = {**grid_coords(cell), "kind": "named",
                     "style": resolve_style(cell), "label": clean(cell["text"]),
                     "score": sc}
        prev = confident.get(slug)
        if not prev or (placement["rowSpan"] * placement["colSpan"]
                        > prev["rowSpan"] * prev["colSpan"]):
            confident[slug] = placement
        matched_slugs.add(slug)
        named_placed.append((cell, slug))

    for cell in named:
        key = f"{cell['r']},{cell['c']}"
        if key in overrides:
            ov = overrides[key]
            if ov == "SKIP":
                continue
            if ov in slug_lookup:
                place_named(cell, ov, "manual")
                continue
        cands = match_cell(cell, headed)
        if not cands:
            unmatched_cells.append((cell, []))
            continue
        top_score, top = cands[0]
        dup = len(by_norm_heading.get(norm(top.get("heading", "")), [])) > 1
        if top_score >= STRONG and not dup:
            place_named(cell, top["slug"], round(top_score, 2))
        elif top_score >= MAYBE or dup:
            ambiguous.append((cell, cands, dup))
        else:
            unmatched_cells.append((cell, cands))

    # places: join by slug/heading against any entry
    for cell in places:
        cands = sorted(((score(cell["text"], e), e) for e in labels),
                       key=lambda x: x[0], reverse=True)[:3]
        if cands and cands[0][0] >= STRONG:
            slug = cands[0][1]["slug"]
            confident.setdefault("place::" + slug + f"@{cell['r']}", {
                **grid_coords(cell), "kind": "place",
                "style": resolve_style(cell), "label": clean(cell["text"]),
                "slug": slug, "score": round(cands[0][0], 2)})
        else:
            unmatched_cells.append((cell, cands))

    # battles: 💥 cells carry no name — pair each with the nearest matched named
    # cell (Manhattan distance) and inherit that slug. Heuristic; listed in report.
    battle_pairs = []
    for cell in battles:
        nearest, dist = None, 10**9
        for ncell, slug in named_placed:
            d = abs(ncell["r"] - cell["r"]) + abs(ncell["c"] - cell["c"])
            if d < dist:
                nearest, dist = (ncell, slug), d
        if nearest:
            ncell, slug = nearest
            key = f"battle::{cell['r']},{cell['c']}"
            confident[key] = {**grid_coords(cell), "kind": "battle",
                              "style": resolve_style(cell),
                              "label": "💥", "slug": slug,
                              "nearest": clean(ncell["text"]), "dist": dist}
            battle_pairs.append((cell, slug, clean(ncell["text"]), dist))

    unmatched_entries = [e for e in headed if e["slug"] not in matched_slugs]

    # NOTE: this script now produces ONLY the human audit report. The placement
    # map / tile grid the frontend consumes is built by build_tiles.py
    # (gridTiles.json + placements.json). reconcile.py shares its parser/matcher
    # helpers with build_tiles and emits this report so the two never drift.

    # ---------- write report ----------
    os.makedirs(os.path.dirname(args.out_report), exist_ok=True)
    L = []
    L.append("# Timeline grid reconciliation report\n")
    L.append(f"_Generated by `scripts/timeline-grid/reconcile.py`._\n")
    L.append("## Summary\n")
    L.append(f"- Sheet content cells: **{len(content)}** "
             f"(named={len(named)}, place📍={len(places)}, battle💥={len(battles)}, "
             f"world-history(excluded)={len(world)})")
    L.append(f"- labels.json entries: **{len(labels)}** (with heading={len(headed)})")
    L.append(f"- ✅ confident placements: **{len(confident)}**")
    L.append(f"- ⚠️ ambiguous (need human): **{len(ambiguous)}**")
    L.append(f"- ❌ unmatched cells: **{len(unmatched_cells)}**")
    L.append(f"- 💥 battle cells paired to nearest named: **{len(battle_pairs)}**")
    L.append(f"- ⬜ labels.json entries with NO placement: **{len(unmatched_entries)}**\n")

    L.append("## ⚠️ Ambiguous — pick the right slug\n")
    for cell, cands, dup in sorted(ambiguous, key=lambda x: -x[1][0][0]):
        flag = " _(duplicate heading)_" if dup else ""
        L.append(f"- `{clean(cell['text'])}` (r{cell['r']} c{cell['c']}){flag}")
        for s, e in cands:
            L.append(f"    - {s:.2f} → `{e['slug']}` — {e.get('heading','')}")
    if not ambiguous:
        L.append("_none_")

    L.append("\n## 💥 Battle pairings (nearest named cell — verify)\n")
    for cell, slug, near, dist in sorted(battle_pairs, key=lambda x: x[3], reverse=True):
        warn = " ⚠️far" if dist > 3 else ""
        L.append(f"- 💥 (r{cell['r']} c{cell['c']}) → `{slug}` via `{near}` (dist {dist}){warn}")
    if not battle_pairs:
        L.append("_none_")

    L.append("\n## ❌ Unmatched sheet cells (best guesses)\n")
    for cell, cands in unmatched_cells:
        guess = f" — best: `{cands[0][1]['slug']}` ({cands[0][0]:.2f})" if cands else ""
        L.append(f"- `{clean(cell['text'])}` (r{cell['r']} c{cell['c']}){guess}")
    if not unmatched_cells:
        L.append("_none_")

    L.append("\n## ⬜ labels.json entries with no placement\n")
    for e in unmatched_entries:
        L.append(f"- `{e['slug']}` — {e.get('heading','')}")
    if not unmatched_entries:
        L.append("_none_")

    with open(args.out_report, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")

    print(f"reconciliation: {len(confident)} confident, {len(ambiguous)} ambiguous, "
          f"{len(unmatched_cells)} unmatched cells, {len(unmatched_entries)} unplaced entries")
    print(f"  report -> {args.out_report}")


if __name__ == "__main__":
    main()
