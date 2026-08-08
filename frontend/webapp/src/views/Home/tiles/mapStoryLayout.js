const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const rectForCenter = (id, x, y, width, height) => ({
  id,
  x: x - width / 2,
  y: y - height / 2,
  width,
  height,
});

export const rectanglesOverlap = (a, b, gap = 0) =>
  a.x < b.x + b.width + gap &&
  a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap &&
  a.y + a.height + gap > b.y;

const inside = (rect, width, height, padding) =>
  rect.x >= padding &&
  rect.y >= padding &&
  rect.x + rect.width <= width - padding &&
  rect.y + rect.height <= height - padding;

const overlapsAny = (rect, obstacles, ownId) =>
  obstacles.some((obstacle) => obstacle.id !== ownId && rectanglesOverlap(rect, obstacle, 3));

const labelDimensions = (name, viewportWidth) => {
  const maxWidth = Math.min(176, Math.max(118, viewportWidth * 0.5));
  const estimatedWidth = Math.max(76, String(name).length * 6.4 + 24);
  const width = Math.min(maxWidth, estimatedWidth);
  const charsPerLine = Math.max(12, Math.floor((width - 20) / 6.4));
  const lines = Math.min(2, Math.max(1, Math.ceil(String(name).length / charsPerLine)));
  return { width, height: lines === 1 ? 28 : 42 };
};

const candidateRects = (item, viewportWidth) => {
  const { width, height } = labelDimensions(item.name, viewportWidth);
  const rings = [16, 30, 46, 64, 82];
  const candidates = [];

  rings.forEach((ring) => {
    candidates.push(
      { x: item.x + ring, y: item.y - height / 2, width, height },
      { x: item.x - ring - width, y: item.y - height / 2, width, height },
      { x: item.x - width / 2, y: item.y - ring - height, width, height },
      { x: item.x - width / 2, y: item.y + ring, width, height },
      { x: item.x + ring, y: item.y - ring - height, width, height },
      { x: item.x - ring - width, y: item.y - ring - height, width, height },
      { x: item.x + ring, y: item.y + ring, width, height },
      { x: item.x - ring - width, y: item.y + ring, width, height },
    );
  });

  return candidates;
};

const leaderEnd = (anchor, rect) => ({
  x: clamp(anchor.x, rect.x, rect.x + rect.width),
  y: clamp(anchor.y, rect.y, rect.y + rect.height),
});

const symbolCandidates = (symbol) => {
  const candidates = [{ x: symbol.x, y: symbol.y }];
  const base = Math.max(symbol.width, symbol.height) / 2 + 7;
  [base, base + 14, base + 30, base + 48].forEach((ring) => {
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI / 4, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]
      .forEach((angle) => {
        candidates.push({
          x: symbol.x + Math.cos(angle) * ring,
          y: symbol.y + Math.sin(angle) * ring,
        });
      });
  });
  return candidates;
};

/**
 * Resolves marker-to-marker and marker-to-cluster collisions before labels are
 * placed. High-priority story symbols keep their geographic position when
 * possible; colliding symbols are deterministically displaced and connected
 * back to the real point with a leader line.
 */
export const layoutSymbols = ({ symbols, reservedRects = [], width, height, padding = 6 }) => {
  const occupied = [...reservedRects];
  const placed = [];
  const ordered = [...symbols].sort(
    (a, b) => a.priority - b.priority || a.firstStep - b.firstStep || a.id.localeCompare(b.id),
  );

  ordered.forEach((symbol) => {
    let rect = symbolCandidates(symbol)
      .map((candidate) => rectForCenter(symbol.id, candidate.x, candidate.y, symbol.width, symbol.height))
      .find((candidate) =>
        inside(candidate, width, height, padding) && !overlapsAny(candidate, occupied),
      );

    // Active/anchor/visited symbols are part of the story's meaning and are not
    // silently discarded. A stable grid scan is a last resort for unusually
    // dense or co-located data. Low-priority future symbols may be omitted when
    // a cluster cannot be placed without obscuring current context.
    if (!rect && symbol.required) {
      for (let y = padding; y <= height - symbol.height - padding && !rect; y += 8) {
        for (let x = padding; x <= width - symbol.width - padding; x += 8) {
          const candidate = { id: symbol.id, x, y, width: symbol.width, height: symbol.height };
          if (!overlapsAny(candidate, occupied)) {
            rect = candidate;
            break;
          }
        }
      }
    }

    if (!rect) return;
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    const displacement = Math.hypot(x - symbol.x, y - symbol.y);
    placed.push({
      ...symbol,
      x,
      y,
      anchorX: symbol.x,
      anchorY: symbol.y,
      leader: displacement > 7
        ? { x1: symbol.x, y1: symbol.y, x2: x, y2: y }
        : null,
    });
    occupied.push(rect);
  });

  return placed;
};

/**
 * Places labels in rendered pixels. Active/anchor labels are mandatory; lower
 * priority visited labels are included only when they fit without collisions.
 * The deterministic grid fallback keeps mandatory labels legible even when
 * multiple geographic points collapse into the same few pixels.
 */
