import React from 'react';
import { Link } from 'react-router-dom';
import { assetUrl } from 'src/models/BoMOnlineAPI';
import { label } from 'src/models/Utils';
import { generateReference, lookupReference } from 'scripture-guide';
import Breadcrumb from 'src/views/_Common/Breadcrumb/Breadcrumb';

/**
 * FaxBreadcrumbs — `Facsimiles › [Edition ▾]` header with an edition-switcher.
 * Built on the shared <Breadcrumb> component; the edition list is slotted into
 * Breadcrumb.Dropdown (mobileDrawer), which owns open/close/Escape/outside-click
 * and the desktop-panel-vs-mobile-Drawer switch.
 *
 * Switching editions carries the current scripture reference into the target so
 * the reader stays on the same passage. Non-indexed editions fall back to root.
 *
 * Props:
 *  - editions: renderable edition objects ({ slug, title, pages })
 *  - current: the active edition object
 *  - currentRef: the current spread's scripture reference (null in grid mode)
 */
export default function FaxBreadcrumbs({ editions = [], current, currentRef }) {
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

  const EditionList = ({ onPick }) => editions.map((ed) => {
    const isCurrent = ed.slug === current?.slug;
    const indexed = !!ed.indexRef;
    const inner = (
      <>
        <span className="fax-edition-thumb">
          <img
            className="fax-edition-avatar"
            src={`${assetUrl}/fax/covers/${ed.slug}`}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={(e) => { e.target.style.visibility = 'hidden'; }}
          />
          {indexed && (
            <span className="fax-edition-index-flag has-index" title="Verse-level facsimile index" aria-label="Verse-indexed">¶</span>
          )}
        </span>
        <span className="fax-edition-name">{ed.title}</span>
      </>
    );
    return isCurrent ? (
      <div key={ed.slug} className="fax-edition-option current" role="option" aria-selected="true" aria-current="page">
        {inner}
      </div>
    ) : (
      <Link
        key={ed.slug}
        to={{ pathname: targetFor(ed), state: { faxPageOnly: true } }}
        className="fax-edition-option"
        role="option"
        aria-selected="false"
        onClick={onPick}
      >
        {inner}
      </Link>
    );
  });

  return (
    <Breadcrumb className="fax-breadcrumbs">
      <Breadcrumb.Link to="/fax">{label('menu_fax') || 'Facsimiles'}</Breadcrumb.Link>
      <Breadcrumb.Dropdown
        label={current?.title}
        mobileDrawer
        drawerProps={{ className: 'faxEditionDrawer' }}
      >
        {({ close }) => (
          <div className="fax-edition-list" role="listbox">
            <div className="faxEditionDrawer-head">{label('menu_fax') || 'Facsimiles'}</div>
            <EditionList onPick={close} />
          </div>
        )}
      </Breadcrumb.Dropdown>
    </Breadcrumb>
  );
}
