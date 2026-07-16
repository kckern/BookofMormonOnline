import React, { useEffect, useMemo, useState } from "react";
import { label } from "src/models/Utils";
import "./Theology.css";
import {
  AXES,
  QUADRANTS,
  NODES,
  FUNNEL,
  OFF_PATTERN,
  NODE_INDEX,
} from "./Theology.data";

/**
 * Theology view — interactive framework SCAFFOLD.
 *
 * Renders the two-opposition plane (axes + four quadrants) with the
 * Doctrine-of-Christ funnel (inverted triangle + vertices) laid over it, plus
 * an off-pattern rail. Every node wires the interaction ladder
 * label → tooltip → info box → drill-down to PLACEHOLDER data.
 *
 * Design + open questions: docs/specs/2026-07-15-theology-view.md
 */

// --- SVG canvas + plane geometry (pixels) ---------------------------------
const W = 1000;
const H = 760;
const BOX = { x0: 140, x1: 860, y0: 90, y1: 630 };
const CX = (BOX.x0 + BOX.x1) / 2;
const CY = (BOX.y0 + BOX.y1) / 2;
const SX = (BOX.x1 - BOX.x0) / 2; // half-width  → x=1 maps to right edge
const SY = (BOX.y1 - BOX.y0) / 2; // half-height → y=1 maps to top edge

const px = (x) => CX + x * SX;
const py = (y) => CY - y * SY;

// Everything the map can render as a clickable point.
const FUNNEL_NODES = FUNNEL.steps;

export default function Theology() {
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  useEffect(() => {
    document.title = label("menu_theology") + " | " + label("home_title");
  }, []);

  const selected = selectedId ? NODE_INDEX[selectedId] : null;
  const hovered = hoveredId ? NODE_INDEX[hoveredId] : null;

  const select = (id) => {
    setSelectedId(id);
    setExpanded(false);
  };

  return (
    <div className="theologyView">
      <header className="theologyHeader">
        <h2>{label("menu_theology")}</h2>
        <p className="theologySub">
          A working map of Book of Mormon theology — click a label for a tooltip,
          click a node to open it, expand to drill down.
          <span className="theologyScaffoldTag">scaffold · placeholder data</span>
        </p>
      </header>

      <div className="theologyStage">
        <div
          className="theologyMapWrap"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
          }}
          onMouseLeave={() => setHoveredId(null)}
        >
          <Map
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={select}
          />
          {hovered && (
            <div
              className="theologyTooltip"
              style={{ left: cursor.x + 14, top: cursor.y + 14 }}
            >
              <strong>{hovered.title}</strong>
              <span className="theologyTooltipType">{typeOf(hovered)}</span>
              <p>{hovered.oneLiner}</p>
            </div>
          )}
        </div>

        <aside className="theologyPanel">
          {selected ? (
            <InfoBox
              node={selected}
              expanded={expanded}
              onToggleExpand={() => setExpanded((v) => !v)}
              onSelect={select}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <DefaultPanel />
          )}
        </aside>
      </div>

      <OffPatternRail
        items={OFF_PATTERN}
        onHover={setHoveredId}
        onSelect={select}
        selectedId={selectedId}
      />
    </div>
  );
}

