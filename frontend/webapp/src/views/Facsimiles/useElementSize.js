import { useEffect, useState } from "react";

/**
 * Observe an element's border-box size + viewport-top, rAF-batched, with a
 * small px threshold to avoid churn. Replaces the 130-line hand-rolled effect
 * whose [] deps closed over stale `containerSize` (audit §2.13).
 */
export function useElementSize(ref, { threshold = 4 } = {}) {
  const [size, setSize] = useState({
    width: 0,
    height: 0,
    top: 0,
    viewportH: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let raf = null;
    const read = () => {
      raf = null;
      const rect = el.getBoundingClientRect();
      setSize((prev) => {
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        const top = Math.floor(rect.top);
        const viewportH = window.innerHeight;
        if (
          Math.abs(width - prev.width) < threshold &&
          Math.abs(height - prev.height) < threshold &&
          Math.abs(top - prev.top) < threshold &&
          viewportH === prev.viewportH
        ) {
          return prev; // no meaningful change -> no re-render
        }
        return { width, height, top, viewportH };
      });
    };
    const schedule = () => { if (raf == null) raf = requestAnimationFrame(read); };
    read();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    window.addEventListener("resize", schedule);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [ref, threshold]);

  return size;
}
