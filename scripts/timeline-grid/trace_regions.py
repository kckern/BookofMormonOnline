#!/usr/bin/env python3
"""Trace the color-cell grid into connected REGION polygons (SVG paths) — the
foundation of the object/layer timeline (see docs/plans/2026-07-02-timeline-object-
model-design.md). Grid-strict: every vertex is an integer grid coordinate
(x=col, y=row). Output: frontend/webapp/src/views/Timeline/scene.json.

Region = one connected same-color component (body + its connected appendages/arms).
Boundary traced by the cancel-shared-edges method (each cell emits a CW micro-loop;
edges shared by two cells cancel; the remainder are the boundary loops — outer +
holes), then collinear points are merged. Fill/z/treatments are layered on later.
"""
import json, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, os.pardir, os.pardir))
GRID = os.path.join(REPO, "frontend", "webapp", "src", "views", "Timeline", "gridTiles.json")
OUT = os.path.join(REPO, "frontend", "webapp", "src", "views", "Timeline", "scene.json")


def cell_color(t):
    # shape tiles carry their dominant color in bg (bevel/fade) or from (grad)
    return t.get("bg") or t.get("from")


def build_cellmap(tiles):
    cell = {}
    for t in tiles:
        c = cell_color(t)
        if not c or c == "#ffffff":
            continue
        for dr in range(t.get("h", 1)):
            for dc in range(t.get("w", 1)):
                cell[(t["r"] + dr, t["c"] + dc)] = c
    return cell


def components(cell):
    """Connected same-color components (4-neighbour flood)."""
    seen = set()
    comps = []
    for start in cell:
        if start in seen:
            continue
        color = cell[start]
        stack = [start]
        seen.add(start)
        cells = []
        while stack:
            r, c = stack.pop()
            cells.append((r, c))
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (r + dr, c + dc)
                if n not in seen and cell.get(n) == color:
                    seen.add(n)
                    stack.append(n)
        comps.append((color, cells))
    return comps


def trace_loops(cells):
    """Return boundary loops (lists of (x,y) grid points) via edge cancellation.
    Cell (r,c) covers the unit square with corners (c,r)-(c+1,r)-(c+1,r+1)-(c,r+1);
    x=col, y=row, y increases downward. CW micro-loop: A->B->C->D->A."""
    cellset = set(cells)
    edges = set()
    for (r, c) in cells:
        A, B, C, D = (c, r), (c + 1, r), (c + 1, r + 1), (c, r + 1)
        for p, q in ((A, B), (B, C), (C, D), (D, A)):
            if (q, p) in edges:      # shared interior edge — cancels
                edges.discard((q, p))
            else:
                edges.add((p, q))
    # walk directed edges into loops
    out_map = collections.defaultdict(list)
    for (p, q) in edges:
        out_map[p].append(q)
    loops = []
    used = set()
    for (p0, q0) in list(edges):
        if (p0, q0) in used:
            continue
        loop = [p0]
        p, q = p0, q0
        while True:
            used.add((p, q))
            loop.append(q)
            if q == p0:
                break
            nxts = [n for n in out_map[q] if (q, n) not in used]
            if not nxts:
                break
            # prefer a straight continuation, else turn (keeps loops simple)
            dx, dy = q[0] - p[0], q[1] - p[1]
            straight = (q[0] + dx, q[1] + dy)
            nxt = straight if straight in nxts else nxts[0]
            p, q = q, nxt
        loops.append(simplify(loop))
    return loops


def simplify(loop):
    """Drop collinear midpoints; loop starts and ends at the same vertex."""
    if loop and loop[0] == loop[-1]:
        loop = loop[:-1]
    out = []
    n = len(loop)
    for i in range(n):
        a, b, c = loop[i - 1], loop[i], loop[(i + 1) % n]
        # keep b only if it's a corner (direction changes)
        if (b[0] - a[0], b[1] - a[1]) != (c[0] - b[0], c[1] - b[1]):
            out.append(b)
    return out


def signed_area(loop):
    s = 0
    n = len(loop)
    for i in range(n):
        x1, y1 = loop[i]
        x2, y2 = loop[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return s / 2.0


def _f(v):
    return f"{v:.3f}".rstrip("0").rstrip(".")


def rounded_loop(lp, radius=0.45):
    """Emit a path for one loop with every corner rounded by up to `radius` grid
    units (clamped to half the shorter adjacent edge, so short arms/notches keep
    proportional rounding). Grid-strict: corners are offsets along grid edges."""
    n = len(lp)
    if n < 3:
        return ""
    pts = []
    for i in range(n):
        a, b, c = lp[i - 1], lp[i], lp[(i + 1) % n]
        din = (b[0] - a[0], b[1] - a[1])
        dout = (c[0] - b[0], c[1] - b[1])
        lin = (abs(din[0]) + abs(din[1])) or 1        # rectilinear -> manhattan = length
        lout = (abs(dout[0]) + abs(dout[1])) or 1
        r = min(radius, lin / 2, lout / 2)
        uin = (din[0] / lin, din[1] / lin)
        uout = (dout[0] / lout, dout[1] / lout)
        entry = (b[0] - uin[0] * r, b[1] - uin[1] * r)
        exit_ = (b[0] + uout[0] * r, b[1] + uout[1] * r)
        pts.append((entry, b, exit_))
    d = f"M{_f(pts[0][0][0])} {_f(pts[0][0][1])}"
    for i in range(n):
        entry, corner, exit_ = pts[i]
        # line to this corner's entry, quadratic around the corner to its exit
        if i > 0:
            d += f" L{_f(entry[0])} {_f(entry[1])}"
        d += f" Q{_f(corner[0])} {_f(corner[1])} {_f(exit_[0])} {_f(exit_[1])}"
    d += " Z"
    return d


def path_d(loops):
    return "".join(rounded_loop(lp) for lp in loops if len(lp) >= 3)


def main():
    grid = json.load(open(GRID))
    cell = build_cellmap(grid["tiles"])
    regions = []
    for color, cells in components(cell):
        loops = trace_loops(cells)
        if not loops:
            continue
        # outer loop = largest |area|; keep all (holes render via nonzero/evenodd)
        area = sum(abs(signed_area(l)) for l in loops)
        regions.append({
            "color": color,
            "cells": len(cells),
            "area": area,
            "d": path_d(loops),
        })
    # z-order heuristic: larger regions sit lower (background), smaller/arms on top
    regions.sort(key=lambda r: -r["area"])
    for z, r in enumerate(regions):
        r["z"] = z
        del r["area"]
    scene = {"cols": grid["cols"], "rows": grid["rows"],
             "dateAxis": grid.get("dateAxis", []), "regions": regions}
    json.dump(scene, open(OUT, "w"), separators=(",", ":"))
    print(f"traced {len(regions)} regions from {len(cell)} cells -> {OUT}")
    by_color = collections.Counter(r["color"] for r in regions)
    print("regions per color:", dict(by_color))


if __name__ == "__main__":
    main()
