import React, { useState } from "react";
import { label } from "src/models/Utils";

/**
 * Clamped text with an inline "read more" that expands in place. Safe inside
 * card <Link>s. `full`/`clamped` may be strings or rendered nodes.
 */
export default function ExpandableText({ full, clamped, truncated, className }) {
  const [open, setOpen] = useState(false);
  const expand = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };
  return (
    <div className={className}>
      {open || !truncated ? full : clamped}
      {truncated && !open ? (
        <button className="readMoreBtn" onClick={expand}>
          {label("read_more")}
        </button>
      ) : null}
    </div>
  );
}
