// Derives the narration sidebar list from the theater queue.
// Queue items without a narration must not leak null placeholders into
// uniqueNarrations — the component runs string.replace over each entry.
export const deriveNarrationList = (queue) => {
  const allNarrations = (queue || []).map(
    (item) => item?.narration?.description || null
  );
  const uniqueNarrations = [...new Set(allNarrations)].filter(
    (n) => n !== null
  );
  const narrationMap = {};
  allNarrations.forEach((_, i) => {
    narrationMap[i] = uniqueNarrations.indexOf(allNarrations[i]);
  });
  return { allNarrations, uniqueNarrations, narrationMap };
};
