import React, { useEffect, useState } from 'react';

/**
 * PageImage
 * Shows a shimmer placeholder immediately when src changes, then
 * fades the image in once it has loaded.
 */
export default function PageImage({ src, alt, onClick, className = '', previewSrc, label, reference }) {
  const [loaded, setLoaded] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  useEffect(() => {
    // Reset loading state whenever the source changes
    setLoaded(false);
    // Immediately show placeholder on first load and on src changes
    setShowPlaceholder(true);
  }, [src]);

  return (
    <div className={`pageImageWrapper ${loaded ? 'loaded' : 'loading'} ${className}`} onClick={onClick}>
      {!loaded && showPlaceholder && previewSrc && (
        <img className="preview-blur" src={previewSrc} alt="" aria-hidden="true" />
      )}
      {!loaded && showPlaceholder && <div className="skeleton-shimmer" aria-hidden="true" />}
      {!loaded && showPlaceholder && (reference || label) && (
        <div className="loading-label">
          {reference && <div className="ref">{reference}</div>}
          {label && <div className="pageLabel">{label}</div>}
        </div>
      )}
      <img
        className="main-image"
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </div>
  );
}
