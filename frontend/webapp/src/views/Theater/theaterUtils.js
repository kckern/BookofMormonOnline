// Pure helpers for the Theater view. Theater.js itself cannot be imported
// under jsdom (audio APIs), so testable logic lives here.

const NOTE_SOURCES = [192, 193];
const EXCLUDED_SOURCES = [41, 161, 162, 163, 164, 165, 166];
const SECONDS_BETWEEN_COMMENTS = 5;

// Filter an item's commentary to displayable comments, capped to the clip
// duration, in a random order. Shuffle is injected for testability.
export function buildCommentQueue(coms, blacklist, durationSeconds, random = Math.random) {
  const filtered = (coms || [])
    .filter(c => {
      const sourceId = parseInt(c.id.toString().substr(5, 3));
      if (!c.preview?.trim()) return false;
      if (NOTE_SOURCES.includes(sourceId)) return true;
      if ([...(blacklist || []), ...EXCLUDED_SOURCES].includes(sourceId)) return false;
      return true;
    })
    .sort((a, b) => a.preview.length - b.preview.length);
  const allowedMessageCount = durationSeconds / SECONDS_BETWEEN_COMMENTS;
  return filtered.slice(0, allowedMessageCount).sort(() => random() - 0.5);
}
