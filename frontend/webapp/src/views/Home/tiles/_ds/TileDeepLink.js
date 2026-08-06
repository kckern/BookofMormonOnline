import React from "react";
import { label } from "src/models/Utils";
import { useReveal } from "./Reveal";
import TileCTA from "./TileCTA";

/**
 * Layer 2 — the deeplink into the associated content. Hidden only while a
 * Layer-1 reveal is registered (`gated`) but not yet fired (`!revealed`). If no
 * gate was registered (short prose, or a modal/interactive Layer 1) it shows
 * immediately; `always` forces it visible regardless.
 */
export default function TileDeepLink({ to, always = false, children, className = "" }) {
  const { revealed, gated } = useReveal();
  if (!always && gated && !revealed) return null;
  return (
    <TileCTA variant="deeplink" to={to} className={className}>
      {children || label("view_in_context")}
    </TileCTA>
  );
}
