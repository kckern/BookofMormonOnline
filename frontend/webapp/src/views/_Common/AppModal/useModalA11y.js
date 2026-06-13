import { useEffect, useRef } from "react";

/**
 * Shared accessibility behaviour for react-bootstrap-sweetalert dialogs
 * (and any modal that renders a single `.sweet-alert` node when visible).
 *
 * When `visible` flips true it:
 *  - records the element that had focus (the trigger) so it can be restored,
 *  - tags the dialog node with role="dialog" + aria-modal="true" (and a label),
 *  - moves focus into the dialog,
 *  - traps Tab/Shift+Tab inside the dialog,
 *  - calls `onClose` (if provided) when Escape is pressed.
 * When `visible` flips false it restores focus to the trigger.
 *
 * Safe no-op while not visible. Does not change any visual styling or the
 * existing mouse/confirm behaviour — it only adds keyboard/AT semantics.
 *
 * @param {boolean} visible       whether the modal is currently shown
 * @param {object}  opts
 * @param {function} opts.onClose called on Escape (use the same handler as the
 *                                Cancel/Close button); omit to disable Esc-close
 * @param {string}  opts.label    accessible name for the dialog
 * @param {string}  opts.selector dialog node selector (default ".sweet-alert")
 */
export default function useModalA11y(visible, { onClose, label: ariaLabel, selector = ".sweet-alert" } = {}) {
  const triggerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible) return undefined;

    // Remember who opened the dialog so we can restore focus on close.
    triggerRef.current = document.activeElement;

    let dialog = null;
    let raf = null;

    const getFocusable = () =>
      dialog
        ? Array.from(
            dialog.querySelectorAll(
              'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null || el === document.activeElement)
        : [];

    const onKeyDown = (e) => {
      if (e.key === "Escape" && onCloseRef.current) {
        e.preventDefault();
        onCloseRef.current(e);
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // SweetAlert mounts asynchronously; wait a frame for the node to exist.
    const setup = () => {
      dialog = document.querySelector(selector);
      if (!dialog) {
        raf = requestAnimationFrame(setup);
        return;
      }
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      if (ariaLabel) dialog.setAttribute("aria-label", ariaLabel);
      if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
      const focusable = getFocusable();
      (focusable[0] || dialog).focus();
    };
    raf = requestAnimationFrame(setup);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      // Restore focus to the trigger that opened the dialog.
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === "function" && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [visible, selector, ariaLabel]);
}
