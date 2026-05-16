import React from "react";
import { Alert } from "reactstrap";
import { label } from "src/models/Utils";

export default function InitWarning({ warning, onDismiss }) {
  if (!warning) return null;
  const labelKey =
    warning.type === "verseNotFound" ? "init_warning_verse_not_found" : "init_warning_generic";
  const fallback =
    warning.type === "verseNotFound"
      ? "Couldn't find the specific verse for this link. Showing the page instead."
      : "Couldn't complete this navigation.";
  return (
    <Alert color="warning" className="pageInfo" toggle={onDismiss}>
      {label(labelKey) || fallback}
      {warning.slug ? <> <code>{warning.slug}</code></> : null}
    </Alert>
  );
}
