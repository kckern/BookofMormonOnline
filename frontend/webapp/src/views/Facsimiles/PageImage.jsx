import React, { useEffect, useState } from 'react';
import { isThumbWarm, markThumbWarm } from './faxThumbCache';

/**
 * PageImage
 * Shows a shimmer placeholder immediately when src changes, then
 * fades the image in once it has loaded.
 */
export default function PageImage({ src, alt, onClick, className = '', previewSrc, label, reference, style, loading }) {
  const [loaded, setLoaded] = useState(() => isThumbWarm(src));

  useEffect(() => {
    setLoaded(isThumbWarm(src)); // warm -> no shimmer; cold -> show it
  }, [src]);

  return (
    <div 
      className={`pageImageWrapper ${loaded ? 'loaded' : 'loading'} ${className}`} 
      onClick={onClick}
      style={style}
    >
      {!loaded && previewSrc && (
        <img className="preview-blur" src={previewSrc} alt="" aria-hidden="true" style={style} />
      )}
      {!loaded && <div className="skeleton-shimmer" aria-hidden="true" />}
      {!loaded && (reference || label) && (
        <div className="loading-label">
          {reference && <div className="ref">{reference}</div>}
          {label && <div className="pageLabel">{label}</div>}
        </div>
      )}
      <img
        className="main-image"
        src={src}
        alt={alt}
        onLoad={() => { markThumbWarm(src); setLoaded(true); }}
        onError={() => setLoaded(true)}
        style={style}
        loading={loading}
      />
    </div>
  );
}