export const layoutLabels = ({ items, obstacles, width, height, padding = 8 }) => {
  const placed = [];
  const occupied = [...obstacles];
  const ordered = [...items].sort(
    (a, b) => a.priority - b.priority || a.firstStep - b.firstStep || a.slug.localeCompare(b.slug),
  );

  ordered.forEach((item) => {
    const ownId = `marker:${item.slug}`;
    let rect = candidateRects(item, width).find(
      (candidate) =>
        inside(candidate, width, height, padding) &&
        !overlapsAny(candidate, occupied, ownId),
    );

    // Active endpoints plus story origin/final destination are never dropped.
    // If radial placement cannot find room, scan stable card-space slots and
    // connect the displaced label back to its true map position.
    if (!rect && item.required) {
      const dimensions = labelDimensions(item.name, width);
      for (let y = padding; y <= height - dimensions.height - padding && !rect; y += 8) {
        for (let x = padding; x <= width - dimensions.width - padding; x += 8) {
          const candidate = { x, y, ...dimensions };
          if (!overlapsAny(candidate, occupied, ownId)) {
            rect = candidate;
            break;
          }
        }
      }
    }

    if (!rect) return;
    const end = leaderEnd(item, rect);
    const leaderLength = Math.hypot(end.x - item.x, end.y - item.y);
    const label = {
      ...item,
      ...rect,
      leader: leaderLength > 12 ? { x1: item.x, y1: item.y, x2: end.x, y2: end.y } : null,
    };
    placed.push(label);
    occupied.push({ id: `label:${item.slug}`, ...rect });
  });

  return placed;
};

/**
 * Deterministic, screen-space clustering for lower-priority future stops.
 * Active stops and persistent story anchors never enter this function.
 */
export const clusterFutureStops = (stops, radius = 46) => {
  const groups = [];
  [...stops]
    .sort((a, b) => a.firstStep - b.firstStep || a.slug.localeCompare(b.slug))
    .forEach((stop) => {
      const group = groups.find((candidate) => distance(stop, candidate) <= radius);
      if (!group) {
        groups.push({
          id: `future:${stop.slug}`,
          x: stop.x,
          y: stop.y,
          stops: [stop],
          firstStep: stop.firstStep,
        });
        return;
      }

      group.stops.push(stop);
      group.x = group.stops.reduce((sum, member) => sum + member.x, 0) / group.stops.length;
      group.y = group.stops.reduce((sum, member) => sum + member.y, 0) / group.stops.length;
      group.firstStep = Math.min(group.firstStep, stop.firstStep);
      group.id = `future:${group.stops.map((member) => member.slug).sort().join("+")}`;
    });
  return groups;
};

export const roleForStop = (stop, moves, step, complete = false) => {
  const activeMove = moves[step] || moves[moves.length - 1];
  const origin = moves[0]?.start;
  const terminus = moves[moves.length - 1]?.end;
  const isActive =
    !complete && activeMove && (stop.slug === activeMove.start || stop.slug === activeMove.end);
  const isAnchor = stop.slug === origin || stop.slug === terminus;
  const isVisited = complete || stop.steps.some((moveStep) => moveStep <= step);

  if (isActive) return { role: "active", priority: 0, required: true };
  if (isAnchor) return { role: "anchor", priority: 1, required: true };
  if (isVisited) return { role: "visited", priority: 2, required: complete };
  return { role: "future", priority: 3, required: false };
};

/** Selects the most useful narrative beat when a named map place is clicked. */
export const storyStepForStop = ({ stop, moves, step, complete = false }) => {
  const lastStep = Math.max(0, moves.length - 1);
  if (!complete && (stop.startSteps?.includes(step) || stop.endSteps?.includes(step))) return step;
  if (stop.slug === moves[lastStep]?.end) return lastStep;
  if (complete) return stop.endSteps?.[0] ?? stop.startSteps?.[0] ?? stop.firstStep ?? 0;
  const visitedSteps = (stop.steps || []).filter((moveStep) => moveStep <= step);
  if (visitedSteps.length) return Math.max(...visitedSteps);
  return stop.firstStep ?? 0;
};

/**
 * Whether a named marker must be placed. Active endpoints and the story's
 * origin/final anchors are always kept; visited markers are only forced on the
 * completed frame, so mid-playback they yield instead of cluttering the map.
 */
export const symbolRequired = (role, complete) =>
  Boolean(complete) || role === "active" || role === "anchor";

/**
 * Produces the complete semantic overlay for one frame: individual stops,
 * future clusters, collision-free labels, and their leader lines.
 */
