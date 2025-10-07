import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from 'react-dom';
import { assetUrl } from 'src/models/BoMOnlineAPI';

/**
 * PageStack - vertical page index next to the spread
 * - Renders alternating 1px stripes (pages). If there are more pages than pixels,
 *   it samples by skipping pages while maintaining alternating color.
 * - Tooltip follows pointer (x by side of stack, y by pointer position) and shows a thumbnail.
 *
 * Props:
 * - side: 'left' | 'right'
 * - leafIndex: array of page leaf objects
 * - adjustedPageIndex: number (index of the left page in current spread)
 * - totalPages: number (total leaf count)
 * - onPageChange: (index: number) => void (expects left page index of a spread)
 */
export default function PageStack({ side, leafIndex, adjustedPageIndex, totalPages, onPageChange, width }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hover, setHover] = useState({ visible: false, x: 0, y: 0, pageIdx: null });

  // Compute the page range represented by this stack
  const [startIdx, endIdx] = useMemo(() => {
    if (side === 'left') {
      return [0, Math.max(0, adjustedPageIndex - 1)];
    }
    return [Math.min(totalPages, adjustedPageIndex + 2), totalPages - 1];
  }, [side, adjustedPageIndex, totalPages]);

  const count = Math.max(0, endIdx - startIdx + 1);

  // Desired width is 1px per page up to 200px
  const targetWidth = useMemo(() => Math.min(200, count), [count]);

  // Measure container width for compression sampling
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const setW = () => setContainerWidth(Math.floor(el.getBoundingClientRect().width));
    setW();
    const ro = new ResizeObserver(setW);
    ro.observe(el);
    window.addEventListener('resize', setW);
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('resize', setW);
    };
  }, []);

  // Skip factor no longer needed for visual stripes (we render 1px per column up to 200px)

  // Map X offset within container to a page index in this stack
  const positionToPageIdx = useCallback((x) => {
    const width = containerWidth || targetWidth;
    if (width <= 0 || count <= 0) return null;
    const r = Math.max(0, Math.min(1, x / width));
    // Map left-to-right within the stack to increasing page numbers regardless of stack side
    const ratio = r;
    const relative = Math.max(0, Math.min(count - 1, Math.floor(ratio * count)));
    return startIdx + relative;
  }, [containerWidth, targetWidth, count, startIdx]);

  const onMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = positionToPageIdx(x);
    const clampedX = Math.max(0, Math.min(rect.width, x));
    setHover({ visible: true, x: clampedX, y: Math.max(0, Math.min(rect.height, y)), pageIdx: idx });
  }, [positionToPageIdx]);

  const onLeave = useCallback(() => setHover((h) => ({ ...h, visible: false })), []);

  const onClick = useCallback(() => {
    if (hover.pageIdx == null) return;
    const targetLeft = hover.pageIdx % 2 === 0 ? hover.pageIdx : hover.pageIdx - 1;
    const clamped = Math.max(0, Math.min(totalPages - 1, targetLeft));
    onPageChange(clamped);
  }, [hover.pageIdx, onPageChange, totalPages]);

  const page = hover.pageIdx != null ? leafIndex[hover.pageIdx] : null;

  // Tooltip position relative to stack side; show above the bar, X at hovered column
  const tooltipViewportStyle = useMemo(() => {
    if (!containerRef.current) return { display: 'none' };
    const rect = containerRef.current.getBoundingClientRect();
    const offset = 4; // tighter gap from the hovered column
    const vx = rect.left + (side === 'left' ? (hover.x - offset) : (hover.x + offset));
    const vy = rect.top + hover.y;
    return {
      display: hover.visible && page ? 'block' : 'none',
      position: 'fixed',
      top: `${vy}px`,
      left: `${vx}px`,
      transform: side === 'left' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
      zIndex: 9999,
      pointerEvents: 'none'
    };
  }, [hover.visible, hover.y, hover.x, page, side]);

  // Set CSS variables for sampling/alternating colors
  const stackStyle = { width: `${width ?? targetWidth}px` };

  // Alternating page colors can be themed via CSS vars
  return (
    <div
      ref={containerRef}
      className={`pageStack ${side}Stack horizontal`}
      style={stackStyle}
      onMouseMove={onMove}
      onMouseEnter={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      role="button"
      aria-label={`${side} page stack`}
    >
      {/* Hover column indicator */}
      {hover.visible && (
        <div className="stack-hover-column" style={{ left: `${hover.x}px` }} />
      )}

      {/* Tooltip via portal so it doesn't shrink/scale with container transforms */}
      {page && hover.visible && createPortal(
        <div className="stack-tooltip" style={tooltipViewportStyle}>
          <div className="stack-tooltip-content vertical">
            <img
              src={page.thumbAssetUrl}
              alt={`Thumbnail of page ${page.pageSlugLeaf}`}
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallback && page.pageAssetUrl) {
                  img.dataset.fallback = '1';
                  img.src = page.pageAssetUrl;
                } else {
                  img.src = `${assetUrl}/img/placeholder.jpg`;
                }
              }}
            />
            <div className="meta">
              <div className="title">Page {page.pageSlugLeaf}</div>
            </div>
          </div>
        </div>, document.body)
      }
    </div>
  );
}
