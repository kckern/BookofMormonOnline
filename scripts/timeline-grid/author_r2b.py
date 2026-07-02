#!/usr/bin/env python3
"""R2b editorial authoring: writes data-overrides.json (structural edits +
best-effort residue placement), binds the early-Nephite battle tiles, and
retires the two canvas place tiles into the data overlay.

This is provenance for data-overrides.json (the committed editorial source of
truth), not a routinely-rerun tool. It reads the BASE timelineData.json for
geometry/occupancy and detects unplaced rows from it, so it is NOT idempotent
against an already-overridden checkout. To re-run, restore the base first:

    git checkout -- ../../frontend/webapp/src/views/Timeline/timelineData.json \
        ../../frontend/webapp/src/views/Timeline/gridTiles.json \
        battleSlugs.json data-overrides.json
    python3 author_r2b.py && python3 gen_timeline_data.py
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, os.pardir, os.pardir))
TL = os.path.join(REPO, "frontend", "webapp", "src", "views", "Timeline")
DATA = os.path.join(TL, "timelineData.json")
GRIDTILES = os.path.join(TL, "gridTiles.json")
BATTLE_SLUGS = os.path.join(HERE, "battleSlugs.json")
OVERRIDES = os.path.join(HERE, "data-overrides.json")

# ── color tokens ─────────────────────────────────────────────────────────────
LAM, NEP, ZEN, ALM, MUL, KNG, JDG, GAD, JAR = (
    "#85200c", "#1c4587", "#3c78d8", "#b45f06", "#bf9000",
    "#274e13", "#38761d", "#6fa8dc", "#134f5c")
GREEN = (KNG, JDG)  # Nephite polity green (kings early, judges later)

# ── date parsing / row interpolation ─────────────────────────────────────────
def parse_year(s):
    """First year in a date string → signed int (BC negative, AD positive)."""
    if not s:
        return None
    m = re.search(r"(\d+)", s)
    if not m:
        return None
    n = int(m.group(1))
    # era: look at the label; a lone trailing 'BC'/'AD' governs a leading range
    era = "AD" if re.search(r"\bAD\b", s) and not re.search(r"BC", s) else "BC"
    return n if era == "AD" else -n


def build_axis(grid):
    pts = sorted((parse_year(d["t"]), d["r"]) for d in grid["dateAxis"]
                 if parse_year(d["t"]) is not None)
    return pts


def row_for_year(pts, year):
    if year is None:
        return None
    if year <= pts[0][0]:
        return pts[0][1]
    if year >= pts[-1][0]:
        return pts[-1][1]
    for (y0, r0), (y1, r1) in zip(pts, pts[1:]):
        if y0 <= year <= y1:
            frac = (year - y0) / (y1 - y0) if y1 != y0 else 0
            return int(round(r0 + frac * (r1 - r0)))
    return pts[-1][1]


# ── lineage inference for residue ────────────────────────────────────────────
def infer_token(slug, head, row):
    s = (slug + " " + (head or "")).lower()
    if "jaredite" in s:
        return [JAR]
    if any(k in s for k in ("zeniff", "limhi", "noah")):
        return [ZEN]
    if "mulek" in s:
        return [MUL]
    if "gadianton" in s:
        return [GAD]
    if "alma" in s and "zarahemla" not in s:
        return [ALM]
    # dissenters who join / become Lamanites
    if any(k in s for k in ("amlic", "amalek", "amalick", "ammoron",
                            "zoram", "convert", "anti-nephi", "ammon")):
        return [LAM]
    if any(k in s for k in ("laman", "lamanite", "king-laman")):
        return [LAM]
    # generic Nephite polity → green (kings early / judges later)
    if any(k in s for k in ("nephi", "zarahemla", "moroni", "captain", "war",
                            "counterstrike", "reclaim", "aaron", "mormon",
                            "desolation", "sermon", "middoni", "jacob")):
        return list(GREEN)
    return None


# ── main ─────────────────────────────────────────────────────────────────────
def main():
    data = json.load(open(DATA))
    grid = json.load(open(GRIDTILES))

    # fill map (band surface) from canvas tiles
    fill = {}
    for t in grid["tiles"]:
        if t["k"] in ("fill", "grad", "fade") and (t.get("bg") or t.get("from")):
            bg = t.get("bg") or t.get("from")
            if bg == "#ffffff":
                continue
            for dr in range(t.get("h", 1)):
                for dc in range(t.get("w", 1)):
                    fill[(t["r"] + dr, t["c"] + dc)] = bg

    axis = build_axis(grid)

    # ── structural overrides ────────────────────────────────────────────────
    ov = {}

    # B1: band names → tier 1
    for slug in ("jaredites", "lehite-family", "nephites", "lamanites", "mulekites"):
        ov[slug] = {"grid": {"tier": 1}}

    # B2: lamanites-vs-nephi → battle medallion at the navy left edge (r17,c16).
    # enos/jarom/omni/amaron/abinadom bind to their existing c16 battle tiles
    # via battleSlugs.json (handled below).
    ov["lamanites-vs-nephi"] = {
        "grid": {"icon": "battle", "col": 16, "colSpan": 1, "rowSpan": 1, "bg": LAM}}

    # B5: movement bars — chevrons + along-bar gradients
    ov["ill-fated-expedition"] = {"grid": {"dir": "r"}}
    ov["colonial-expedition"] = {"grid": {"dir": "l"}}
    ov["explorers"] = {"grid": {"bg": ZEN, "dir": "r"}}
    ov["sons-of-mosiah"] = {"grid": {"dir": "l"}}
    ov["ammon-and-the-people-of-limhi"] = {"grid": {"dir": "r", "bgTo": KNG, "gradDeg": 90}}
    ov["people-of-alma"] = {"grid": {"dir": "r", "bgTo": KNG, "gradDeg": 90}}
    ov["nephite-defectors"] = {"grid": {"bg": JDG, "bgTo": LAM, "dir": "l", "gradDeg": 270}}
    ov["lamanites-with-nephite-defectors"] = {"grid": {"dir": "r"}}
    ov["lamanite-recruits"] = {"grid": {"bgTo": GAD, "dir": "r", "gradDeg": 90}}
    ov["nephite-recruits"] = {"grid": {"bgTo": GAD, "dir": "l", "gradDeg": 270}}
    ov["amalekites"] = {"grid": {"bg": JDG, "bgTo": LAM, "dir": "l", "gradDeg": 270}}

    # ── occupancy: anchor cells of every placed content event, plus structural ─
    occ = set()
    for e in data["events"]:
        g = e.get("grid")
        if g and g.get("row") and not g.get("icon"):
            occ.add((g["row"], g["col"]))

    def label_ev(slug, head, row, col, span=2, tier=3, anchor="center"):
        occ.add((row, col))
        return {"slug": slug, "heading": head, "kind": "label", "p": True,
                "date": None, "html": None, "textSlug": None, "text": None,
                "grid": {"row": row, "col": col, "rowSpan": 1, "colSpan": span,
                         "anchor": anchor, "tier": tier}}

    def place_ev(slug, head, row, col, bg, span=2, anchor="start"):
        occ.add((row, col))
        return {"slug": slug, "heading": head, "kind": "place", "p": False,
                "date": None, "html": None, "textSlug": None, "text": None,
                "grid": {"row": row, "col": col, "rowSpan": 1, "colSpan": span,
                         "bg": bg, "anchor": anchor}}

    new = []

    # B3: early-Nephite person roster (pure labels), stacked at the navy right
    # edge (col 19), date order. Nephi..Jacob at the band start; Enos..Abinadom
    # aligned to their vs-Lamanite battle rows; Amaleki near Mosiah I.
    roster = [("nephi", "Nephi", 17), ("sam", "Sam", 18), ("zoram", "Zoram", 19),
              ("jacob", "Jacob", 20), ("enos", "Enos", 21), ("jarom", "Jarom", 23),
              ("omni", "Omni", 25), ("amaron", "Amaron", 27),
              ("abinadom", "Abinadom", 29), ("amaleki", "Amaleki", 30)]
    for key, name, r in roster:
        new.append(label_ev(f"label-{key}", name, r, 19))

    # B4: retire the two canvas place tiles into the overlay. Shilom moves out of
    # the "Land of Nephi" caption's overflow path (was r34,c19 → collision) to a
    # clear cell in the Zeniff block (r33,c22).
    new.append(place_ev("place-shilom", "Shilom", 33, 22, ZEN, span=2, anchor="start"))
    new.append(place_ev("place-reign-of-judges", "Reign of Judges", 50, 33, JDG,
                        span=2, anchor="above"))

    # ── B6: residue placement (best-effort, flagged) ─────────────────────────
    # rows to (re)place: all unplaced content rows + the misplaced 25 AD "Jacob"
    # (textSlug gadianton/179) currently squatting the 545 BC navy band.
    residue = [e for e in data["events"]
               if (not e.get("grid")) and (e.get("heading") or e.get("html"))]
    force = {"jacob"}  # re-place despite an existing (wrong) grid
    residue += [e for e in data["events"] if e["slug"] in force]
    # battles that lack a battle tile: a long "…vs…/Strike" text chip can only
    # overflow into a dense neighbour here — leave for review rather than clutter.
    EXCLUDE = {"lamanites-vs-zeniff", "lamanites-vs-benjamin"}
    residue = [e for e in residue if e["slug"] not in EXCLUDE]

    CLEAR = 3  # min horizontal gap (cols) between chip anchors on one row —
    # text chips overflow ~3-5 cols, so adjacent anchors collide otherwise.

    def clear_at(row, c):
        return not any((row, c2) in occ for c2 in range(c - CLEAR, c + CLEAR + 1))

    def free_col(row, hexes):
        # try the target row first, then nudge ±rows within the same band —
        # keeps residue in its lineage while dodging crowded rows.
        for dr in (0, 1, -1, 2, -2, 3, -3):
            rr = row + dr
            cols = sorted(c for (r, c), bg in fill.items() if r == rr and bg in hexes)
            if not cols:
                continue
            mid = cols[len(cols) // 2]
            for c in sorted(cols, key=lambda c: abs(c - mid)):
                if clear_at(rr, c):
                    return c, rr
        return None, row

    placed, skipped = [], []
    for e in residue:
        slug = e["slug"]
        year = parse_year(e.get("date"))
        row = row_for_year(axis, year)
        toks = infer_token(slug, e.get("heading"), row or 0)
        if row is None or toks is None:
            skipped.append((slug, e.get("date"),
                            "no date" if row is None else "lineage unclear"))
            continue
        col, row = free_col(row, toks)
        if col is None:
            skipped.append((slug, e.get("date"), "no band at row"))
            continue
        occ.add((row, col))
        bg = toks[0] if toks[0] not in GREEN else (KNG if row < 50 else JDG)
        ov[slug] = {"grid": {"row": row, "col": col, "rowSpan": 1, "colSpan": 1,
                             "bg": bg}, "r2b_flag": "auto-placed"}
        placed.append((slug, e.get("date"), row, col, bg))

    # zoramite-defection: keep its residue row/col but paint it as a defection
    # bar (Nephite green → Lamanite maroon, travelling left) per B5.
    if "zoramite-defection" in ov:
        g = ov["zoramite-defection"]["grid"]
        g.update({"bg": JDG, "bgTo": LAM, "dir": "l", "gradDeg": 270})

    ov["+new"] = new
    json.dump(ov, open(OVERRIDES, "w"), indent=2, sort_keys=True, ensure_ascii=False)
    open(OVERRIDES, "a").write("\n")

    # ── bind early-Nephite battle tiles to their vs-Lamanite stories ──────────
    bs = json.load(open(BATTLE_SLUGS))
    binds = {"21,16": "lamanites-vs-enos", "23,16": "lamanites-vs-jarom",
             "25,16": "lamanites-vs-omni", "27,16": "lamanites-vs-amaron",
             "29,16": "lamanites-vs-abinadom"}
    bs.update(binds)
    json.dump(bs, open(BATTLE_SLUGS, "w"), indent=2, sort_keys=True, ensure_ascii=False)
    open(BATTLE_SLUGS, "a").write("\n")

    # ── retire the canvas place tiles from gridTiles.json ────────────────────
    before = len(grid["tiles"])
    grid["tiles"] = [t for t in grid["tiles"] if t["k"] != "place"]
    json.dump(grid, open(GRIDTILES, "w"), indent=2, ensure_ascii=False)
    open(GRIDTILES, "a").write("\n")

    # ── report ───────────────────────────────────────────────────────────────
    print(f"roster labels     : {len(roster)}")
    print(f"battle binds added: {len(binds)} (+ lamanites-vs-nephi override)")
    print(f"place tiles retired: {before - len(grid['tiles'])}")
    print(f"residue placed    : {len(placed)}")
    for s, d, r, c, bg in placed:
        print(f"    + {s:34} {str(d):18} → r{r} c{c} {bg}")
    print(f"residue skipped   : {len(skipped)}")
    for s, d, why in skipped:
        print(f"    - {s:34} {str(d):18} ({why})")


if __name__ == "__main__":
    main()
