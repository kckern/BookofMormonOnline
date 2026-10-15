import React from "react";
import ReactTooltip from "react-tooltip";
import { label, replaceNumbers } from "src/models/Utils";
import useListCap from "./useListCap";

// Moved out of PopUp.js alongside Relationships — see that file for why.
//
// Each reference opens the scripture popup, so it is a <button>, not an <a>
// with no href (which is neither focusable nor a link). The section renders
// nothing when there are no references, and long lists cap at LIST_CAP.
export default function ReferenceList({ index, setPopupRef }) {
  setPopupRef || (setPopupRef = ()=>{})
  const [visible, showAll] = useListCap(index);
  if (!visible.length) return null;
  return (
    <>
      <h4>{label("references")}</h4>
      <ol className="reference-list">
        {visible.map((reference, i) => (
          <li key={i}>
            <button
              type="button"
              className="ppref"
              onClick={()=>setPopupRef(reference.ref)}
              data-tip={reference.ref}
            >
              {replaceNumbers(reference.text)}
            </button>
          </li>
        ))}
      </ol>
      {showAll}
      <ReactTooltip
        place="left"
        offset={{'bottom': 0, 'left': '10rem'}}
        effect="solid"
        backgroundColor={"#666"}
        arrowColor={"#666"}
      />
    </>
  );
}
