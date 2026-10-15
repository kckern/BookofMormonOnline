import React from "react";
import { label, processName, replaceNumbers, determineLanguage } from "src/models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import { renderPersonPlaceHTML, detectScripturesPreservingTokens } from "../../Page/PersonPlace";
import XrelSection from "../XrelSection";
import EntityThumb from "../EntityThumb";
import ReferenceList from "./ReferenceList";
import EntityChooser from "./EntityChooser";

/**
 * The content of a matter profile — moved verbatim out of PopUp.js's MatterPopUp().
 *
 * `ppRef` and `bodyRef` are optional: the modal passes them to drive its
 * sticky-prose measurement (which is keyed off the popup card's height and is
 * meaningless on a page), and the page omits them so the document scrolls
 * normally.
 */
export default function MatterBody({ data, setPopUpRef, ppRef, bodyRef, headingLevel = 3 }) {
  const appController = useAppController();
  const obj = data;
  if (!obj) return null;
  // The name is the page's <h1> on EntityPage; the popup keeps its <h3>.
  const Heading = `h${headingLevel}`;

  return (
    <div className="ppbody" ref={ppRef}>
      <div className="bodytext" ref={bodyRef}>
        <Heading className="entity-name">
          {processName(obj.name)}
          {obj.subtitle && (
            <>
              <br />
              <small className="ppbody-title">{replaceNumbers(obj.subtitle)}</small>
            </>
          )}
        </Heading>
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

        {/* No "No relationships." stub: an empty section is hidden, as on
            people and places. */}
        <XrelSection xrels={obj.xrels} />

        <ReferenceList
          index={obj.index}
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
export function MatterChooser({ requested, candidates, onEntityClick }) {
  return (
    <EntityChooser
      requested={requested}
      candidates={candidates}
      onEntityClick={onEntityClick}
      mediaType="matters"
      base="/matters"
    />
  );
}
