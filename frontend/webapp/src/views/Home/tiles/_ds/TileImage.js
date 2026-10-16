import React, { useState } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { VARIANT_WIDTHS, hasVariants, isAbsoluteSrc, variantUrl, variantsEnabled } from "./mediaVariants";

/**
 * The one image element for Home tiles. `path` is relative to assetUrl
 * ("people/nephi1"). Lazy + async-decoded unless `eager` (first row: eager and
 * fetchpriority=high). With variants enabled, a WebP srcset is offered and the
 * original stays as `src`; if a variant fails, the srcset is dropped and the
 * browser falls back to the original. `aspect` reserves the box (no CLS).
 * Decorative images pass alt="" explicitly. A path with no variant family
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
  widths = VARIANT_WIDTHS,
  sizes,
  eager = false,
  className = "",
  aspect,
  onError,
  onLoad,
  remember = false,
  style,
  ...rest
}) {
  const [variantFailed, setVariantFailed] = useState(false);
  if (!path) return null;
  const absolute = isAbsoluteSrc(path);
  const useVariants = !variantFailed && !absolute && widths.length > 0 && hasVariants(path) && variantsEnabled();
  const srcSet = useVariants ? widths.map((w) => `${variantUrl(path, w)} ${w}w`).join(", ") : undefined;
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
    onLoad?.(e);
  };
  const boxStyle = aspect ? { aspectRatio: aspect, ...style } : style;
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
