import "./Caractors.css"; 
import tileData from "./tiles.json";
import similarData from "./matches.json";
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Collapse,
  NavItem,
  NavLink,
  Nav,
  TabContent,
  TabPane,
  Row,
  Col,
  Alert,
} from "reactstrap";
import React, { useEffect, useState } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
function Caractors() {
  const [similars, setSimilars] = useState([]);
  const [activeGrid, setActiveGrid] = useState(false);
  const [activeTile, setActiveTile] = useState(null);
  const [activeItem, setActiveItem] = useState(null);

  const [openedCollapses, setOpenedCollapses] = React.useState([
    "collapseOne",
    "collapse1",
  ]);
  // with this function we create an array with the opened collapses
  // it is like a toggle function for all collapses from this page
  const collapsesToggle = (collapse) => {
    if (openedCollapses.includes(collapse)) {
      setOpenedCollapses(openedCollapses.filter((item) => item !== collapse));
    } else {
      openedCollapses.push(collapse);
      setOpenedCollapses([...openedCollapses, collapse]);
    }
  };

  let similarItems = tileData.filter((m) => similars?.includes(m.match));
  let matchedItems = tileData.filter((m) => m.match === activeTile && m.id !== activeItem.id);

  return (
    <div className="container">
      <div id="page">
        <h3 className="title lg-4 text-center"
        style={{ margin:0, padding:0, marginTop: "20px" }}
        >“Caractors” Document</h3>
        <p style={{ textAlign: "center" }}>
          <small>
          This is an interactive presentation of the “Caractors” document, discovered in the David Whitmer estate in 1888.<br/> Tap or move your mouse over the grid to see each glyph in detail, along with closely matched and similar glyphs.  
        </small>
        </p>
        <div className="caractors">
          <div
            className={"grid " + (activeGrid ? "active" : "")}
            onMouseEnter={() => setActiveGrid(true)}
            onMouseLeave={() => setActiveGrid(false)}
          >
            {tileData.map((m) => (
              <div
                onMouseEnter={() => {
                  setActiveItem(m);
                  setActiveTile(m.match);
                  setSimilars(similarData[m.match]);
                }}
                onMouseLeave={() => {
                  setActiveTile(null);
                  setSimilars([]);
                }}
                className={
                  "tile " +
                  (similars?.includes(m.match) ? "similar " : "") +
                  (activeTile === m.match ? "active " : "")
                }
                style={{
                  backgroundImage: `url('${assetUrl}/caractors/row${m.id.replace(
                    "-",
                    "_"
                  )}')`,
                }}
              ></div>
            ))}
          </div>

          { (activeGrid) ? <div className="flex-row-container ">
            <div className="flex-row-item active">
              <h6>Active Glyph</h6> <div>
              <img
                  src={`${assetUrl}/caractors/row${activeItem?.id.replace(
                    "-",
                    "_"
                  )}`}
                />
              
            </div>
            </div>
            <div className="flex-row-item match">
              <h6>{matchedItems.length} closely matched glyphs</h6>
            <div>
              {matchedItems.map((m) => (
                <img
                  src={`${assetUrl}/caractors/row${m.id.replace(
                    "-",
                    "_"
                  )}`}
                />
              ))}</div>
            
            </div>
            <div className="flex-row-item similar">
              
              <h6>{similarItems.length} loosely matched glyphs</h6>
              <div>
              {similarItems.map((m) => (
                <img
                  src={`${assetUrl}/caractors/row${m.id.replace(
                    "-",
                    "_"
                  )}`}
                />
              ))} </div>
              
            </div>
          </div> : null }
        </div>

        <Card className="caractors-info">
          <CardBody>
            <div
              aria-multiselectable={true}
              className="card-collapse"
              id="accordion"
              role="tablist"
            >
              <CardTitle tag="h5" className="text-center">
                <h5>About the Document</h5>
              </CardTitle>
              <Card className="card-plain">
                <CardHeader role="tab">
                  <a
                    aria-expanded={openedCollapses.includes("collapseOne")}
                    data-parent="#accordion"
                    data-toggle="collapse"
                    onClick={() => collapsesToggle("collapseOne")}
                  >
                    <h5>Overview</h5>
                    
                  </a>
                </CardHeader>
                <Collapse
                  role="tabpanel"
                  isOpen={openedCollapses.includes("collapseOne")}
                >
                  <CardBody>
                  The “Caractors” document, often linked to the Anthon Transcript due to its purported origin from the golden plates of the Book of Mormon, presents an interesting artifact within Latter-day Saint history. This artifact features several lines of characters, the nature of which has puzzled scholars and believers alike. Unlike descriptions provided by Charles Anthon, who noted columns of characters and a depiction resembling a "Mexican zodiac," the physical characteristics and content of the existing document do not align precisely with his accounts. Through a meticulous examination, this document reveals a fascinating array of symbols, lacking the vertical arrangement Anthon described but intriguing in its composition and possible interpretations. See the <a href="https://www.josephsmithpapers.org/paper-summary/appendix-2-document-1-characters-copied-by-john-whitmer-circa-1829-1831" target="_blank">Joseph Smith Papers</a> for more information.
                  </CardBody>
                </Collapse>
              </Card>
              <Card className="card-plain">
                <CardHeader role="tab">
                  <a
                    aria-expanded={openedCollapses.includes("collapseTwo")}
                    href="#pablo"
                    data-parent="#accordion"
                    data-toggle="collapse"
                    onClick={() => collapsesToggle("collapseTwo")}
                  >
                  <h5>Theories and Scholarly Assessments</h5>
                  </a>
                </CardHeader>
                <Collapse
                  role="tabpanel"
                  isOpen={openedCollapses.includes("collapseTwo")}
                >
                  <CardBody>
                  Scholarly investigations into the "Caractors" document have spanned various fields, including Egyptology, linguistics, and religious studies, aiming to uncover the origins and authenticity of its characters. Comparisons with known ancient scripts, such as Egyptian and Hebrew, have yielded mixed conclusions, showcasing the complexity and uniqueness of the document's characters. The diverging opinions among scholars, alongside attempts at translation and interpretation, underscore the challenges inherent in understanding an artifact with no direct parallels or Rosetta Stone. The document sparks a broader discussion on the processes of translation and revelation claimed by Joseph Smith, reflecting on the dynamic interplay between faith, history, and scholarship.

                  </CardBody>
                </Collapse>
              </Card>
              <Card className="card-plain">
                <CardHeader role="tab">
                  <a
                    aria-expanded={openedCollapses.includes("collapseThree")}
                    data-parent="#accordion"
                    data-toggle="collapse"
                    onClick={() => collapsesToggle("collapseThree")}
                  >
                  <h5>Cultural Significance and Legacy</h5>
                  </a>
                </CardHeader>
                <Collapse
                  role="tabpanel"
                  isOpen={openedCollapses.includes("collapseThree")}
                >
                  <CardBody>
                  The "Caractors" document occupies a special place in Latter-day Saint history and cultural memory, symbolizing the miraculous translation of the Book of Mormon and Joseph Smith's prophetic claims. Its legacy extends beyond academic inquiry, touching on themes of belief, identity, and the quest for understanding religious texts. The ongoing fascination with the document highlights the human desire to connect with the past and understand its mysteries. As scholars continue to study the artifact and believers reflect on its spiritual significance, the "Caractors" document remains a key piece in the complex puzzle of Mormon founding narratives and the enduring quest for faith-based and historical truths.
                  </CardBody>
                </Collapse>
              </Card>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default Caractors;
