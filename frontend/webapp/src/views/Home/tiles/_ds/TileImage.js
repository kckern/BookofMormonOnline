import React, { useState } from "react";
import { MAX_PORTRAIT, PORTRAIT_FOCUS, isCapped, parseAspect } from "./mediaAspect";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { hasVariants, isAbsoluteSrc, variantUrl, variantWidthsFor, variantsEnabled } from "./mediaVariants";

/**
 * The one image element for Home tiles. `path` is relative to assetUrl
 * ("people/nephi1"). Lazy + async-decoded unless `eager` (first row: eager and
 * fetchpriority=high). With variants enabled, a WebP srcset is offered and the
 * original stays as `src`; if a variant fails, the srcset is dropped and the
 * browser falls back to the original. `aspect` reserves the box (no CLS).
 * Decorative images pass alt="" explicitly. Every image is portrait-capped at
 * 3:4 (mediaAspect) unless `uncapped` (the caller bounds the height itself). A path with no variant family
 * (archive media) or an absolute URL (render-host crops) gets no srcset.
 */
// Natural sizes (CSS px) of images that loaded this page session, by path. A
// tile remounted on Back can reserve the exact box before its image arrives
// (blind audit fax-B1 / XC2: fax pages and verse crops came back ~370px tall
// and grew under the scroll anchor). Module-scoped: lives as long as the SPA.
const naturalSizes = new Map();
/** { w, h } for a path that already loaded (TileImage `remember`), else null. */
export const knownSize = (path) => naturalSizes.get(path) || null;

export default function TileImage({
  path,
  alt = "",
  widths,
  sizes,
  eager = false,
  className = "",
  aspect,
  onError,
  onLoad,
  remember = false,
  uncapped = false,
  style,
  ...rest
}) {
  const [variantFailed, setVariantFailed] = useState(false);
  // rendered width/height of an unreserved image that loaded taller than the cap
  const [natural, setNatural] = useState(null);
  if (!path) return null;
  const absolute = isAbsoluteSrc(path);
  const ws = widths ?? variantWidthsFor(path); // [] = this call site opts out of variants
  const useVariants = !variantFailed && !absolute && ws.length > 0 && hasVariants(path) && variantsEnabled();
  const srcSet = useVariants ? ws.map((w) => `${variantUrl(path, w)} ${w}w`).join(", ") : undefined;
  const handleError = (e) => {
    if (useVariants) {
      setVariantFailed(true);
      return;
    }
    onError?.(e);
  };
  const handleLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.target;
    if (remember && w && h) naturalSizes.set(path, { w, h });
    // Unreserved box: cap only when it actually RENDERS taller than the cap (a
    // CSS-sized box — face cards, fixed thumbs — already bounds itself).
    if (w && h && !aspect) {
      const r = e.target.getBoundingClientRect?.();
      const shown = r && r.width > 0 && r.height > 0 ? r.width / r.height : w / h;
      if (isCapped(shown)) setNatural(shown);
    }
    onLoad?.(e);
  };
  // Portrait cap (tiles/_ds/mediaAspect): a box taller than 3:4 is cropped to
  // 3:4, cover, upper focal point — no image can make a multi-viewport tile.
  // `uncapped` only where the caller bounds the height itself (fax rows).
  const ratio = parseAspect(aspect) ?? natural;
  const capped = !uncapped && isCapped(ratio);
  const capStyle = capped ? { aspectRatio: String(MAX_PORTRAIT), objectFit: "cover", objectPosition: PORTRAIT_FOCUS } : null;
  const boxStyle = capped ? { ...style, ...capStyle } : aspect ? { aspectRatio: aspect, ...style } : style;
  return (
    <img
      className={`tileImage ${className}`.trim()}
      src={absolute ? path : `${assetUrl}/${path}`}
      srcSet={srcSet}
      sizes={useVariants ? sizes : undefined}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : undefined}
      style={boxStyle}
      onError={handleError}
      onLoad={handleLoad}
      {...rest}
    />
  );
}
