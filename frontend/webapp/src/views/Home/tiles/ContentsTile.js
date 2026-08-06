import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ExpandableText from "./ExpandableText";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";

/**
 * One sampled division rendered like a single /contents entry: banner, title,
 * teaser, then the actual page/section outline — real links into the guide,
 * not just a picture of it. Outer element is a div (not a Link): the outline
 * carries its own nested anchors. Layer 1 = the expandable teaser; Layer 2 =
 * a gated deeplink into the division, revealed once the teaser is expanded.
 */
export default function ContentsTile({ data }) {
  if (!data?.slug) return null;
  return (
    <RevealProvider>
      <div className="samplerTileInner contentsTile">
        <h3 className="tileHeading">
          <Link to="/contents">{label("contents")}</Link>
        </h3>
        <Link to={`/${data.slug}`} className="contentsTileHead">
          <div className="contentsTileTitle">{data.title}</div>
          <img
            src={`${assetUrl}/home/${data.slug}-1`}
            alt=""
            loading="lazy"
            onError={(e) => (e.target.style.display = "none")}
          />
          {data.description ? (
            <ExpandableText className="contentsTileDesc" lines={5}>
              {data.description}
            </ExpandableText>
          ) : null}
        </Link>
        {data.pages?.length ? (
          <div className="contentsOutline">
            {data.pages.map((pg) => (
              <div className="contentsOutlinePage" key={pg.slug}>
                {pg.title !== data.title ? (
                  <Link to={`/${pg.slug}`} className="contentsOutlinePageLink">{pg.title}</Link>
                ) : null}
                {pg.sections?.length ? (
                  <div className="contentsOutlineSections">
                    {pg.sections.map((s, i) => (
                      <React.Fragment key={s.slug}>
                        {i > 0 ? <span className="contentsOutlineDot"> · </span> : null}
                        <Link to={`/${s.slug}`}>{s.title}</Link>
                      </React.Fragment>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        <TileDeepLink to={`/${data.slug}`}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
}
