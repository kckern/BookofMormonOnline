import React from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, processName, replaceNumbers, determineLanguage } from "src/models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import { renderPersonPlaceHTML, detectScripturesPreservingTokens } from "../../Page/PersonPlace";
import XrelSection from "../XrelSection";
import EntityThumb from "../EntityThumb";
import ReferenceList from "./ReferenceList";

/**
 * The content of a matter profile — moved verbatim out of PopUp.js's MatterPopUp().
 *
 * `ppRef` and `bodyRef` are optional: the modal passes them to drive its
 * sticky-prose measurement (which is keyed off the popup card's height and is
 * meaningless on a page), and the page omits them so the document scrolls
 * normally.
 */
export default function MatterBody({ data, setPopUpRef, ppRef, bodyRef }) {
  const appController = useAppController();
  const obj = data;
  if (!obj) return null;

  return (
    <div className="ppbody" ref={ppRef}>
      <div className="bodytext" ref={bodyRef}>
        <h3>
          {processName(obj.name)}
          {obj.subtitle && (
            <>
              <br />
              <small className="ppbody-title">{replaceNumbers(obj.subtitle)}</small>
            </>
          )}
        </h3>
        {renderPersonPlaceHTML(
          detectScripturesPreservingTokens(
            obj.description || "",
            (scripture) => scripture ? `<a className="scripture_link">${scripture}</a>` : "",
            determineLanguage()
          ),
          appController,
          setPopUpRef
        )}
      </div>

      <div className="refbox">
        <div className="ppimg">
          <EntityThumb type="matters" slug={obj.slug} name={obj.name} rounded />
        </div>

        <XrelSection xrels={obj.xrels} showEmpty />

        <ReferenceList
          index={obj.index}
          setPopupRef={setPopUpRef}
        />
      </div>
    </div>
  );
}

/**
 * Ambiguous bare slug. Candidates come from models/slugVariants resolveSlug.
 */
export function MatterChooser({ requested, candidates, onEntityClick }) {
  return (
    <div className="ppbody" style={{ flexDirection: "column", gap: "0.5em" }}>
      {candidates.length > 0 ? (
        candidates.map((c) => (
          <div
            key={c.slug}
            className="related_row"
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75em", padding: "0.5em" }}
            onClick={() => onEntityClick(c.slug)}
          >
            <div className="related_avatar">
              <img src={`${assetUrl}/matters/${c.slug}`} alt={c.name} />
            </div>
            <div>
              <strong>{processName(c.name)}</strong>
              {c.subtitle && (
                <div>
                  <small>{replaceNumbers(c.subtitle)}</small>
                </div>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="emptyState" style={{ padding: "2em", textAlign: "center" }}>
          {processName(requested)}
        </div>
      )}
    </div>
  );
}
