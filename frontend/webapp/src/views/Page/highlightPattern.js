// Highlight strings come from two sources: setHighlights builds intentional
// regex patterns from image/commentary titles (e.g. containing [^a-z]|<[^>]*>),
// but comment highlights and user selections are raw text. Raw text containing
// metacharacters like ( or [ must be escaped so it matches literally.
//
// Intentional patterns from setHighlights always contain ([^a-z]|<[^>]*>)+?
// for HTML-aware word-boundary matching. Raw user text never contains [^.
// We use this as the distinguishing marker.

export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isIntentionalPattern(str) {
  return /\[\^/.test(str);
}

export function compileHighlightRegex(string) {
  if (isIntentionalPattern(string)) {
    // Intentional regex pattern built by setHighlights — compile as-is to
    // preserve HTML-aware word-boundary matching. Returns null only if the
    // pattern is somehow invalid (should never happen in practice).
    try {
      return new RegExp("(" + string + ")", "gi");
    } catch (e) {
      return null;
    }
  }
  // Raw user text (comment highlights, selection strings) — always escape so
  // parentheses, brackets, and other metacharacters match literally.
  // Returns null only if the escaped form somehow fails (virtually impossible).
  try {
    return new RegExp("(" + escapeRegex(string) + ")", "gi");
  } catch (e) {
    return null;
  }
}
