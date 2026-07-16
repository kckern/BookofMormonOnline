import React, { useEffect, useRef, useState } from "react";
import { label } from "src/models/Utils";

/**
 * Width-aware clamp: collapsed state is a CSS line-clamp (so the cut point
 * tracks the ACTUAL rendered width, not a word budget), with an inline
 * "read more" that expands in place. Truncation is detected by measuring
 * overflow. Safe inside card <Link>s.
 */
export default function ExpandableText({ children, lines = 6, className }) {
  const [open, setOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) setTruncated(el.scrollHeight > el.clientHeight + 2);
  }, [children, lines]);
  const expand = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };
  return (
    <div className={className}>
      <div
        ref={ref}
        className={open ? undefined : "clampLines"}
        style={open ? undefined : { WebkitLineClamp: lines }}
      >
        {children}
      </div>
      {truncated && !open ? (
        <button className="readMoreBtn" onClick={expand}>
          {label("read_more")}
        </button>
      ) : null}
    </div>
  );
}
