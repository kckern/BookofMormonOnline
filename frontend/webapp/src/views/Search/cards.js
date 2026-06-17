import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { useHighlightRange } from "./highlightApi";
import { renderHighlighted } from "./highlight";

// Wrap in a Link only when there's a slug; otherwise a non-clickable div (null slug = no destination).
function Wrap({ slug, className, children, innerRef }) {
  if (slug) return <Link className={className} to={`/${slug}`} ref={innerRef}>{children}</Link>;
  return <div className={`${className} no-link`} ref={innerRef}>{children}</div>;
}

export function PersonChip({ card }) {
  const id = (card.slug || "").replace(/^people\//, "");
  return <Wrap slug={card.slug} className="result-chip person">
    <img alt={card.title || ""} src={assetUrl + `/people/${id}`} />
    <span>{card.title}</span>
  </Wrap>;
}
export function PlaceChip({ card }) {
  return <Wrap slug={card.slug} className="result-chip place"><span>{card.title}</span></Wrap>;
}
export function ContentCard({ card, query, semantic }) {
  const eager = card.highlight || null;
  const [range, ref] = useHighlightRange(query, card.snippet, !!semantic && !eager);
  return <Wrap slug={card.slug} className="result-card content" innerRef={ref}>
    {card.title && <h6>{card.title}</h6>}
    {card.snippet && <p>{renderHighlighted(card.snippet, eager || range, query)}</p>}
  </Wrap>;
}
export function EventCard({ card }) {
  return <Wrap slug={card.slug} className="result-card event">
    {card.ref && <span className="event-date">{card.ref}</span>}
    <span>{card.title}</span>
  </Wrap>;
}
