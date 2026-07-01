# Timeline source artwork — design-language decode

Derived from the original unlabeled band-layer artwork of the legacy timeline
(760×3381 master, saved at
`docs/audits/timeline-ux-screenshots-2026-07-01/source-artwork-master.png`).
This is the shape vocabulary the grid rebuild must reproduce. It **supersedes
several assumptions** in the 2026-07-01 audit and plan: the original does NOT
tell its story with rectangles + corner rounding alone — it has a semantic
vocabulary of gradients, fillets, ribbons, and end-cap treatments.

## The vocabulary (what each visual device MEANS)

| Device | Appearance | Semantic | Sites in the artwork |
|---|---|---|---|
| **Gradient dissolve** | one band's color blends into another over many rows (long vertical gradient), or along a bar's length | succession, assimilation, transformation — one people *becomes* another; never used for conquest | Lehi purple→schism dark; Jaredite teal→Mulekite mustard (Coriantumr's end); Nephite-kings navy→judges green (Mosiah II handoff); Limhi's-people tan bar→green (absorbed into Zarahemla); unified-era gray→green AND gray→maroon (Zion society dissolving back into Nephite/Lamanite); teal→maroon *along* a bar (allegiance change mid-journey) |
| **Fade-out** | band edge feathers to nothing | the record ends, the people continue | maroon Lamanite mass at the very bottom (post-Cumorah) |
| **Concave fillet** | inner elbow corners are rounded *inward* (quarter-arc of band color filling the notch) | same band changing width/direction smoothly — reads as one organic shape | Mulekite elbow (thin horiz → wide column); Ammon's-mission gold block shoulders → narrow stem; judges-green column footing |
| **Journey ribbon** | thin (1-cell) band that travels with rounded outer elbows, loops | an expedition/flight route through time-space | tan Limhi-escape ribbon looping around the Zeniff block; blue Alma-flight ribbon; gold Sons-of-Mosiah stem+elbow |
| **U-turn loop** | ribbon goes out, makes a rounded 180° turn, comes back | out-and-back journey (failed/returned expedition) | navy Ill-Fated Expedition bar — it does NOT terminate, it loops back |
| **Rounded end-cap** | bar tip is stadium-rounded inside another band | incursion/penetration (military or missionary) into that territory | maroon caps into blue Zeniff block; green cap into maroon (missionaries); light-blue Gadianton raid caps into green at staggered depths |
| **Square end** | bar end flush against/inside its origin band | departure point (no special meaning) | nearly all bars at their origin side |
| **Diagonal edge** | slanted band boundary | drift/divergence/schism of peoples | maroon Lamanite mass edges; maroon↔navy seam; orange Alma's-people V-split; maroon Z-connector (defection route between columns) |
| **Tone-on-tone inset** | slightly darker rounded patch INSIDE a band | internal movements hidden within a society (secret societies) | darker-green rounded patches inside judges green (Gadianton presence within Nephite society) |
| **Interior lozenge** | pointed vesica/lozenge hole inside a block | territory gaps between mission cities | maroon lozenges inside the gold Ammon's-mission block |
| **Floating chip** | small fully-rounded (4-corner) island | brief self-contained episode | purple Lehites-in-Jerusalem chip |
| **Rounded outer corner** | generous radius on true silhouette corners; junctions stay square | band begins/ends into open space | everywhere; incl. the black destruction band's rounded top corners |
| **Pass-under / re-emerge** | a ribbon/bar disappears behind a band and pops out the far side | a journey THROUGH another people's territory (they crossed it, didn't act in it) | bars crossing the judges-green column and re-emerging right; the Ill-Fated U-turn exits through green and returns through it |
| **Cross-over** | a bar drawn ON TOP of a band it crosses | events happening IN that territory while passing | war-chapter army bars over green; Gadianton raid caps INTO green (cap = stops inside, cross = passes through) |

Two global notes:
- The **post-Christ unified era is silver-gray** in the artwork (not the sheet's
  `#fff2cc` cream), and its dissolution into green+maroon gradients is the single
  strongest storytelling moment on the canvas.
- Bar clusters ("the barcode" in the war chapters) exist in the source too, with
  open background between them — the cluster reads intentional there because the
  bars have *differentiated end treatments* (caps, fades, U-turns), not because
  the gaps are filled.

