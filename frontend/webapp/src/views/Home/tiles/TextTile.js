import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { TextInFeed } from "src/views/_Common/Study/StudyInFeed";
import "src/views/_Common/Study/StudyInFeed.css";

/**
 * One full bom_text block, rendered exactly as it appears in the community
 * feed (TextInFeed): heading, scripture text, art, "Page ▸ Section" context,
 * and its narration line. Links through to the block's study page.
 */
export default function TextTile({ data }) {
  if (!data?.slug) return null;
  return (
    <div className="samplerTileInner textTile">
      <h3 className="tileHeading">
        <Link to={`/${data.slug}`}>{label("scripture")}</Link>
      </h3>
      <TextInFeed textData={data} highlights={[]} />
    </div>
  );
}
