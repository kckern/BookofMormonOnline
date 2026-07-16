import React from "react";
import { chapterCounts } from "./aggregate";

// Per-chapter density strip for the anchored book. Counts live in the
// aria-label and title, never inside the 12px cells.
export default function ChapterStrip({ canon, book, chapter, onChapter }) {
  const counts = chapterCounts(canon, book.name);
  const max = Math.max(...counts, 1);

  const handleKey = (e) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const cells = [...e.currentTarget.querySelectorAll('[role="radio"]')];
    const i = cells.indexOf(document.activeElement);
    cells[Math.min(Math.max(i + dir, 0), cells.length - 1)]?.focus();
  };

  return (
    <div
      className="xref-chapterstrip"
      role="radiogroup"
      aria-label={`${book.name} chapters`}
      onKeyDown={handleKey}
    >
      {counts.map((count, i) => {
        const ch = i + 1;
        const selected = chapter === ch;
        const step = count ? Math.ceil((count / max) * 6) : 0;
        return (
          <button
            key={ch}
            role="radio"
            aria-checked={selected}
            aria-label={`Chapter ${ch}, ${count} references`}
            title={`${book.name} ${ch} — ${count} references`}
            className={`xref-chaptercell ramp-${step} ${selected ? "selected" : ""}`}
            onClick={() => onChapter(selected ? undefined : ch)}
          >
            <span className="xref-chapternum">{ch}</span>
          </button>
        );
      })}
    </div>
  );
}
