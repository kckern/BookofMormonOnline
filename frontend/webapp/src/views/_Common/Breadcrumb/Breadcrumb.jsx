import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Drawer from "react-modern-drawer";
import "react-modern-drawer/dist/index.css";
import { isMobile } from "src/models/Utils";
import "./Breadcrumb.css";

/**
 * Breadcrumb — reusable hierarchy trail for the whole app.
 *
 * Two ways to use it:
 *   1. Shorthand:  <Breadcrumb items={[{ label, to?, onClick?, current?, key? }]} />
 *   2. Composed:   <Breadcrumb><Breadcrumb.Link/>…<Breadcrumb.Dropdown/></Breadcrumb>
 *
 * The container auto-inserts a separator (default "›") between every rendered
 * segment, including after an optional far-left root icon.
 *
 * Props:
 *  - items?:     shorthand trail. An item renders as a Link when it has `to`/`onClick`,
 *                otherwise (or when `current:true`) as non-interactive current text.
 *  - children?:  composed segments (use instead of `items`).
 *  - separator?: node between segments. Default "›".
 *  - size?:      "sm" (0.72rem) | "md" (0.9rem, default).
 *  - root?:      { icon, to?, onClick?, label?, 'aria-label'? } optional far-left segment.
 *  - className?, aria-label? (default "Breadcrumb").
 */
export default function Breadcrumb({
  items,
  children,
  separator = "›",
  size = "md",
  root,
  className = "",
  "aria-label": ariaLabel = "Breadcrumb",
  ...rest
}) {
  const segments = [];

  if (root) {
    segments.push(
      <Breadcrumb.Root
        key="__root"
        icon={root.icon}
        label={root.label}
        to={root.to}
        onClick={root.onClick}
        aria-label={root["aria-label"]}
      />
    );
  }

  if (items && items.length) {
    items.forEach((it, i) => {
      const key = it.key != null ? it.key : `item-${i}`;
      if (it.current) {
        segments.push(<Breadcrumb.Current key={key}>{it.label}</Breadcrumb.Current>);
      } else if (it.to || it.onClick) {
        segments.push(
          <Breadcrumb.Link key={key} to={it.to} onClick={it.onClick}>
            {it.label}
          </Breadcrumb.Link>
        );
      } else {
        // Non-link, non-current items are plain muted text — NOT aria-current
        // (only `current: true` marks the current page).
        segments.push(<span className="bc-text" key={key}>{it.label}</span>);
      }
    });
  } else if (children) {
    React.Children.toArray(children).forEach((child) => segments.push(child));
  }

  const withSeps = [];
  segments.forEach((seg, i) => {
    if (i > 0) {
      withSeps.push(
        <span className="bc-sep" aria-hidden="true" key={`sep-${i}`}>
          {separator}
        </span>
      );
    }
    withSeps.push(seg);
  });

  return (
    <nav className={`breadcrumb bc-size-${size} ${className}`.trim()} aria-label={ariaLabel} {...rest}>
      {withSeps}
    </nav>
  );
}

Breadcrumb.Root = function BreadcrumbRoot({ icon, label, to, onClick, className = "", ...rest }) {
  const cls = `bc-root ${className}`.trim();
  const inner = (
    <>
      {icon}
      {label ? <span className="bc-root-label">{label}</span> : null}
    </>
  );
  if (to) return <Link to={to} className={cls} onClick={onClick} {...rest}>{inner}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick} {...rest}>{inner}</button>;
  return <span className={cls} {...rest}>{inner}</span>;
};

Breadcrumb.Link = function BreadcrumbLink({ to, onClick, className = "", children, ...rest }) {
  const cls = `bc-link ${className}`.trim();
  if (to) return <Link to={to} className={cls} onClick={onClick} {...rest}>{children}</Link>;
  return <button type="button" className={cls} onClick={onClick} {...rest}>{children}</button>;
};

Breadcrumb.Current = function BreadcrumbCurrent({ className = "", children, ...rest }) {
  return (
    <span className={`bc-current ${className}`.trim()} aria-current="page" {...rest}>
      {children}
    </span>
  );
};

/**
 * useBreadcrumbDropdown — the open/close/click-outside/Escape machinery behind
 * Breadcrumb.Dropdown, exported as an escape hatch for fully custom markup.
 *
 * Controlled via { open, onOpenChange }; uncontrolled via { defaultOpen }.
 * When { mobileDrawer } and isMobile(), only Escape is wired (the Drawer owns
 * its own overlay/outside handling). Attach `ref` to the trigger+panel wrapper.
 */
export function useBreadcrumbDropdown({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  onClose,
  mobileDrawer = false,
} = {}) {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const ref = useRef(null);

  const setOpen = useCallback(
    (next) => {
      if (!isControlled) setUncontrolledOpen(next);
      if (onOpenChange) onOpenChange(next);
      if (!next && onClose) onClose();
    },
    [isControlled, onOpenChange, onClose]
  );

  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        close();
      }
    };
    // On the mobile drawer, the drawer's own overlay handles dismissal — wiring a
    // document mousedown handler here would fight it. Only wire Escape.
    if (mobileDrawer && isMobile()) {
      document.addEventListener("keydown", onKey, true);
      return () => document.removeEventListener("keydown", onKey, true);
    }
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close, mobileDrawer]);

  return { open, toggle: () => setOpen(!open), close, setOpen, ref };
}

/**
 * Breadcrumb.Dropdown — interactive terminal segment. Owns the dropdown/drawer
 * machinery; its children are the content slot (a node, or ({close}) => node).
 *
 * Props: label, open?/onOpenChange? (controlled) | defaultOpen?, onClose?,
 * mobileDrawer?, drawerProps?, chevron? (default "▾"), className, children.
 */
Breadcrumb.Dropdown = function BreadcrumbDropdown({
  label,
  open,
  defaultOpen,
  onOpenChange,
  onClose,
  mobileDrawer = false,
  drawerProps = {},
  chevron = "▾",
  className = "",
  children,
  ...rest
}) {
  const dd = useBreadcrumbDropdown({ open, defaultOpen, onOpenChange, onClose, mobileDrawer });
  const content = typeof children === "function" ? children({ close: dd.close }) : children;
  const mobile = mobileDrawer && isMobile();

  return (
    <span className="bc-dropdown-wrap" ref={dd.ref}>
      <button
        type="button"
        className={`bc-current bc-trigger${dd.open ? " open" : ""} ${className}`.trim()}
        aria-haspopup="true"
        aria-expanded={dd.open}
        onClick={dd.toggle}
        {...rest}
      >
        {label}
        <span className="bc-chevron" aria-hidden="true">{chevron}</span>
      </button>
      {mobile ? (
        <Drawer open={dd.open} direction="right" size="85vw" onClose={dd.close} {...drawerProps}>
          {content}
        </Drawer>
      ) : (
        dd.open && (
          <div className="bc-dropdown">
            {content}
          </div>
        )
      )}
    </span>
  );
};
