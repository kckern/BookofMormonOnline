import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { assetUrl } from 'src/models/BoMOnlineAPI';
import { label } from 'src/models/Utils';
import { generateReference, lookupReference } from 'scripture-guide';

/**
 * FaxBreadcrumbs — `Facsimiles › [Edition ▾]` header with an edition-switcher
 * combo box, adopted from the Witnesses breadcrumb pattern (History/Witnesses.js).
 *
 * Switching editions carries the current scripture reference into the target so
 * the reader stays on the same passage — the same mechanism as the Up/Down
 * volume-switch keys (FacsimilePageViewer.js). Non-indexed editions fall back to
 * their root (page 1 / grid).
 *
 * Props:
 *  - editions: renderable edition objects ({ slug, title, pages })
 *  - current: the active edition object
 *  - currentRef: the current spread's scripture reference (null in grid mode)
 */
export default function FaxBreadcrumbs({ editions = [], current, currentRef }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    // Capture phase + stopPropagation so Escape closes only the dropdown and
    // doesn't bubble to the viewer's Escape handler (which exits to the grid).
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  // Build the target path for an edition, carrying the current reference.
  const targetFor = (ed) => {
    if (currentRef) {
      try {
        const verseIds = lookupReference(currentRef)?.verse_ids || [];
        if (verseIds.length) {
          const minId = Math.min(...verseIds);
          const slugRef = generateReference([minId]).replace(/[ :]+/g, '.').toLowerCase();
          return `/fax/${ed.slug}/${slugRef}`;
        }
      } catch { /* fall through to the edition root */ }
    }
    return `/fax/${ed.slug}`;
  };

  return (
    <nav className={`fax-breadcrumbs${open ? ' open' : ''}`} aria-label="Breadcrumb" ref={wrapperRef}>
      <Link to="/fax" className="breadcrumb-link">{label('menu_fax') || 'Facsimiles'}</Link>
      <span className="breadcrumb-sep" aria-hidden="true">›</span>
      <button
        type="button"
        className={`breadcrumb-current${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {current?.title}
        <span className="breadcrumb-chevron" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="breadcrumb-dropdown" role="listbox">
          {editions.map((ed) => {
            const isCurrent = ed.slug === current?.slug;
            const inner = (
              <>
                <img
                  className="breadcrumb-avatar"
                  src={`${assetUrl}/fax/covers/${ed.slug}`}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  onError={(e) => { e.target.style.visibility = 'hidden'; }}
                />
                <span className="breadcrumb-option-name">{ed.title}</span>
              </>
            );
            return isCurrent ? (
              <div key={ed.slug} className="breadcrumb-option current" role="option" aria-selected="true" aria-current="page">
                {inner}
              </div>
            ) : (
              <Link
                key={ed.slug}
                to={targetFor(ed)}
                className="breadcrumb-option"
                role="option"
                aria-selected="false"
                onClick={() => setOpen(false)}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
