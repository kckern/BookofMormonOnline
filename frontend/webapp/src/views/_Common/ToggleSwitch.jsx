import React from "react";
import "./ToggleSwitch.css";

/**
 * On/off switch with optional on/off text and a real <input type="checkbox">.
 *
 * Replaces react-bootstrap-switch, which calls ReactDOM.findDOMNode (removed in
 * React 19) on mount and crashed /home/user/preferences, Theater settings and
 * the study-group list. Same props as the ones those call sites used: value,
 * onChange, onText, offText, id. onChange is called with no arguments; every
 * caller toggles from its own state.
 */
export default function ToggleSwitch({ value, onChange, onText, offText, id, disabled }) {
  const on = !!value;
  return (
    <span className={"bomToggle" + (on ? " is-on" : "") + (disabled ? " is-disabled" : "")}>
      <input
        id={id}
        className="bomToggle-input"
        type="checkbox"
        role="switch"
        checked={on}
        disabled={disabled}
        onChange={() => onChange && onChange()}
      />
      <span className="bomToggle-track" aria-hidden="true">
        <span className="bomToggle-text">{on ? onText : offText}</span>
        <span className="bomToggle-knob" />
      </span>
    </span>
  );
}
