import React from "react";
import ReactTooltip from "react-tooltip";
import { label, replaceNumbers } from "src/models/Utils";

// Moved verbatim out of PopUp.js alongside Relationships — see that file for why.
export default function ReferenceList({ index, setPopupRef }) {
  setPopupRef || (setPopupRef = ()=>{})
  return (
    <>
      <h4>{label("references")}</h4>
      <ol className="reference-list">
        {index &&
          index.map((reference, i) => (
            <li key={i}>
              <a
                className="ppref"
                onClick={()=>setPopupRef(reference.ref)}
                data-tip={reference.ref}
              >
                {replaceNumbers(reference.text)}
              </a>
            </li>
          ))}
      </ol>
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
