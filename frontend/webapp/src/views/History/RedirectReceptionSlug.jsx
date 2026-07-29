/** @format */
import React from "react";
import { Redirect, useParams } from "react-router-dom";

// Old single-segment reception deep links (/history/<slug>) → /history/reception/<slug>.
export default function RedirectReceptionSlug() {
  const { slug } = useParams();
  return <Redirect to={`/history/reception/${slug}`} />;
}
