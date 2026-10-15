import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import ExpandableText from "./ExpandableText";
import { RevealProvider, TileBoundContext } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";

// A map of the division, not its sitemap: the first few pages, then a count.
export const MAX_PAGES = 6;

const sectionCount = (n) =>
  n === 1 ? labelOr("one_section", "1 section") : labelOr("n_sections", "$1 sections", [n]);

/**
 * One sampled division rendered like a single /contents entry: banner + title,
 * the teaser (Layer 1: Read more ⇄ Show less, in place), then the division's
 * pages as a short list of block links with their section counts — a map of
 * the division, not its full sitemap (the sections live on the pages). Layer 2
 * is "See in context" → the division, always visible.
 *
 * One tab stop per destination: the banner+title is a pointer convenience for
 * the same href as the CTA, so it is kept out of the tab order and the
 * accessibility tree; the description sits OUTSIDE any link, so its Read more
 * is never nested inside an <a>. The division's own intro page (same title,
 * same href as the division) is not repeated in the list.
 *
 * Inside a phone-bounded shell (BoundedTile provides TileBoundContext) the tile
 * already has ONE visible-bound reveal; the description then renders in full
 * under that fade instead of carrying a second, stacked Read more.
 */
export default function ContentsTile({ data }) {
  const bounded = useContext(TileBoundContext) != null;
  if (!data?.slug) return null;
  const allPages = (data.pages || []).filter((pg) => pg?.slug && pg.title && pg.slug !== data.slug && pg.title !== data.title);
  const pages = allPages.slice(0, MAX_PAGES);
  const morePages = allPages.length - pages.length;
  return (
    <RevealProvider>
      <div className="samplerTileInner contentsTile">
        <h3 className="tileHeading">
          <Link to="/contents">{label("contents")}</Link>
        </h3>
        <Link to={`/${data.slug}`} className="contentsTileHead" tabIndex={-1} aria-hidden="true">
          <TileImage
            path={`home/${data.slug}-1`}
            widths={[]}
            alt=""
            aspect="16 / 9"
            onError={(e) => (e.target.style.display = "none")}
          />
        </Link>
        <h4 className="contentsTileTitle">{data.title}</h4>
        {data.description ? (
          bounded ? (
            <div className="contentsTileDesc">{data.description}</div>
          ) : (
            <ExpandableText className="contentsTileDesc" lines={4}>
              {data.description}
            </ExpandableText>
          )
        ) : null}
        {pages.length ? (
          <ul className="contentsOutline">
            {pages.map((pg) => (
              <li key={pg.slug}>
                <Link to={`/${pg.slug}`} className="contentsOutlinePageLink">
                  <span className="contentsOutlinePageTitle">{pg.title}</span>
                  {pg.sections?.length ? (
                    <span className="contentsOutlineCount">{sectionCount(pg.sections.length)}</span>
                  ) : null}
                </Link>
              </li>
            ))}
            {morePages > 0 ? (
              <li className="contentsOutlineMore">{labelOr("and_n_more", "+ $1 more", [morePages])}</li>
            ) : null}
          </ul>
        ) : null}
        <TileDeepLink to={`/${data.slug}`} always verb="seeInContext" />
      </div>
    </RevealProvider>
  );
}
