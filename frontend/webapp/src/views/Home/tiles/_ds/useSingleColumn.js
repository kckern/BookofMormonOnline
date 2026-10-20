import { useEffect, useState } from "react";

/**
 * useSingleColumn — true below the sampler's single-column breakpoint (the
 * app's 900px, same query Sampler.js uses), so a self-fetching tile's in-tile
 * skeleton can reserve skeletonHeight(span, single) like Sampler's own does.
 */
export const SINGLE_COLUMN_QUERY = "(max-width: 900px)";

const mql = () =>
  typeof window !== "undefined" && window.matchMedia ? window.matchMedia(SINGLE_COLUMN_QUERY) : null;

export default function useSingleColumn() {
  const [single, setSingle] = useState(() => !!mql()?.matches);
  useEffect(() => {
    const m = mql();
    if (!m) return undefined;
    const on = () => setSingle(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return single;
}

/** Single column on a tablet-width screen (skeletonHeights TABLET tier). */
export const WIDE_SINGLE_QUERY = "(min-width: 601px) and (max-width: 900px)";
const wideMql = () =>
  typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE_SINGLE_QUERY) : null;
export function useWideSingle() {
  const [wide, setWide] = useState(() => !!wideMql()?.matches);
  useEffect(() => {
    const m = wideMql();
    if (!m) return undefined;
    const on = () => setWide(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return wide;
}
