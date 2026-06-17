import React from "react";
import { PersonChip, PlaceChip, ContentCard, EventCard } from "./cards";

const CARD = { person: PersonChip, place: PlaceChip, commentary: ContentCard, narration: ContentCard, page: ContentCard, event: EventCard };

export default function ResultGroup({ label, cards, kind }) {
  if (!cards || !cards.length) return null;   // handles undefined (stripped empty groups) too
  const Card = CARD[kind] || ContentCard;
  const chips = kind === "person" || kind === "place";
  return (
    <section className={`result-group ${kind}`}>
      <h4 className="result-group-header">{label} <span className="count">({cards.length})</span></h4>
      <div className={chips ? "chip-row" : "card-list"}>
        {cards.map((c, i) => <Card key={c.slug || i} card={c} />)}
      </div>
    </section>
  );
}
