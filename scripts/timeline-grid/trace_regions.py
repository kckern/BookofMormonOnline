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


def fill_enclosed_holes(cell, rows, cols, small=8):
    """Enclosed holes (not reachable from the canvas border) are NOT negative
    space — they read as blank parchment cracks. Fill them:
      - any size when a SINGLE color borders them (classic pill hole-patcher);
      - up to `small` cells when SEVERAL colors border them (the thin 1-row gaps
        the bitmap left between stacked defection/escape bars — filled with the
        dominant bordering color so the bars abut cleanly).
    Larger multi-color enclosed cutouts (e.g. the intentional Ammon diamond notch)
    exceed `small` and are preserved. Backdrop between separate peoples is border-
    reachable → in `outside` → never touched."""
    outside = set()
    st = [(0, c) for c in range(cols + 2)] + [(rows + 1, c) for c in range(cols + 2)]
    st += [(r, 0) for r in range(rows + 2)] + [(r, cols + 1) for r in range(rows + 2)]
    while st:
        r, c = st.pop()
        if not (0 <= r <= rows + 1 and 0 <= c <= cols + 1) or (r, c) in outside or (r, c) in cell:
            continue
        outside.add((r, c))
        st += [(r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)]
    seen = set()
    for r in range(1, rows + 1):
        for c in range(1, cols + 1):
            if (r, c) in cell or (r, c) in outside or (r, c) in seen:
                continue
            comp = []
            edge = collections.Counter()
            stack = [(r, c)]
            seen.add((r, c))
            while stack:
                rr, cc = stack.pop()
                comp.append((rr, cc))
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    n = (rr + dr, cc + dc)
                    if n in cell:
                        edge[cell[n]] += 1
                    elif n not in outside and n not in seen:
                        seen.add(n)
                        stack.append(n)
            if len(edge) == 1 or (edge and len(comp) <= small):
                col = edge.most_common(1)[0][0]
                for p in comp:
                    cell[p] = col


# Editorial weave overrides (design doc §"per-crossing weave"): where a people
# genuinely occupies a continuous body but the single-color bitmap interleaved it
# with the territory it wove through (each cell holds only the *topmost* color), the
# on-top body reads as beads-on-a-string. Solidify its core so it renders as one
# region; the interleaved cells become absorbed slivers (see absorb_islands).
# Each entry: (color, row0, row1, col0, col1) inclusive — the body's core rectangle.
SOLIDIFY = [
    ("#6fa8dc", 80, 108, 21, 26),   # Gadianton robber band (weaves Lamanite/Nephite)
]


def apply_solidify(cell):
    for color, r0, r1, c0, c1 in SOLIDIFY:
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                cell[(r, c)] = color


def absorb_islands(cell, maxsize=12, frac=0.5):
    """Weave leaves tiny single-color slivers stranded inside another region — the
    'orphaned floating pills' the parity review flagged. A small component (<= maxsize
    cells) whose border is >= `frac` one color is show-through of the region on top of
    it: recolor it to that dominant neighbor so it merges cleanly instead of floating.
    Large components (labeled war-band arms, era-separated bodies) are left alone."""
    changed = True
    while changed:
        changed = False
        for color, cells in components(cell):
            if len(cells) > maxsize:
                continue
            edge = collections.Counter()
            for (r, c) in cells:
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    v = cell.get((r + dr, c + dc))
                    if v and v != color:
                        edge[v] += 1
            if not edge:
                continue
            top, n = edge.most_common(1)[0]
            if n / sum(edge.values()) >= frac:
                for p in cells:
                    cell[p] = top
                changed = True


def despur(cell, passes=2):
    """Trim lone single-cell spurs: a cell with <=1 same-color orthogonal
    neighbour and >=3 neighbours of one OTHER color is a 1-cell protrusion the
    bitmap left poking into the adjacent territory (e.g. a bar's ragged right
    edge alternating one cell in/out). At the seam-seal stroke width these read
    as stray colored slivers/outlines floating in the neighbour. Recolor them to
    that dominant neighbour so bar edges land clean. Two passes only, so genuine
    thin arms lose at most a stray tip, never their whole body."""
    for _ in range(passes):
        change = {}
        for (r, c), cur in list(cell.items()):
            nb = collections.Counter()
            same = 0
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                v = cell.get((r + dr, c + dc))
                if v == cur:
                    same += 1
                elif v:
                    nb[v] += 1
            if same <= 1 and nb:
                top, n = nb.most_common(1)[0]
                if n >= 3:
                    change[(r, c)] = top
        for p, v in change.items():
            cell[p] = v


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
    """Emit a path for one loop, rounding only CONVEX corners. Concave (reflex)
    corners stay sharp: rounding a concave corner pulls the silhouette inward and —
    because each cell holds a single color, so nothing is drawn beneath — exposes the
    parchment backdrop as a triangular 'cream leak' (the systemic defect the parity
    review flagged). A convex corner bulges outward over its own body, so it rounds
    safely. Convexity is measured relative to the loop's own orientation, so hole
    loops round correctly too. Radius is clamped to half the shorter adjacent edge."""
    n = len(lp)
    if n < 3:
        return ""
    orient = 1 if signed_area(lp) > 0 else -1
    pts = []
    for i in range(n):
        a, b, c = lp[i - 1], lp[i], lp[(i + 1) % n]
        din = (b[0] - a[0], b[1] - a[1])
        dout = (c[0] - b[0], c[1] - b[1])
        lin = (abs(din[0]) + abs(din[1])) or 1        # rectilinear -> manhattan = length
        lout = (abs(dout[0]) + abs(dout[1])) or 1
        cross = din[0] * dout[1] - din[1] * dout[0]    # turn direction
        convex = cross * orient > 0
        r = min(radius, lin / 2, lout / 2) if convex else 0
        uin = (din[0] / lin, din[1] / lin)
        uout = (dout[0] / lout, dout[1] / lout)
        entry = (b[0] - uin[0] * r, b[1] - uin[1] * r)
        exit_ = (b[0] + uout[0] * r, b[1] + uout[1] * r)
        pts.append((entry, b, exit_, r))
    d = f"M{_f(pts[0][0][0])} {_f(pts[0][0][1])}"
    for i in range(n):
        entry, corner, exit_, r = pts[i]
        if i > 0:
            d += f" L{_f(entry[0])} {_f(entry[1])}"
        if r > 0:                                       # arc the convex corner
            d += f" Q{_f(corner[0])} {_f(corner[1])} {_f(exit_[0])} {_f(exit_[1])}"
        else:                                           # sharp concave corner
            d += f" L{_f(corner[0])} {_f(corner[1])}"
    d += " Z"
    return d


