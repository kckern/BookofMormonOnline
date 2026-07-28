import React from "react";
import { Link } from "react-router-dom";
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
      if (!it.current && (it.to || it.onClick)) {
        segments.push(
          <Breadcrumb.Link key={key} to={it.to} onClick={it.onClick}>
            {it.label}
          </Breadcrumb.Link>
        );
      } else {
        segments.push(<Breadcrumb.Current key={key}>{it.label}</Breadcrumb.Current>);
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
