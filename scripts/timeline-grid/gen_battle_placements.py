#!/usr/bin/env python3
"""Emit UPDATE statements giving bound battle rows a grid placement (1×1 at the
tile cell, bg = attacker color). Apply via BoMOnlineWorkspace/sql/migrations —
the dev DB user here is read-only. Idempotent: only touches rows with
grid_row IS NULL."""
import json, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
tiles = {
    f'{t["r"]},{t["c"]}': t
    for t in json.loads((ROOT / "frontend/webapp/src/views/Timeline/gridTiles.json").read_text())["tiles"]
    if t.get("k") == "battle"
}
mapping = json.loads((ROOT / "frontend/webapp/src/views/Timeline/battleSlugs.json").read_text())
out = ["-- battle placements from battleSlugs.json (gen_battle_placements.py)",
       "-- Apply to bom_prd via BoMOnlineWorkspace. Idempotent (grid_row IS NULL guard).",
       "-- PRECONDITION: the frontend BATTLE_BOUND suppression (plan Task 7 Step 0)",
       "-- must be deployed FIRST, or these rows render duplicate chips and kill",
       "-- incursion detection. ROLLBACK: the paired _rollback.sql below.",
       "-- ALSO at apply time: delete the k='battle' tiles from frontend/webapp/src/views/Timeline/gridTiles.json (see plan Task 7 reconciliation) and deploy that frontend change in the same window."]
rollback = ["-- rollback: clear the battle placements applied by the paired file"]
for key, slug in sorted(mapping.items()):
    t = tiles.get(key)
    if not t:
        raise SystemExit(f"mapping key {key} has no battle tile")
    r, c = key.split(",")
    bg = t.get("bg") or ""
    out.append(
        "UPDATE bom_timeline SET "
        f"grid_row={r}, grid_col={c}, grid_w=1, grid_h=1, grid_bg='{bg}', "
        f"grid_icon='battle', label_category='event' "
        f"WHERE slug='{slug}' AND grid_row IS NULL LIMIT 1;"
        # LIMIT 1: prod has 5 duplicated slugs (audit §3.1); place only one row
        # grid_icon: battles are EVENTS WITH AN ICON (KC directive), rendered by
        # the marker path — requires Task 12's DDL to be applied first
    )
    rollback.append(
        "UPDATE bom_timeline SET grid_row=NULL, grid_col=NULL, grid_w=NULL, "
        f"grid_h=NULL, grid_bg=NULL, grid_icon=NULL "
        f"WHERE slug='{slug}' AND grid_row={r} AND grid_col={c};"
    )
stamp = datetime.date.today().isoformat()
dest = ROOT / "scripts/timeline-grid" / f"{stamp}_bom_timeline_battle_placements.sql"
dest.write_text("\n".join(out) + "\n")
(dest.with_name(dest.stem + "_rollback.sql")).write_text("\n".join(rollback) + "\n")
print(f"{len(mapping)} updates → {dest} (+ rollback)")
