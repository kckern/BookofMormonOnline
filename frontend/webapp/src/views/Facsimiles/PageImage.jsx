import React, { useEffect, useState } from 'react';

/**
 * PageImage
 * Shows a shimmer placeholder immediately when src changes, then
 * fades the image in once it has loaded.
 */
export default function PageImage({ src, alt, onClick, className = '', previewSrc, label }) {
  const [loaded, setLoaded] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(false);

  useEffect(() => {
    // Reset loading state whenever the source changes
    setLoaded(false);
    setShowPlaceholder(false);
    // Show placeholder after 200ms to avoid flicker for cached images
    const t = setTimeout(() => setShowPlaceholder(true), 200);
    return () => clearTimeout(t);
  }, [src]);

  return (
    <div className={`pageImageWrapper ${loaded ? 'loaded' : 'loading'} ${className}`} onClick={onClick}>
      {!loaded && showPlaceholder && previewSrc && (
        <img className="preview-blur" src={previewSrc} alt="" aria-hidden="true" />
      )}
      {!loaded && showPlaceholder && <div className="skeleton-shimmer" aria-hidden="true" />}
      {!loaded && showPlaceholder && !!label && <div className="loading-label">{label}</div>}
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
