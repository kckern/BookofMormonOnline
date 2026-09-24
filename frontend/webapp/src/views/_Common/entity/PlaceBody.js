import React, { useState } from "react";
import Parser from "html-react-parser";
import { Button } from "reactstrap";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, processName, replaceNumbers, determineLanguage } from "src/models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import { renderPersonPlaceHTML, detectScripturesPreservingTokens } from "../../Page/PersonPlace";
import XrelSection from "../XrelSection";
import EntityThumb from "../EntityThumb";
import ReferenceList from "./ReferenceList";

/**
 * The content of a place profile — moved verbatim out of PopUp.js's Place().
 *
 * Takes its record as a prop instead of reading appController.popUpData, so the
 * same markup serves the modal (PopUp.js supplies the chrome) and the standalone
 * page (views/Entity/EntityPage.js). `onMapClick(e, mapSlug, placeSlug)` keeps
 * the modal's signature: the modal passes its onSelectMapType (which closes the
 * popup and dispatches handleMapChange), the page passes a Router navigation.
 */
export default function PlaceBody({ data, setPopUpRef, onMapClick }) {
  const appController = useAppController();
  const [showOptions, setShowOptions] = useState(false);
  const place = data;
  if (!place) return null;
  const onSelectMapType = onMapClick || (() => {});

  return (
    <div className="ppbody">
      <div className="bodytext">
        <h3>
          <span>
            {Parser(
              place.name
                ? place.name.replace(/(\d+$)/, "<sup>$1</sup>")
                : "",
            )}
          </span>
          <br />
          <small className="ppbody-title">{place.info}</small>
        </h3>

        {renderPersonPlaceHTML(detectScripturesPreservingTokens(place.description, (scripture) => {
            if (!scripture) return;
            return `<a className="scripture_link">${scripture}</a>`
          }, determineLanguage()
        ), appController, setPopUpRef)}
      </div>

      <div className="refbox">
        <div className="ppimg">
        {place?.maps?.length > 0 ? (
          <Button 
            onClick={(e) => {
              if(place.maps.length > 1) {
              setShowOptions(!showOptions)
              } else {
                onSelectMapType(e, place.maps[0].slug, place.slug)
              }
            }
          }
          >
            {label("view_on_map")}
          </Button>
        ) : null}

        {showOptions && (
          place.maps.map((map, index) => (
            <Button 
              key={index} 
              onClick={(e) => onSelectMapType(e, map.slug, place.slug)}
            >
              {map.name}
            </Button>
          ))
        )}

          <EntityThumb type="places" slug={place.slug} name={place.name} rounded />
        </div>

        <XrelSection xrels={place?.xrels} />
        <ReferenceList
          index={place.index}
          setPopupRef={setPopUpRef}
        />
      </div>
    </div>
  );
}

/**
 * Ambiguous bare slug (/places/jerusalem → jerusalem-1, jerusalem-2).
 * Candidates come from models/slugVariants resolveSlug.
 */
export function PlaceChooser({ requested, candidates, onEntityClick }) {
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
              <img src={`${assetUrl}/places/${c.slug}`} alt={c.name} />
            </div>
            <div>
              <strong>{processName(c.name)}</strong>
              {c.info && (
                <div>
                  <small>{replaceNumbers(c.info)}</small>
                </div>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="emptyState" style={{ padding: "2em", textAlign: "center" }}>
          {requested}
        </div>
      )}
    </div>
  );
}
