import React from "react";
import MattersGroupTile from "./MattersGroupTile";

/**
 * Narrative/Concrete matters — named artifacts (branch=concrete, specificity=instance)
 * anchored to a specific verse. The only group tile that shows the subtitle overlay.
 */
export default function MattersNarrativeTile(props) {
  return (
    <MattersGroupTile
      {...props}
      className="mattersNarrativeTile"
      to="/matters/narrative"
      headingKey="matters_group_narrative"
      headingFallback="Narrative"
      countKey="mattersNarrativeCount"
      showSubtitle
    />
  );
}
