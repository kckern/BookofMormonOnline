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
export default function TileImage({
  path,
  alt = "",
  widths = VARIANT_WIDTHS,
  sizes,
  eager = false,
  className = "",
  aspect,
  onError,
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
      style={aspect ? { aspectRatio: aspect } : undefined}
      onError={handleError}
      {...rest}
    />
  );
}
