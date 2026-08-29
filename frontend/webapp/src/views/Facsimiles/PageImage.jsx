import React, { useEffect, useState } from 'react';
import { isThumbWarm, markThumbWarm } from './faxThumbCache';

/**
 * PageImage
 * Shows a shimmer placeholder immediately when src changes, then
 * fades the image in once it has loaded.
 */
export default function PageImage({ src, alt, onClick, className = '', previewSrc, label, reference, style, loading, onReady }) {
  const [loaded, setLoaded] = useState(() => isThumbWarm(src));
  const [settledSrc, setSettledSrc] = useState(() => isThumbWarm(src) ? src : null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const warm = isThumbWarm(src);
    setLoaded(warm); // warm -> no shimmer; cold -> show it
    setSettledSrc(warm ? src : null);
    setError(false);             // reset when the src changes
  }, [src]);

  // Notify callers after this particular image has settled. This effect also
  // covers an already-warm image, whose load event may have happened before a
  // newly mounted consumer attached its handler.
  useEffect(() => {
    if (settledSrc === src) onReady?.(src);
  }, [settledSrc, onReady, src]);

  return (
    <div
      className={`pageImageWrapper ${loaded ? 'loaded' : 'loading'} ${error ? 'errored' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {!loaded && !error && previewSrc && (
        <img className="preview-blur" src={previewSrc} alt="" aria-hidden="true" style={style} />
      )}
      {!loaded && !error && <div className="skeleton-shimmer" aria-hidden="true" />}
      {!loaded && !error && (reference || label) && (
        <div className="loading-label">
          {reference && <div className="ref">{reference}</div>}
          {label && <div className="pageLabel">{label}</div>}
        </div>
      )}
      {/* Hedge against a page that has no scan (e.g. a page number past the
          last scanned leaf): show a neutral "not available" card instead of a
          broken-image glyph. */}
      {error && (
        <div className="pageImageUnavailable" aria-hidden="true">
          {reference && <div className="ref">{reference}</div>}
          <div className="pageLabel">{label || 'Page'}</div>
          <div className="unavailNote">not available</div>
        </div>
      )}
      <img
        className="main-image"
        src={src}
        alt={alt}
        onLoad={() => { markThumbWarm(src); setSettledSrc(src); setLoaded(true); }}
        onError={() => { setError(true); setSettledSrc(src); setLoaded(true); }}
        style={{ ...style, display: error ? 'none' : undefined }}
        loading={loading}
      />
    </div>
  );
}
