// Active-section watcher: which section occupies the top band of the
// viewport. IntersectionObserver — zero per-scroll-event layout reads
// (replaces the old window.onscroll offsetTop loop).
export function createScrollSpy({ getSections, topBandRatio = 0.2, onActive }) {
  let observer = null;
  return {
    start() {
      if (observer || typeof IntersectionObserver === "undefined") return;
      observer = new IntersectionObserver(
        (entries) => {
          const inBand = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (inBand.length) onActive(inBand[0].target);
        },
        {
          root: null,
          // Shrink the observation area to the top topBandRatio of the viewport.
          rootMargin: `0px 0px -${Math.round((1 - topBandRatio) * 100)}% 0px`,
          threshold: 0,
        }
      );
      Array.from(getSections() || []).forEach((s) => observer.observe(s));
    },
    stop() {
      if (observer) observer.disconnect();
      observer = null;
    },
  };
}
