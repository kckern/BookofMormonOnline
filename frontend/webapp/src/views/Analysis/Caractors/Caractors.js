import "./Caractors.css"; 
import tileData from "./tiles.json";
import similarData from "./matches.json";
import { label } from 'src/models/Utils';
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
//console.log(similarData);
function Caractors() {
  const [similars, setSimilars] = useState([]);
  const [activeGrid, setActiveGrid] = useState(false);
  const [activeTile, setActiveTile] = useState(null);
  const [activeItem, setActiveItem] = useState(null);

  useEffect(()=>document.title = "Caractors | " + label("home_title"),[])

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
    <div className="container caractors">
      <div id="page">
        <h3 className="title lg-4 text-center"
        style={{ margin:0, padding:0, marginTop: "20px" }}
        >“Caractors” Document</h3>
        <p style={{ textAlign: "center" }}>
          <small className="text-muted">
          This is an interactive presentation of the <a target="_blank" href={"https://www.josephsmithpapers.org/paper-summary/appendix-2-document-1-characters-copied-by-john-whitmer-circa-1829-1831/1"}>“Caractors” document</a>, discovered in the David Whitmer estate in 1888.<br/> Tap or move your mouse over the grid to see each glyph in detail, along with closely matched and similar glyphs.  
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
                key={m.id}
                onMouseEnter={() => {
                  setActiveItem(m);
                  setActiveGrid(true);
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
                  key = {m.id}
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
                  key = {m.id}
                  src={`${assetUrl}/caractors/row${m.id.replace(
                    "-",
                    "_"
                  )}`}
                />
              ))} </div>
              
            </div>
          </div> : null }
        </div>


      </div>
    </div>
  );
}

export default Caractors;
