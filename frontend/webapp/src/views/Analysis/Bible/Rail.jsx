import React, { useLayoutEffect, useRef } from "react";
import { canons } from "./canon";
import { bookTotal } from "./aggregate";
import ChapterStrip from "./ChapterStrip";

// The anchor canon as an accordion: only the group containing the anchored
// book is expanded (showing its books + the anchored book's ChapterStrip);
// every other group collapses to a single clickable header that re-anchors
// to that group's first book on click.
export default function Rail({ canon, book, chapter, partner, onAnchor, onChapter }) {
  const { groups, books } = canons[canon];
  const max = Math.max(...books.map((b) => bookTotal(canon, b.name)), 1);

  const railRef = useRef(null);
  const anchorRef = useRef(null);
  useLayoutEffect(() => {
    const rail = railRef.current;
    const el = anchorRef.current;
    if (!rail || !el) return;
    rail.scrollTop = Math.max(
      0,
      el.offsetTop - rail.clientHeight / 2 + el.clientHeight / 2
    );
  }, [book]);

  // Which group holds the anchored book — that group stays open; the rest
  // collapse to a header that re-anchors to the group's first book on click.
  const openGroup = groups.find((g) => g.books.some((b) => b.name === book))?.name;

  return (
    <nav ref={railRef} className="xref-rail" aria-label={canons[canon].label}>
      {groups.map((group) => {
        const isOpen = group.name === openGroup;
        if (!isOpen) {
          const groupTotal = group.books.reduce((a, b) => a + bookTotal(canon, b.name), 0);
          return (
            <button
              key={group.name}
              className="xref-rail-groupbtn"
              aria-label={`${group.name}, ${groupTotal} references, open`}
              onClick={() => onAnchor(group.books[0].name)}
            >
              <span className="xref-rail-groupname">{group.name}</span>
              <span className="xref-rail-groupcount" aria-hidden="true">{groupTotal}</span>
            </button>
          );
        }
        return (
          <div key={group.name} className="xref-rail-group">
            <div className="xref-rail-groupname open">{group.name}</div>
            {group.books.map((b) => {
              const total = bookTotal(canon, b.name);
              const isAnchor = b.name === book;
              return (
                <div key={b.name} className="xref-rail-item">
                  <button
                    ref={isAnchor ? anchorRef : undefined}
                    className={`xref-rail-book ${isAnchor ? "anchored" : ""}`}
                    aria-current={isAnchor ? "true" : undefined}
                    aria-label={`${b.name}, ${total} references`}
                    onClick={() => onAnchor(b.name)}
                  >
                    <span className="xref-rail-bookname">{b.name}</span>
                    <span className="xref-rail-density" aria-hidden="true">
                      <span
                        className="xref-rail-densityfill"
                        style={{ width: `${Math.sqrt(total / max) * 100}%` }}
                      />
                    </span>
                  </button>
                  {isAnchor && (
                    <ChapterStrip canon={canon} book={b} chapter={chapter} partner={partner} onChapter={onChapter} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
