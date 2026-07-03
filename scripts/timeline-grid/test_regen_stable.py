#!/usr/bin/env python3
"""Regen-stability guard: every data-overrides.json edit must be reflected in the
shipped timelineData.json, using the SAME first-match semantics gen_timeline_data.py
uses (first_with_slug). This keeps `data-overrides.json` a faithful source of truth
so a regeneration is a no-op — nobody loses design work to a stale override.

Run: python3 scripts/timeline-grid/test_regen_stable.py   (exit 0 = stable)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, os.pardir, os.pardir))
TL = os.path.join(REPO, "frontend", "webapp", "src", "views", "Timeline", "timelineData.json")
OV = os.path.join(HERE, "data-overrides.json")


def first_with_slug(events, slug):
    for e in events:
        if e.get("slug") == slug:
            return e
    return None


def main():
    events = json.load(open(TL))["events"]
    ov = json.load(open(OV))
    errors = []

    for slug, patch in ov.items():
        if slug == "+new":
            for ev in patch:
                if first_with_slug(events, ev["slug"]) is None:
                    errors.append(f"+new event '{ev['slug']}' absent from timelineData.json")
            continue
        e = first_with_slug(events, slug)
        if e is None:
            errors.append(f"override slug '{slug}' absent from timelineData.json")
            continue
        # scalar fields must match
        for k, v in patch.items():
            if k == "grid":
                continue
            if e.get(k) != v:
                errors.append(f"{slug}.{k}: override={v!r} shipped={e.get(k)!r}")
        # grid subfields must be present with the override value
        g = patch.get("grid") or {}
        eg = e.get("grid") or {}
        for k, v in g.items():
            if eg.get(k) != v:
                errors.append(f"{slug}.grid.{k}: override={v!r} shipped={eg.get(k)!r}")

    if errors:
        print("REGEN-STABILITY FAIL — overrides have drifted from timelineData.json:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print(f"OK: {len([k for k in ov if k != '+new'])} override slugs + "
          f"{len(ov.get('+new', []))} new events all reflected in timelineData.json")


if __name__ == "__main__":
    main()
