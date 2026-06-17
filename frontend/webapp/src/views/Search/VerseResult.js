import React from "react";
import { Link, useHistory } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { renderHighlighted } from "./highlight";
import { useHighlightRange } from "./highlightApi";

export default function VerseResult({ item, keyword, semantic, appController, keywordRender }) {
  const history = useHistory();
  const { reference, text, slug, page, section, speaker, voice } = item;
  const [range, ref] = useHighlightRange(keyword, text, !!semantic);

  const handleReadClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const chapterSlug = reference.split(":")[0];
    const verse = reference.split(":")[1];
    history.push("/read/" + chapterSlug + "/" + verse);
  };
  const handleImgClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    appController.functions.setPopUp({ type: "people", ids: [speaker], underSlug: `search/${keyword}` });
  };

  return <Link to={"/" + slug} ref={ref}>
    <div className="resultItem">
      <div className="reference-speaker noselect">
        <div className="reference noselect">{reference}</div>
        <div className="speaker noselect">
          <img alt={label(voice)} src={assetUrl + `/people/${speaker}`} onClick={handleImgClick} />
          <div className="read-voice" onClick={handleImgClick}>{label(voice)}</div>
        </div>
      </div>
      <div className="text">
        <h5 className="noselect">{section} <span>{page}</span>
          <button onClick={handleReadClick}>{label("menu_read")}</button>
          <button>{label("menu_study")}</button>
        </h5>
        <p className="scripture">{renderHighlighted(text, range, keyword, keywordRender)}</p>
      </div>
    </div></Link>;
}
