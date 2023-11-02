import React, { useState } from "react";
// import ReactTooltip from 'react-tooltip';
// MEDIA URL
// CHILD
import Narration from "./Narration";
import PageLink from "./PageLink";
import Connection from "./Connection";
import Comments from "../_Common/Study/Study";
import { addHighlightTagSelectively } from "./TextContent";
//import theater svg
import theater from "../_Common/svg/theater.svg";
import { Link } from "react-router-dom/cjs/react-router-dom.min";
import { label } from "../../models/Utils";
import ReactTooltip from "react-tooltip";

function Section({ sectionData, pageController, setPageSlug }) {
  let preConnection = null;
  if (sectionData.rows[0].weight < 0) {
    preConnection = (
      <Connection
        rowData={sectionData.rows[0]}
        pageController={pageController}
      />
    );
  }

  const [sectionHighlights, setSectionHighlights] = useState([]);

  const addHighlight = (string) => {
    string = string.replace(/\n+/, "");
    if (string.replace(/\s+/, "") === "") return false;

    let tmp = [...sectionHighlights];
    tmp = addHighlightTagSelectively(string,tmp);
    setSectionHighlights(tmp);
  };

  const removeHighlight = (i) => {
    if (i === -1) return setSectionHighlights([]);
    sectionHighlights.splice(i, 1);
    setSectionHighlights([...sectionHighlights]);
  };
  const slugTip = sectionData.slug.split("/").pop();

	const theaterLink = <>
		<Link to={`/theater/${slugTip}`} className="theater-link" data-tip={label("view_in_theater")} data-for="page-info-tooltip">
    	<img src={theater} alt="theater" />
  	</Link>
		<ReactTooltip
			effect="solid"
			backgroundColor="#666"
			id="page-info-tooltip"
		/>
	</>
  return (
    <>
      {preConnection}
      <div
        className="pagesection card"
        id={sectionData.slug}
        key={sectionData.sectionIndex}
        titletext={sectionData.title}
      >
        <div className="card-header" style={{ margin: 0 }}>
				<div className="card-header-title-wrapper">
          <h4 id={"h2/" + sectionData.slug} className="title lg-4 text-left">
            {sectionData.title}
          </h4>
					{theaterLink}
					</div>
          {sectionData.rows.map((rowData, rowIndex) => {
            if (rowData.type === "N") {
              return (
                <Narration
                  key={`row-n-${sectionData.sectionIndex}-${rowIndex}`}
                  rowData={rowData}
                  pageController={pageController}
                  addHighlight={addHighlight}
                />
              );
            } else if (rowData.type === "O") {
              return (
                <PageLink
                  key={`row-o-${sectionData.sectionIndex}-${rowIndex}`}
                  rowData={rowData}
                  pageController={pageController}
                  setPageSlug={setPageSlug}
                />
              );
            } else if (rowData.type === "C") {
              if (rowData.weight < 0) return false;
              return (
                <Connection
                  key={`row-c-${sectionData.sectionIndex}-${rowIndex}`}
                  rowData={rowData}
                  pageController={pageController}
                />
              );
            } else return rowData;
          })}
        </div>

        <Comments
          pageController={pageController}
          linkData={{ section: sectionData.slug.match(/[^/]+$/)[0] }}
          highlights={sectionHighlights}
          removeHighlight={removeHighlight}
        />
      </div>
    </>
  );
}

export default Section;
