import React from "react";
import { label, processName, replaceNumbers, determineLanguage } from "src/models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import { renderPersonPlaceHTML, detectScripturesPreservingTokens } from "../../Page/PersonPlace";
import XrelSection from "../XrelSection";
import EntityThumb from "../EntityThumb";
import Relationships from "./Relationships";
import ReferenceList from "./ReferenceList";
import EntityChooser from "./EntityChooser";

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
 * Ambiguous bare slug. Thin wrapper over the shared EntityChooser so the popup
 * and the standalone page render one identical, self-styled list.
 */
export function PersonChooser({ requested, candidates, onEntityClick }) {
  return (
    <EntityChooser
      requested={requested}
      candidates={candidates}
      onEntityClick={onEntityClick}
      mediaType="people"
      base="/people"
    />
  );
}