export const buildStoryOverlay = ({
  stops,
  moves,
  step,
  complete = false,
  pixels,
  width,
  height,
  clusterRadius = 46,
  reservedRects = [],
}) => {
  const positioned = stops
    .map((stop) => {
      const pixel = pixels[stop.slug];
      if (!pixel || !pixel.every(Number.isFinite)) return null;
      return {
        ...stop,
        x: pixel[0],
        y: pixel[1],
        ...roleForStop(stop, moves, step, complete),
      };
    })
    .filter(Boolean);

  const namedStops = positioned.filter((stop) => stop.role !== "future");
  const futureGroups = complete
    ? []
    : clusterFutureStops(positioned.filter((stop) => stop.role === "future"), clusterRadius);

  const rawClusters = futureGroups.filter((group) => group.stops.length > 1);
  const futureSingles = futureGroups
    .filter((group) => group.stops.length === 1)
    .map((group) => ({ ...group.stops[0], role: "future" }));

  const placedSymbols = layoutSymbols({
    symbols: [
      ...namedStops.map((marker) => ({
        ...marker,
        id: `marker:${marker.slug}`,
        kind: "marker",
        width: marker.role === "active" ? 26 : marker.role === "anchor" ? 20 : 18,
        height: marker.role === "active" ? 26 : marker.role === "anchor" ? 20 : 18,
        required: symbolRequired(marker.role, complete),
      })),
      ...futureSingles.map((marker) => ({
        ...marker,
        id: `marker:${marker.slug}`,
        kind: "marker",
        width: 12,
        height: 12,
        required: false,
      })),
      ...rawClusters.map((cluster) => ({
        ...cluster,
        id: `cluster:${cluster.id}`,
        clusterId: cluster.id,
        kind: "cluster",
        priority: 3,
        width: 62,
        height: 34,
        required: false,
      })),
    ],
    reservedRects,
    width,
    height,
  });
  const markers = placedSymbols.filter((symbol) => symbol.kind === "marker");
  const clusters = placedSymbols
    .filter((symbol) => symbol.kind === "cluster")
    .map(({ clusterId, ...cluster }) => ({ ...cluster, id: clusterId }));
  const namedMarkers = markers.filter((marker) => marker.role !== "future");
  const obstacles = [
    ...reservedRects,
    ...markers.map((marker) =>
      rectForCenter(`marker:${marker.slug}`, marker.x, marker.y, marker.width, marker.height),
    ),
    ...clusters.map((cluster) =>
      rectForCenter(`cluster:${cluster.id}`, cluster.x, cluster.y, 62, 34),
    ),
  ];
  const labels = layoutLabels({
    items: namedMarkers,
    obstacles,
    width,
    height,
  });

  return { markers, clusters, labels };
};

/** Select the least obstructed offset for the moving avatar party. */
export const travelerPosition = ({
  x,
  y,
  dx,
  dy,
  width,
  height,
  obstacles = [],
  partyWidth = 62,
  partyHeight = 38,
}) => {
  const length = Math.hypot(dx, dy) || 1;
  const along = { x: dx / length, y: dy / length };
  const perpendicular = { x: -dy / length, y: dx / length };
  const rawCandidates = [
    { x: x + perpendicular.x * 25, y: y + perpendicular.y * 25 },
    { x: x - perpendicular.x * 25, y: y - perpendicular.y * 25 },
    { x: x - partyWidth / 2 - 18, y },
    { x: x + partyWidth / 2 + 18, y },
    { x, y: y - partyHeight / 2 - 16 },
    { x, y: y + partyHeight / 2 + 16 },
    { x: x - along.x * 34, y: y - along.y * 34 },
    { x: x + along.x * 34, y: y + along.y * 34 },
  ];
  const radialBase = Math.max(partyWidth, partyHeight) / 2 + 20;
  [radialBase, radialBase + 20, radialBase + 38].forEach((ring) => {
    [Math.PI * 1.5, Math.PI, 0, Math.PI / 2, Math.PI * 1.25, Math.PI * 1.75, Math.PI * 0.75, Math.PI / 4]
      .forEach((angle) => {
        rawCandidates.push({ x: x + Math.cos(angle) * ring, y: y + Math.sin(angle) * ring });
      });
  });
  // Fit every candidate before collision scoring. Points near a map edge are
  // common, and rejecting their useful side-offsets before clamping forced the
  // old fallback to cover a place label.
  const candidates = rawCandidates.map((candidate) => ({
    x: clamp(candidate.x, partyWidth / 2 + 6, width - partyWidth / 2 - 6),
    y: clamp(candidate.y, partyHeight / 2 + 6, height - partyHeight / 2 - 6),
  }));
  const safe = candidates.find((candidate) => {
    const rect = rectForCenter("traveler", candidate.x, candidate.y, partyWidth, partyHeight);
    return !overlapsAny(rect, obstacles);
  });
  if (safe) return safe;

  // In a maximally dense frame, choose the candidate intersecting the fewest
  // obstacles instead of reverting to a fixed offset that may hide a label.
  const best = candidates.reduce((choice, candidate) => {
    const rect = rectForCenter("traveler", candidate.x, candidate.y, partyWidth, partyHeight);
    const collisions = obstacles.filter((obstacle) => rectanglesOverlap(rect, obstacle, 3)).length;
    if (!choice || collisions < choice.collisions) return { ...candidate, collisions };
    return choice;
  }, null);
  return { x: best.x, y: best.y };
};
