export const STORY_RUN_COLORS = [
  '#3b82f6',
  '#f97316',
  '#10b981',
  '#ec4899',
  '#8b5cf6',
  '#eab308',
  '#06b6d4',
  '#ef4444',
];

// Group consecutive moves into contiguous runs (where move[i].endPlace.slug
// matches move[i+1].startPlace.slug). Each run gets a runIdx; the move's
// color is STORY_RUN_COLORS[runIdx % STORY_RUN_COLORS.length].
export function computeRuns(moves) {
  const result = [];
  let prevEnd = null;
  let runIdx = -1;
  for (const m of moves) {
    if (!(prevEnd && m.startPlace.slug === prevEnd)) {
      runIdx += 1;
    }
    result.push({ move: m, runIdx });
    prevEnd = m.endPlace.slug;
  }
  return result;
}

export function colorForRun(runIdx) {
  return STORY_RUN_COLORS[runIdx % STORY_RUN_COLORS.length];
}

// Build the panel's alternating post/fence item list from a story's moves.
// Output shape:
//   [
//     { kind: 'post',  key, place, runColor, connectsBelow },
//     { kind: 'fence', key, move,  runColor, connectsBelow },
//     { kind: 'post',  key, place, runColor, connectsBelow },
//     ...
//   ]
// Rules:
//   - First post is moves[0].startPlace; last post is moves[N-1].endPlace.
//   - Between moves[i] and moves[i+1]: if endPlace.slug === next startPlace.slug,
//     emit ONE shared post; otherwise emit two posts back-to-back.
//   - connectsBelow=true ONLY when the next item is a fence (i.e., a continuous run
//     line should bridge across this item).
//   - Posts at the boundary of a discontinuity carry their OWN run's color.
export function buildPanelItems(moves) {
  if (!Array.isArray(moves) || moves.length === 0) return [];
  const runs = computeRuns(moves);
  const items = [];

  // First post (origin of move 0)
  items.push({
    kind: 'post',
    key: `p-start-${moves[0].startPlace.slug}-0`,
    place: moves[0].startPlace,
    runColor: colorForRun(runs[0].runIdx),
    connectsBelow: true, // followed by fence 0
  });

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const runIdx = runs[i].runIdx;
    const runColor = colorForRun(runIdx);

    items.push({
      kind: 'fence',
      key: `f-${m.seq}`,
      move: m,
      runColor,
      connectsBelow: true, // followed by the post for endPlace
    });

    const next = moves[i + 1];
    if (next && m.endPlace.slug === next.startPlace.slug) {
      // Shared post between moves[i] and moves[i+1]
      items.push({
        kind: 'post',
        key: `p-shared-${m.endPlace.slug}-${i}`,
        place: m.endPlace,
        runColor,
        connectsBelow: true, // followed by fence i+1
      });
    } else if (next) {
      // Discontinuity: emit two posts (end of this run, start of next run)
      items.push({
        kind: 'post',
        key: `p-end-${m.endPlace.slug}-${i}`,
        place: m.endPlace,
        runColor,
        connectsBelow: false, // followed by a post — no connector
      });
      items.push({
        kind: 'post',
        key: `p-start-${next.startPlace.slug}-${i + 1}`,
        place: next.startPlace,
        runColor: colorForRun(runs[i + 1].runIdx),
        connectsBelow: true, // followed by fence i+1
      });
    } else {
      // Last fence: emit terminus post (endPlace of the final move)
      items.push({
        kind: 'post',
        key: `p-terminus-${m.endPlace.slug}-${i}`,
        place: m.endPlace,
        runColor,
        connectsBelow: false, // last item
      });
    }
  }

  return items;
}
