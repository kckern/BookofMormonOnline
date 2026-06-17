import React from "react";

/**
 * Render `text` with the [range.start,range.end) slice wrapped in <em class="semantic-hl">.
 * When `range` is absent, use keywordRender(text) if provided, else plain text.
 */
export function renderHighlighted(text, range, keyword, keywordRender) {
  if (range && Number.isInteger(range.start) && Number.isInteger(range.end) && range.end > range.start) {
    return <>{text.slice(0, range.start)}<em className="semantic-hl">{text.slice(range.start, range.end)}</em>{text.slice(range.end)}</>;
  }
  if (keywordRender && keyword) return keywordRender(text);
  return <>{text}</>;
}