## Cross-check: key grid regions vs. the artwork

| # | Region | Artwork | Grid today | Verdict |
|---|---|---|---|---|
| 1 | Jaredite elbow | rounded outers, filleted inner elbow; teal→mustard gradient handoff to Mulekites | hard rectangles; handoff missing entirely | ✗ add fillet + gradient |
| 2 | Lehi schism | purple fades into dark, then diagonal red/navy divergence | hard purple block, abrupt band starts | ✗ gradient + diagonals |
| 3 | Jerusalem chip | floating fully-rounded chip | band-attached cells | ~ acceptable |
| 4 | Kings→judges (Mosiah II) | navy→green vertical dissolve | hard color change | ✗ gradient |
| 5 | Zeniff colony block | tan+blue journey ribbons LOOP around the block, rounded elbows | block + disconnected straight bars | ✗ ribbons lost |
| 6 | Ill-Fated Expedition | navy U-turn loop (goes out, comes back) | single straight bar | ✗ narrative lost |
| 7 | Limhi's escape | wide tan bar dissolving INTO green (assimilation) | hard-ended bar | ✗ gradient end |
| 8 | Ammon's mission block | filleted shoulders, lozenge holes, stem+elbow return route | wedding-cake steps, rectangular holes | ✗ fillets; lozenge cosmetic |
| 9 | War-chapter bars | ends differentiated: caps / fades / square by meaning | uniform rectangles | ✗ end-cap vocabulary |
| 10 | Gadianton | light-blue raids w/ rounded caps at staggered depths; dark-green insets inside the green band | one big slate block; no insets | ✗ caps exist post-plan; insets missing |
| 11 | Destruction band | full-width black, rounded top corners | 1-row square band | ~ round the tops |
| 12 | Post-Christ era | silver-gray; long dissolves back into green + maroon | cream (near-invisible); hard blocks | ✗ color + gradients |
| 13 | Record's end | maroon feathers out to nothing | hard bottom edge | ✗ fade-out |

## Colors are TOKENS, not values (KC directive, 2026-07-01)

The hex values above identify lineages; they are not sacred. The renderer must
abstract every color into a **semantic token** (`jaredites`, `lehi`, `nephites`,
`lamanites`, `zeniff`, `alma`, `kings`, `mulek`, `judges`, `gadianton`,
`destruction`, `unity`) defined once as CSS custom properties on the grid root,
with swappable theme swatches (parchment theme, dark/prod theme, …). Source-data
hexes (sheet `bg`, `grid_bg`) act only as KEYS resolving to tokens; all painting
goes through `var(--c-<token>)`. What must be faithful to this artwork is the
**geometry and layering** — rounding, junctions, fillets, diagonals, dissolves,
occlusion — not the swatch values.

The layering consequence of the occlusion devices: bars/ribbons need an
`under | over` z-assignment relative to band fills (per bar, or per crossing
segment). "Under" ribbons render beneath band fills and re-emerge naturally
where the band ends; "over" bars render above (today's only mode).

## Implementation notes (consumed by the 2026-07-01 plan, Phase 8)

All are `gridTiles.json` canvas devices — no DB changes:

- `k:"grad"` tile: `{from, to, dir:'v'|'h'}` → `linear-gradient` fill; stamps the
  band layer with `from` so neighbors stay square against it.
- `k:"fillet"` tile: `{dir:'tl'|'tr'|'bl'|'br', bg}` — paints the cell EXCEPT a
  quarter-disc of parchment at the named (open) corner:
  `radial-gradient(circle R at <corner>, transparent R-δ, bg R)`.
- `k:"fade"` tile: `{bg, dir}` → `linear-gradient(bg → transparent)`.
- `k:"bevel"` (already planned): diagonal edges.
- U-turn/ribbons: authored from ordinary 1-cell fills — corner rule v2 rounds
  their outer elbows automatically; fillets handle the inner elbows.
- Tone-on-tone insets: fill tiles in a −12% lightness variant of the band color,
  stamped ABOVE the band in the bar layer.
- Priority per storytelling weight: post-Christ dissolves (#12) > schism (#2) >
  kings→judges (#4) > record-end fade (#13) > Jaredite handoff (#1) > fillets
  (#8) > U-turn (#6) > bar end-caps (#9) > insets (#10) > lozenges (#8b).
