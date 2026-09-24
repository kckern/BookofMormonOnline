import React from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, processName, replaceNumbers, determineLanguage } from "src/models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import { renderPersonPlaceHTML, detectScripturesPreservingTokens } from "../../Page/PersonPlace";
import XrelSection from "../XrelSection";
import EntityThumb from "../EntityThumb";
import Relationships from "./Relationships";
import ReferenceList from "./ReferenceList";

/**
 * The content of a person profile — moved verbatim out of PopUp.js's Person().
 *
 * Takes its record as a prop instead of reading appController.popUpData, and
 * reports navigation through onEntityClick instead of calling setPopUp, so the
 * same markup serves both the modal (PopUp.js supplies the chrome) and the
 * standalone page (views/Entity/EntityPage.js).
 */
export default function PersonBody({ data, setPopUpRef, onEntityClick }) {
  const appController = useAppController();
  const person = data;
  if (!person) return null;

  return (
    <div className="ppbody">
      <div className="bodytext">
        <h3>
          {processName(person.name)}
          <br />
          <small className="ppbody-title">
            {replaceNumbers(person.title)}
          </small>
        </h3>
        {renderPersonPlaceHTML(detectScripturesPreservingTokens(person.description, (scripture) => {
          if (!scripture) return;
          return `<a className="scripture_link">${scripture}</a>`
        }, determineLanguage()
      ), appController, setPopUpRef)}
      </div>

      <div className="refbox">
        <div className="ppimg">
          <EntityThumb type="people" slug={person.slug} name={processName(person.name)} rounded />
        </div>

        <h4>{label("relationships")}</h4>
        <Relationships data={person?.relations} onEntityClick={onEntityClick} />
        <XrelSection xrels={person?.xrels} noHeading />
        <ReferenceList
          index={person.index}
          setPopupRef={setPopUpRef}
        />
      </div>
    </div>
  );
}

/**
 * Ambiguous bare slug (/people/noah → noah1, noah2, noah3). Candidates come
 * from models/slugVariants resolveSlug, so loose prefix matches such as
 * noahs-priests are already excluded before this renders.
 */
export function PersonChooser({ requested, candidates, onEntityClick }) {
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
              <img src={`${assetUrl}/people/${c.slug}`} alt={c.name} />
            </div>
            <div>
              <strong>{processName(c.name)}</strong>
              {c.title && (
                <div>
                  <small>{replaceNumbers(c.title)}</small>
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
