import React from "react";
import ReactTooltip from "react-tooltip";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { Link } from "react-router-dom";
import { useAppController } from "src/contexts/AppControllerContext";
import useListCap from "./useListCap";

// Moved verbatim out of PopUp.js so the entity bodies can be rendered by the
// standalone page without importing the popup (which would be circular, and
// would drag Narration/Victory/Draggable into every body test).
//
// `onEntityClick` is the one addition: the modal leaves it undefined and keeps
// the original setPopUp behaviour, while EntityPage passes a Router navigation
// so clicking a relationship on a page goes to the next page rather than
// opening a modal on top of it.
export default function Relationships({ data, onEntityClick }) {
  const appController = useAppController();
  const openPerson =
    onEntityClick ||
    ((slug) =>
      appController.functions.setPopUp({
        type: "people",
        ids: [slug],
        underSlug: "people",
      }));

  const [visible, showAll] = useListCap(data);
  if (!visible.length) return null;

  // A plain click keeps the in-app behaviour (modal or page navigation); a
  // modified click (new tab/window) falls through to the real href.
  const onRowClick = (e, slug) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openPerson(slug);
  };

  const personRow = (person, i) => {
    //determine split
    const namePosition = person.relation.indexOf("$1") ? "back" : "front";
    const StringwithSplitMarker = namePosition === "front" ?
      person.relation.replace(/(\$1\S+)/, "$1•")
    : person.relation.replace("$1", "•$1");

    const replaceWithLink = (text) => {
      //split by $1, keep delimiter
      if (!text.includes("$1")) return text;
      const pieces = text.split(/(\$1)/);
      if (pieces.length === 1) return text;
      return pieces.map((piece, i) => {
        if (piece === "$1") {
          return  <span key={i} className="nameLink">{person.person.name.replace(/\d+/, "")}</span>
        }
        return piece;
      });
    }
    const rows = StringwithSplitMarker.split("•").map(replaceWithLink).filter(i=>!!i);
    const items = [
      <div key={`${i}_0`} className="related_text_top">{rows[0]}</div>,
      <div key={`${i}_1`} className="related_text_bottom">{rows[1]}</div>
    ];

    const personTitle = person.person.title;

    return (
      <Link
        key={i}
        to={`/people/${person.person.slug}`}
        className="related_row"
        data-for="relToolTip"
        data-tip={`${personTitle}`}
        onClick={(e) => onRowClick(e, person.person.slug)}
      >
        <div style={{display:"flex"}}>
          <div className="related_text">
            {items}
          </div>

          <div className="related_avatar">
            <img src={`${assetUrl}/people/${person.person.slug}`} alt={person.person.name} />
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="related_people noselect">
      <ReactTooltip
        id="relToolTip"
        place="left"
        offset={{'bottom': 0, 'left': '10rem'}}
        effect="solid"
        backgroundColor={"#666"}
        arrowColor={"#666"}
      />
      {visible.map((relation, i) => personRow(relation, i))}
      {showAll}
    </div>
  );
}
