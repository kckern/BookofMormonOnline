import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";

// label() returns the raw key (or " ") when the dictionary lacks it
const hubName = () => {
    const v = label("menu_analysis");
    return v && v !== " " && v !== "menu_analysis" ? v : "Analysis";
};

export default function AnalysisBreadcrumb({ children }) {
    return (
        <nav className="analysis-breadcrumb" aria-label="Breadcrumb">
            <Link to="/analysis">{hubName()}</Link>
            <span aria-hidden="true"> › </span>
            <span className="current">{children}</span>
        </nav>
    );
}
