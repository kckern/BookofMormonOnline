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
