import React from "react";
import "./FilterSwitch.css";

/**
 * The on/off pill shown beside a filter option.
 *
 * Replaces bootstrap-switch-button-react, which was capped at React ^16.4.0 and
 * blocked the React 18 upgrade. Bootstrap 5 is already a dependency and ships
 * `.form-check.form-switch`, so this removes a dependency rather than swapping
 * one in.
 *
 * DISPLAY ONLY, exactly like the component it replaces was used: both call
 * sites (FilterPanel and MatterDetailColumn) handle the click on the parent
 * <li>, and neither ever passed onChange. Hence readOnly and tabIndex -1 — the
 * row is the control, this is its indicator.
 *
 * The old component rendered "on"/"off" text inside the pill; Bootstrap's
 * native switch has no inner text, so that wording is gone. The option's own
 * label still sits next to it.
 *
 * data-testid/data-checked match the stub FilterPanel.test.jsx used to mock in
 * place of the old package, so the test now exercises this component directly.
 */
export default function FilterSwitch({ checked }) {
  const on = !!checked;
  return (
    <span
      className="form-check form-switch fpSwitch"
      data-testid="switch"
      data-checked={on ? "1" : "0"}
    >
      <input
        className="form-check-input"
        type="checkbox"
        role="switch"
        checked={on}
        readOnly
        tabIndex={-1}
      />
    </span>
  );
}