def outer_loop(loops):
    """The single outer boundary of a component (largest |area|). We render regions
    SOLID (outer only, holes dropped) so a base layer fills continuously BENEATH the
    enclaves stacked on top of it — a rounded corner or gap on an upper layer then
    reveals the base beneath, never the parchment void. This is the object/layer
    model: peoples are opaque shapes stacked by z, not a flat cell partition."""
    return max(loops, key=lambda l: abs(signed_area(l)))


NEIGH = ((1, 0), (-1, 0), (0, 1), (0, -1))


def layer_regions(comps):
    """Turn connected components into stacked LAYERS. An enclave (a region whose
    boundary is mostly against one LARGER region) sits ON that region: the base's
    fill is extended to cover the enclave's cells, so the base shows through the
    enclave's rounded corners / gaps. Sibling bases that merely abut (each touches
    the other on only part of its border) stay independent and reveal the backdrop
    between them. Returns regions with a solid fill footprint + z (base drawn first)."""
    info = []
    owner = {}
    for color, cells in comps:
        i = len(info)
        s = set(cells)
        info.append({"color": color, "cells": s, "area": len(s)})
        for p in s:
            owner[p] = i
    # perimeter analysis: edges against other regions (adj) vs the exterior void.
    # An ENCLAVE is mostly ENCLOSED by one larger region; a BASE has lots of its
    # perimeter open to the backdrop (or is split among many neighbours) and must
    # stay independent even if it happens to abut a bigger region (e.g. Jaredites
    # touch the Mulekite gold but front open backdrop on every other side).
    for i, rg in enumerate(info):
        adj = collections.Counter()
        perim = ext = 0
        for (r, c) in rg["cells"]:
            for dr, dc in NEIGH:
                n = (r + dr, c + dc)
                j = owner.get(n)
                if j == i:
                    continue
                perim += 1                       # any edge not against self is perimeter
                if j is None:
                    ext += 1                     # edge against the exterior void/backdrop
                else:
                    adj[j] += 1
        rg["adj"] = adj
        rg["ext"] = ext / perim if perim else 1.0
    # A region is an ENCLAVE only if it is almost fully enclosed by other regions
    # (little exterior exposure) — then it sits ON its largest-area neighbour and
    # that base fills beneath it. A region that fronts the backdrop is a BASE, even
    # if it abuts a bigger region (Jaredites touch Mulekite gold but are otherwise
    # open). Largest-area (not most-bordering) neighbour avoids mutual-embed cycles.
    for rg in info:
        base = None
        if rg["ext"] < 0.15 and rg["adj"]:
            j = max(rg["adj"], key=lambda k: info[k]["area"])
            if info[j]["area"] > rg["area"]:
                base = j
        rg["base"] = base
    # push each enclave's footprint down onto its base (smallest first → chains fold)
    fill = [set(rg["cells"]) for rg in info]
    for i in sorted(range(len(info)), key=lambda i: info[i]["area"]):
        b = info[i]["base"]
        if b is not None:
            fill[b] |= fill[i]
    for i, rg in enumerate(info):
        rg["fill"] = fill[i]
    return info


def path_d(loops):
    return "".join(rounded_loop(lp) for lp in loops if len(lp) >= 3)


def main():
    grid = json.load(open(GRID))
    cell = build_cellmap(grid["tiles"])
    apply_solidify(cell)                                # weld authored weave bodies
    absorb_islands(cell)                                # merge stranded weave slivers
    fill_enclosed_holes(cell, grid["rows"], grid["cols"])
    despur(cell)                                        # trim 1-cell edge protrusions
    layers = layer_regions(components(cell))
    regions = []
    for rg in layers:
        loops = trace_loops(rg["fill"])          # solid footprint (own + enclaves on it)
        if not loops:
            continue
        d = rounded_loop(outer_loop(loops))      # solid: outer boundary only, no holes
        regions.append({
            "color": rg["color"],
            "cells": len(rg["cells"]),
            "area": len(rg["fill"]),
            "d": d,
        })
    # z-order: a layer with a larger solid footprint sits lower (a base others stack
    # on); smaller footprints draw last, on top, revealing the base at their corners
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
