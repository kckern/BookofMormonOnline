import React from "react";
import MattersGroupTile from "./MattersGroupTile";

/**
 * Material/Indefinite matters — typological classes (branch=concrete,
 * specificity!=instance) like Swords, Gold, Houses.
 */
export default function MattersMaterialTile(props) {
  return (
    <MattersGroupTile
      {...props}
      className="mattersMaterialTile"
      to="/matters/material"
      headingKey="matters_group_material"
      headingFallback="Material"
      countKey="mattersMaterialCount"
    />
  );
}
