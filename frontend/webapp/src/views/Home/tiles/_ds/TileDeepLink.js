import React from "react";
import { useReveal } from "./Reveal";
import TileCTA from "./TileCTA";

/**
 * Layer 2 — the deeplink into the associated content. Hidden only while a
 * Layer-1 reveal is registered (`gated`) but not yet fired (`!revealed`). If no
 * gate was registered (short prose, or a modal/interactive Layer 1) it shows
 * immediately; `always` forces it visible regardless.
 *
 * `verb` (default "seeInContext") picks the label from the CTA vocabulary;
 * `name` fills "Open <name>". Explicit `children` win.
 */
export default function TileDeepLink({ to, always = false, verb = "seeInContext", name, children, className = "" }) {
  const { revealed, gated } = useReveal();
  if (!always && gated && !revealed) return null;
  return (
    <TileCTA variant="deeplink" verb={verb} name={name} to={to} className={className}>
      {children}
    </TileCTA>
  );
}
