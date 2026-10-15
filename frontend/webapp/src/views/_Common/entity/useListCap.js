import React, { useState } from "react";
import "./entityLists.css";

/** How many rows a long entity list shows before "Show all N". */
export const LIST_CAP = 12;

/**
 * Cap a long list. Returns the rows to render, and a "Show all N" button (null
 * when the list already fits, or once it has been expanded). Hub entities run
 * to 100+ relationship cards and references, each with its own image request,
 * so the full list only renders when the reader asks for it.
 */
export default function useListCap(items, cap = LIST_CAP) {
  const [expanded, setExpanded] = useState(false);
  const list = Array.isArray(items) ? items : [];
  if (expanded || list.length <= cap) return [list, null];
  const button = (
    <button type="button" className="entity-show-all" onClick={() => setExpanded(true)}>
      Show all {list.length}
    </button>
  );
  return [list.slice(0, cap), button];
}
