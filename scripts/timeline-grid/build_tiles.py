#!/usr/bin/env python3
"""
Build the full TILE grid for the timeline (supersedes the sparse placement map).

Every spreadsheet cell becomes a tile: { r, c, w, h, bg, fg, t, rd, k, slug }.
- Lineage bands are solid color fills (blank colored tiles).
- ◜◝◟◞ / ◗ glyph cells carry the band color AND a rounded corner (rd).
- Labeled tiles join to the GraphQL `timeline` labels by slug (for popups).
- 📍 places and 💥 battles get their own kinds.

Reuses parsing/matching from reconcile.py.

Output: frontend/webapp/src/views/Timeline/gridTiles.json
Design:  docs/plans/2026-06-13-timeline-grid-migration-design.md
"""
import argparse, html, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reconcile import (parse_table, extract_styles, classify, clean, norm,
                       build_label_index, match_cell, WORLDHIST_COLS, STRONG)

# glyph -> rounded corners (band color already lives on the cell)
CORNERS = {"◜": ["tl"], "◝": ["tr"], "◟": ["bl"], "◞": ["br"],
           "◗": ["tr", "br"], "◖": ["tl", "bl"], "◣": ["bl"]}
ARROW_GLYPHS = set("◂◃▸▹▷◁◀▶➤➔→←")
WHITE = ("#ffffff", "#fff", None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", default="~/Downloads/Timeline Grid/Sheet1.html")
    ap.add_argument("--labels", default="~/Downloads/Timeline Grid/labels.json")
    ap.add_argument("--overrides", default="scripts/timeline-grid/overrides.json")
    ap.add_argument("--out", default="frontend/webapp/src/views/Timeline/gridTiles.json")
    args = ap.parse_args()

    src = open(os.path.expanduser(args.sheet), encoding="utf-8").read()
    labels = json.load(open(os.path.expanduser(args.labels)))["timeline"]
    slug_lookup = {e["slug"]: e for e in labels}
    overrides = {}
    if os.path.exists(args.overrides):
        overrides = {k: v for k, v in json.load(open(args.overrides)).items()
                     if not k.startswith("_")}

    cells = parse_table(src)
    styles = extract_styles(src)
    headed, _ = build_label_index(labels)

    # The world-history rail's col 2 is the date/era axis — capture it before
    # dropping the rail, to render as a sticky left gutter (the time scale).
    date_cells = [c for c in cells if c["c"] == 2 and c["r"] >= 2
                  and c["text"] and any(ch.isalnum() for ch in c["text"])]

    # keep real content: drop rulers (row<2, col<1) and the world-history rail
    cells = [c for c in cells if c["r"] >= 2 and c["c"] >= 1
             and c["c"] not in WORLDHIST_COLS]

    min_r = min(c["r"] for c in cells)
    min_c = min(c["c"] for c in cells)
    max_r = max(c["r"] + c["rs"] for c in cells)
    max_c = max(c["c"] + c["cs"] for c in cells)

    tiles = []
    for cell in cells:
        txt = cell["text"]
        s = styles.get(next((x for x in cell["classes"] if re.fullmatch(r"s\d+", x)), ""), {})
        bg_raw = s.get("bg")                      # may be white (e.g. white event bars)
        rd = []
        kind = None
        label_text = ""
        slug = None

        if txt.startswith("📍"):                 # check emoji markers BEFORE glyphs
            kind, label_text = "place", clean(txt)
        elif "💥" in txt:
            kind = "battle"
        elif txt in CORNERS:                      # corner glyph: band fill + rounding
            rd = CORNERS[txt]
            kind = "fill"
        elif txt in ARROW_GLYPHS or (len(txt) == 1 and not txt.isalnum()):
            kind = "fill"                        # stray glyph -> treat as plain fill
        elif txt and any(ch.isalnum() for ch in clean(txt)):
            kind, label_text = "event", clean(txt)
        elif bg_raw not in WHITE:
            kind = "fill"                        # blank colored band body
        else:
            continue                             # empty/transparent -> no tile

        # fill tiles drop white (= gap); labels/icons keep their own bg (white bars)
        bg = bg_raw
        if kind == "fill" and bg in WHITE:
            bg = None

        # match event tiles to a slug (overrides win, else fuzzy)
        if kind in ("event", "place"):
            key = f"{cell['r']},{cell['c']}"
            if key in overrides:
                ov = overrides[key]
                slug = None if ov == "SKIP" else ov
            else:
                cands = match_cell(cell, headed)
                if cands and cands[0][0] >= STRONG:
                    dup_block = txt in ("",)  # placeholder; dup handled in reconcile
                    slug = cands[0][1]["slug"]

        tile = {"r": cell["r"] - min_r + 1, "c": cell["c"] - min_c + 1,
                "w": cell["cs"], "h": cell["rs"], "k": kind}
        if bg:
            tile["bg"] = bg
        if s.get("fg") and s["fg"] not in WHITE and s["fg"] != bg:
            tile["fg"] = s["fg"]
        if rd:
            tile["rd"] = rd
        if label_text:
            tile["t"] = label_text
        if slug:
            tile["slug"] = slug
        tiles.append(tile)

    # date axis: rebased to the tile grid's rows, rendered as a sticky gutter
    date_axis = [{"r": c["r"] - min_r + 1, "t": c["text"]}
                 for c in date_cells if 1 <= c["r"] - min_r + 1 <= max_r - min_r + 1]

    out = {"cols": max_c - min_c + 1, "rows": max_r - min_r + 1,
           "tiles": tiles, "dateAxis": date_axis}
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    from collections import Counter
    kc = Counter(t["k"] for t in tiles)
    ev_slug = sum(1 for t in tiles if t["k"] == "event" and t.get("slug"))
    print(f"tiles: {len(tiles)}  grid {out['cols']}x{out['rows']}  kinds={dict(kc)}")
    print(f"  event tiles with slug: {ev_slug} / {kc['event']}  dateAxis: {len(date_axis)}")
    print(f"  out -> {args.out}")


if __name__ == "__main__":
    main()
