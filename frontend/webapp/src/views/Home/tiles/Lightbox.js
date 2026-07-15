import React, { useEffect } from "react";

/** Minimal image lightbox: overlay, click-anywhere or Esc to close. */
export default function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="samplerLightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <img src={src} alt={alt || ""} />
      <button className="samplerLightboxClose" aria-label="Close" onClick={onClose}>×</button>
    </div>
  );
}
