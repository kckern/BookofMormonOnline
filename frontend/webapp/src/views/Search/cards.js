import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";

// Wrap in a Link only when there's a slug; otherwise a non-clickable div (null slug = no destination).
function Wrap({ slug, className, children }) {
  if (slug) return <Link className={className} to={`/${slug}`}>{children}</Link>;
  return <div className={`${className} no-link`}>{children}</div>;
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
export function ContentCard({ card }) {
  return <Wrap slug={card.slug} className="result-card content">
    {card.title && <h6>{card.title}</h6>}
    {card.snippet && <p>{card.snippet}</p>}
  </Wrap>;
}
export function EventCard({ card }) {
  return <Wrap slug={card.slug} className="result-card event">
    {card.ref && <span className="event-date">{card.ref}</span>}
    <span>{card.title}</span>
  </Wrap>;
}
