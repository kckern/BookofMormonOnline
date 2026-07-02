#!/usr/bin/env python3
"""Retire the 38 k:'battle' tiles from gridTiles.json (R2a).

Battles now render purely from timelineData.json icon-events at the same cells,
so their canvas tiles are redundant. Fills/places/shapes/breaks/dateAxis stay.
Idempotent: re-running after removal is a no-op. Preserves the compact
single-line formatting of gridTiles.json (minimal diff).
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, os.pardir, os.pardir))
GRID_TILES = os.path.join(
    REPO, "frontend", "webapp", "src", "views", "Timeline", "gridTiles.json")


def main():
    data = json.load(open(GRID_TILES))
    before = len(data["tiles"])
    data["tiles"] = [t for t in data["tiles"] if t.get("k") != "battle"]
    removed = before - len(data["tiles"])
    with open(GRID_TILES, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"removed {removed} k:'battle' tiles; {len(data['tiles'])} tiles remain")


if __name__ == "__main__":
    main()
