#!/usr/bin/env python3
"""Generate frontend/webapp/src/views/Timeline/timelineData.json.

R2a (green-field data): the Timeline view no longer fetches GraphQL at runtime.
This script bakes ALL timeline data into a single JSON file that ships with the
frontend. It is the regenerable source pipeline; the editorial source of truth
for placement/tier/anchor tweaks is the overlay file data-overrides.json.

Pipeline:
  1. GQL dump (:5006, one last time) -> content rows (events + places).
  2. Battle tiles from gridTiles.json -> icon-events. battleSlugs.json binds 16
     of the 38 cells to content rows (attach placement to the existing row);
     the other 22 become synthetic decorative markers (non-clickable, no content).
  3. Overlay data-overrides.json deep-merged (scalars overwrite, grid per-key,
     "+new" appends).
  4. Deterministic, pretty, sorted-keys output {"events":[...]}.

Regenerable: re-run any time. Battle tiles are also retired from gridTiles.json
by retire_battle_tiles.py (they render from these icon-events now).
"""
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, os.pardir, os.pardir))
FRONTEND_TL = os.path.join(REPO, "frontend", "webapp", "src", "views", "Timeline")
# Battle tiles are the canonical source for the 38 icon-events. Extracted to a
# stable file so the generator is decoupled from retire_battle_tiles.py (which
# removes k:'battle' from gridTiles.json) — either script can run in any order
# and both stay idempotent/regenerable.
BATTLE_TILES = os.path.join(HERE, "battleTiles.json")
BATTLE_SLUGS = os.path.join(HERE, "battleSlugs.json")
OVERRIDES = os.path.join(HERE, "data-overrides.json")
OUT = os.path.join(FRONTEND_TL, "timelineData.json")
GQL_URL = os.environ.get("GQL_URL", "http://localhost:5006/graphql")
GQL_QUERY = ("{timeline{slug p heading date html text{slug} "
             "grid{row col rowSpan colSpan bg anchor tier dir icon}}}")

# grid subfields kept on output, in a stable insertion order (sort_keys re-sorts
# on dump anyway, but this documents the shape).
GRID_KEYS = ["row", "col", "rowSpan", "colSpan", "bg", "bgTo",
             "anchor", "tier", "dir", "icon"]