// ==========================================================================
// The map (SVG)
// ==========================================================================
function Map({ selectedId, hoveredId, onHover, onSelect }) {
  const quadRects = useMemo(
    () => [
      { q: byCorner("top-right"), x: CX, y: BOX.y0, w: BOX.x1 - CX, h: CY - BOX.y0 },
      { q: byCorner("top-left"), x: BOX.x0, y: BOX.y0, w: CX - BOX.x0, h: CY - BOX.y0 },
      { q: byCorner("bottom-right"), x: CX, y: CY, w: BOX.x1 - CX, h: BOX.y1 - CY },
      { q: byCorner("bottom-left"), x: BOX.x0, y: CY, w: CX - BOX.x0, h: BOX.y1 - CY },
    ],
    []
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="theologyMap" role="img">
      {/* --- quadrants --- */}
      {quadRects.map(({ q, x, y, w, h }) => (
        <g
          key={q.id}
          className={`theologyQuad kind-${q.kind} ${selectedId === q.id ? "is-selected" : ""}`}
          onMouseEnter={() => onHover(q.id)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onSelect(q.id)}
        >
          <rect x={x} y={y} width={w} height={h} rx="4" />
          <text className="theologyQuadLabel" x={px(q.center.x)} y={py(q.center.y)}>
            {q.title}
          </text>
        </g>
      ))}

      {/* --- axes --- */}
      <Axis
        x1={BOX.x0} y1={CY} x2={BOX.x1} y2={CY}
        negLabel={AXES.x.negativePole.label}
        posLabel={AXES.x.positivePole.label}
        orientation="h"
      />
      <Axis
        x1={CX} y1={BOX.y1} x2={CX} y2={BOX.y0}
        negLabel={AXES.y.negativePole.label}
        posLabel={AXES.y.positivePole.label}
        orientation="v"
      />

      {/* --- the Doctrine-of-Christ funnel (inverted triangle) --- */}
      <Funnel />

      {/* --- nodes --- */}
      {[...NODES, ...FUNNEL_NODES].map((n) => (
        <Node
          key={n.id}
          node={n}
          isSelected={selectedId === n.id}
          isHovered={hoveredId === n.id}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
}

function Axis({ x1, y1, x2, y2, negLabel, posLabel, orientation }) {
  const isH = orientation === "h";
  return (
    <g className="theologyAxis">
      <line x1={x1} y1={y1} x2={x2} y2={y2} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" markerWidth="9" markerHeight="9" refX="4.5" refY="4.5" orient="auto">
          <path d="M1,1 L8,4.5 L1,8" className="theologyArrowHead" />
        </marker>
      </defs>
      {isH ? (
        <>
          <text className="theologyAxisEnd" x={x1 - 8} y={y1} textAnchor="end" dominantBaseline="middle">{negLabel}</text>
          <text className="theologyAxisEnd" x={x2 + 8} y={y2} textAnchor="start" dominantBaseline="middle">{posLabel}</text>
        </>
      ) : (
        <>
          <text className="theologyAxisEnd" x={x1} y={y1 + 22} textAnchor="middle">{negLabel}</text>
          <text className="theologyAxisEnd" x={x2} y={y2 - 12} textAnchor="middle">{posLabel}</text>
        </>
      )}
    </g>
  );
}

function Funnel() {
  const m = FUNNEL.mouth;
  const v = NODE_INDEX[FUNNEL.vertexId];
  const corner = NODE_INDEX["zion"]; // top-right terminus node (has x/y)
  const trianglePoints = [
    `${px(m.left.x)},${py(m.left.y)}`,
    `${px(m.right.x)},${py(m.right.y)}`,
    `${px(v.x)},${py(v.y)}`,
  ].join(" ");
  // ascent arm: vertex → out toward the gathering corner
  const ascent = `M ${px(v.x)} ${py(v.y)} L ${px(corner.x)} ${py(corner.y)}`;
  return (
    <g className="theologyFunnel">
      <polygon className="theologyFunnelTri" points={trianglePoints} />
      <path className="theologyFunnelAscent" d={ascent} />
      <text className="theologyFunnelLabel" x={px(0)} y={py(m.left.y) - 10} textAnchor="middle">
        Doctrine of Christ — descent ▾ / ascent ▴
      </text>
    </g>
  );
}

function Node({ node, isSelected, isHovered, onHover, onSelect }) {
  const cx = px(node.x);
  const cy = py(node.y);
  const cls = [
    "theologyNode",
    `node-${node.type || "node"}`,
    isSelected ? "is-selected" : "",
    isHovered ? "is-hovered" : "",
  ].join(" ");
  return (
    <g
      className={cls}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(node.id)}
    >
      <circle cx={cx} cy={cy} r={node.type === "pole" || node.type === "terminus" ? 9 : 6} />
      <text className="theologyNodeLabel" x={cx} y={cy - 13} textAnchor="middle">
        {node.title}
      </text>
    </g>
  );
}

// ==========================================================================
// Right panel — info box + drill-down
// ==========================================================================
function InfoBox({ node, expanded, onToggleExpand, onSelect, onClose }) {
  const opposite = node.opposedTo ? NODE_INDEX[node.opposedTo] : null;
  const related = node.related || node.references || [];
  const scriptures = node.scriptures || [];
  const runs = node.runs || [];

  return (
    <div className="theologyInfo">
      <button className="theologyClose" onClick={onClose} aria-label="Close">×</button>
      <span className="theologyInfoType">{typeOf(node)}</span>
      <h3>{node.title}</h3>
      <p className="theologyInfoOneLiner">{node.oneLiner}</p>

      <dl className="theologyInfoMeta">
        {node.axis && (
          <>
            <dt>Axis</dt>
            <dd>{node.axis}</dd>
          </>
        )}
        {opposite && (
          <>
            <dt>Opposite</dt>
            <dd>
              <button className="theologyChip" onClick={() => onSelect(opposite.id)}>
                {opposite.title}
              </button>
            </dd>
          </>
        )}
        <dt>Attached</dt>
        <dd>
          <span className="theologyCount">{scriptures.length} scriptures</span>
          <span className="theologyCount">{runs.length} runs</span>
        </dd>
      </dl>

      {related.length > 0 && (
        <div className="theologyInfoSection">
          <h4>Related</h4>
          <div className="theologyChips">
            {related.map((rid) => {
              const target = NODE_INDEX[rid];
              return target ? (
                <button key={rid} className="theologyChip" onClick={() => onSelect(rid)}>
                  {target.title}
                </button>
              ) : (
                <span key={rid} className="theologyChip is-unplaced" title="not yet placed on the map">
                  {rid}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <button className="theologyExpand" onClick={onToggleExpand}>
        {expanded ? "▴ Collapse" : "▾ Drill down"}
      </button>

      {expanded && (
        <div className="theologyDrill">
          <div className="theologyInfoSection">
            <h4>Commentary</h4>
            <p className="theologyPlaceholder">
              [ placeholder — synthetic / interpretive prose for <em>{node.title}</em> loads
              here once the corpus is ingested. See open questions in the design doc. ]
            </p>
          </div>

          <div className="theologyInfoSection">
            <h4>Scriptures</h4>
            {scriptures.length ? (
              <ul className="theologyRefList">
                {scriptures.map((s, i) => (
                  <li key={i}>
                    <span className="theologyRef">{s.ref}</span>
                    {s.note && <span className="theologyRefNote"> — {s.note}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="theologyPlaceholder">[ no scriptures attached yet ]</p>
            )}
          </div>

          <div className="theologyInfoSection">
            <h4>Runs</h4>
            {runs.length ? (
              <ul className="theologyRunList">
                {runs.map((r) => (
                  <li key={r.id}>
                    <span className="theologyRunDot" /> {r.title}
                    <span className="theologyPlaceholder"> [ traversal TBD ]</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="theologyPlaceholder">[ no runs touch this node yet ]</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DefaultPanel() {
  return (
    <div className="theologyInfo theologyInfoEmpty">
      <h3>The two-opposition plane</h3>
      <p className="theologyInfoOneLiner">
        Two orthogonal oppositions, four quadrants, and the Doctrine-of-Christ funnel
        converging to the baptismal vertex. Time is the trajectory through the plane,
        not an axis of it.
      </p>
      <ul className="theologyLegend">
        <li><span className="lg node-pole" /> Axis pole</li>
        <li><span className="lg node-terminus" /> Terminus / apex</li>
        <li><span className="lg node-threshold" /> Threshold</li>
        <li><span className="lg node-vertex" /> Vertex (funnel step)</li>
      </ul>
      <p className="theologyHint">Hover for a tooltip · click to open · expand to drill down.</p>
    </div>
  );
}

function OffPatternRail({ items, onHover, onSelect, selectedId }) {
  return (
    <div className="theologyRail">
      <span className="theologyRailTitle">Off-pattern <em>— doesn't sit on the plane</em></span>
      <div className="theologyRailItems">
        {items.map((it) => (
          <button
            key={it.id}
            className={`theologyRailChip ${selectedId === it.id ? "is-selected" : ""}`}
            onMouseEnter={() => onHover(it.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(it.id)}
          >
            <strong>{it.title}</strong>
            <span className="theologyRailKind">{it.kind}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- helpers ---------------------------------------------------------------
function byCorner(corner) {
  return QUADRANTS.find((q) => q.corner === corner);
}
function typeOf(node) {
  if (node.corner) return "quadrant";
  if (node.kind) return node.kind;
  if (node.arm) return "vertex · " + node.arm;
  return node.type || "node";
}
