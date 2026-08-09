import React from "react";
import MattersGroupTile from "./MattersGroupTile";

/**
 * Concept matters (branch=concepts) — abstractions like Judgment Seat, Family,
 * Oaths.
 */
export default function MattersConceptTile(props) {
  return (
    <MattersGroupTile
      {...props}
      className="mattersConceptTile"
      to="/matters/concepts"
      headingKey="matters_group_concepts"
      headingFallback="Concepts"
      countKey="mattersConceptCount"
    />
  );
}
