import React from "react";
import { canons } from "./canon";
import { bookTotal } from "./aggregate";
import ChapterStrip from "./ChapterStrip";

// The anchor canon as a vertical book list with density bars; the anchored
// book expands to show its per-chapter strip.
export default function Rail({ canon, book, chapter, onAnchor, onChapter }) {
  const { groups, books } = canons[canon];
  const max = Math.max(...books.map((b) => bookTotal(canon, b.name)), 1);

  return (
    <nav className="xref-rail" aria-label={canons[canon].label}>
      {groups.map((group) => (
        <div key={group.name} className="xref-rail-group">
          <div className="xref-rail-groupname">{group.name}</div>
          {group.books.map((b) => {
            const total = bookTotal(canon, b.name);
            const isAnchor = b.name === book;
            return (
              <div key={b.name} className="xref-rail-item">
                <button
                  className={`xref-rail-book ${isAnchor ? "anchored" : ""}`}
                  aria-current={isAnchor ? "true" : undefined}
                  aria-label={`${b.name}, ${total} references`}
                  onClick={() => onAnchor(b.name)}
                >
                  <span className="xref-rail-bookname">{b.name}</span>
                  <span className="xref-rail-density" aria-hidden="true">
                    <span
                      className="xref-rail-densityfill"
                      style={{ width: `${(total / max) * 100}%` }}
                    />
                  </span>
                </button>
                {isAnchor && (
                  <ChapterStrip canon={canon} book={b} chapter={chapter} onChapter={onChapter} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