def fetch_gql():
    body = json.dumps({"query": GQL_QUERY}).encode()
    req = urllib.request.Request(
        GQL_URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.load(resp)
    if payload.get("errors"):
        print("GQL errors:", payload["errors"], file=sys.stderr)
        sys.exit(1)
    return payload["data"]["timeline"]


def clean_grid(g):
    """Keep only non-null grid subfields, ordered."""
    if not g:
        return None
    out = {}
    for k in GRID_KEYS:
        v = g.get(k)
        if v is not None:
            out[k] = v
    return out or None


def transform_row(r):
    """GQL row -> event dict. Returns None for pure-null rows (only slug/p)."""
    grid = clean_grid(r.get("grid"))
    heading = r.get("heading")
    date = r.get("date")
    html = r.get("html")
    text = r.get("text") or {}
    text_slug = text.get("slug")
    # pure-null: no content and no placement -> drop.
    if not (heading or date or html or text_slug or grid):
        return None
    is_event = bool(r.get("p"))
    return {
        "slug": r["slug"],
        "heading": heading,
        "date": date,
        "html": html,
        # kind/textSlug are the plan's canonical schema; p/text mirror them for
        # the existing render+model path (isPlace=!e.p, anchorOf/tierOf/
        # buildComposite consume e.p; the popover reads e.text.slug) and the 52
        # model tests. R2b may migrate consumers to kind/textSlug and drop these.
        "kind": "event" if is_event else "place",
        "p": is_event,
        "textSlug": text_slug,
        "text": {"slug": text_slug} if text_slug else None,
        "grid": grid,
    }


def first_with_slug(events, slug):
    """First event carrying a slug (rows preserved as a list to keep every
    real placement — a place can legitimately recur at several cells)."""
    for e in events:
        if e["slug"] == slug:
            return e
    return None


def merge_battles(events):
    """Merge the 38 k:'battle' tiles as icon-events.

    Bound cells (battleSlugs.json) attach placement to their existing content
    row; unbound cells become synthetic decorative markers (non-clickable, no
    content). Returns (bound, synthetic) counts. Appends synthetic events.
    """
    battles = json.load(open(BATTLE_TILES))
    slugmap = json.load(open(BATTLE_SLUGS))
    bound = synthetic = 0
    for t in battles:
        r, c, bg = t["r"], t["c"], t.get("bg")
        placement = {"row": r, "col": c, "rowSpan": 1, "colSpan": 1,
                     "bg": bg, "icon": "battle"}
        slug = slugmap.get(f"{r},{c}")
        target = first_with_slug(events, slug) if slug else None
        if target is not None:
            target["grid"] = placement
            bound += 1
        else:
            events.append({
                "slug": f"battle-r{r}-c{c}", "heading": None, "date": None,
                "html": None, "kind": "event", "p": True,
                "textSlug": None, "text": None, "grid": placement,
            })
            synthetic += 1
    return bound, synthetic


def apply_overrides(events):
    """Deep-merge data-overrides.json. Creates {} if absent.

    Per-slug patch applies to the FIRST event with that slug (unknown slugs get
    a bare shell then patched); scalar fields overwrite, grid merges per-key;
    "+new" appends whole event objects. Returns (patched, added) counts.
    """
    if not os.path.exists(OVERRIDES):
        json.dump({}, open(OVERRIDES, "w"))
        return 0, 0
    ov = json.load(open(OVERRIDES))
    patched = added = 0
    for slug, patch in ov.items():
        if slug == "+new":
            for ev in patch:
                events.append(ev)
                added += 1
            continue
        ev = first_with_slug(events, slug)
        if ev is None:
            ev = {"slug": slug, "heading": None, "date": None, "html": None,
                  "kind": "event", "p": True, "textSlug": None, "text": None,
                  "grid": None}
            events.append(ev)
        grid_patch = patch.get("grid")
        for k, v in patch.items():
            if k == "grid":
                continue
            ev[k] = v
        if grid_patch is not None:
            base = dict(ev.get("grid") or {})
            base.update(grid_patch)
            ev["grid"] = base
        patched += 1
    return patched, added


def sort_key(ev):
    g = ev.get("grid")
    if not g:
        return (1, 0, 0, ev["slug"])
    return (0, g.get("row", 0), g.get("col", 0), ev["slug"])


def main():
    rows = fetch_gql()
    # One event per row (a list, not a slug-keyed map): a place can legitimately
    # recur at several cells, so collapsing by slug would drop real tiles. bySlug
    # in Timeline.js resolves the popover content-preferring.
    events = []
    dropped = 0
    for r in rows:
        ev = transform_row(r)
        if ev is None:
            dropped += 1
            continue
        events.append(ev)

    bound, synthetic = merge_battles(events)
    apply_overrides(events)

    events = sorted(events, key=sort_key)
    json.dump({"events": events}, open(OUT, "w"),
              indent=2, sort_keys=True, ensure_ascii=False)
    with open(OUT, "a") as f:
        f.write("\n")

    placed = sum(1 for e in events if e.get("grid"))
    with_content = sum(1 for e in events if e.get("heading") or e.get("html"))
    icon_events = sum(1 for e in events
                      if e.get("grid") and e["grid"].get("icon"))
    synth_markers = sum(1 for e in events if e["slug"].startswith("battle-r"))
    print(f"dropped pure-null rows : {dropped}")
    print(f"total events           : {len(events)}")
    print(f"  placed (grid != null): {placed}")
    print(f"  with content         : {with_content}")
    print(f"  icon-events (battle) : {icon_events}")
    print(f"  synthetic markers    : {synth_markers}")
    print(f"  bound battle rows    : {bound}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
