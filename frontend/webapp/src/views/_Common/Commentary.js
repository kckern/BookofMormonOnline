import React, { useState, useEffect } from "react";
import Comments from "./Study/Study";
import { assetUrl } from 'src/models/BoMOnlineAPI';
import Parser from "html-react-parser";
import { parse } from 'node-html-parser';
import Draggable from "react-draggable";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import "./Commentary.css";
import { LegalNotice, Loading } from "./PopUp";
import { addHighlightTagSelectively } from "../Page/TextContent";
import {
  snapSelectionToWord,
  label,
} from "src/models/Utils";

export default function Commentary({ appController }) {
    const [commentaryHighlights, setCommentaryHighlights] = useState([]);
    const [callingAPI, setAPICallStatus] = useState(false);
    const [popUpOpen, setOpenState] = useState(true);
    const [text, setText] = useState("");
    const [showLegal, setLegal] = useState(false);
    useEffect(()=>setLegal(false),[appController.states.popUp.activeId])
    const setCommentHighlights = (items) => {
      if (!items || items.length === 0) return setText(commentaryData.text);
      let tmp = text + "";
      let highlighted = "";
      for (var i in items) {
        let highlight = items[i];
        var re = new RegExp(
          "(" +
          highlight
            .replace(/^[^a-z\d]*|[^a-z\d]*$/gi, "")
            .replace(/[^a-z]+/gi, "([^a-z]|<[^>]*>)+?") +
          ")",
          "gi"
        );
        if (highlighted.match(re)) continue;
        highlighted += highlight;
        tmp = tmp.replace(re, (string) => {
          return '<span class="highlight">' + highlight.trim() + "</span>";
        });
      }
      tmp = tmp.replace(/\s+/g, " ");
      setText(tmp + "");
    };
  
    if (!popUpOpen) return null;
  
    if (appController.states.popUp.loading) {
      if (!callingAPI) {
        setAPICallStatus(true);
        BoMOnlineAPI({ commentary: appController.states.popUp.ids }).then(
          (response) => {
            setAPICallStatus(false);
            appController.functions.setPopUp({
              type: "commentary",
              ids: Object.keys(response.commentary),
              popUpData: response.commentary,
            });
          }
        );
      }
  
      return (
        <Loading
          type="Commentary"
          appController={appController}
          callingAPI={callingAPI}
        />
      );
    }
  
    const addHighlight = (string) => {
      string = string.replace(/\n+/, "");
      if (string.replace(/\s+/, "") === "") return false;
      let tmp = [...commentaryHighlights];
      tmp = addHighlightTagSelectively(string,tmp);
      setCommentaryHighlights(tmp);
    };
  
    const removeHighlight = (i) => {
      if (i === -1) return setCommentaryHighlights([]);
      commentaryHighlights.splice(i, 1);
      setCommentaryHighlights([...commentaryHighlights]);
    };
  
    const handleSelection = () => {
      snapSelectionToWord();
      let selection = window.getSelection().toString();
      addHighlight(selection);
    };
  
    let commentaryData = false;
    let allKeys = Object.keys(appController.popUpData);
    let randomKey = allKeys[Math.floor(Math.random() * allKeys.length)];
    commentaryData = appController.popUpData[appController.states.popUp.activeId] || appController.popUpData[randomKey];

    console.log({commentaryData});
  
    if (!text || text !== commentaryData.text) { setText(commentaryData.text); setLegal(false); }
    let num = commentaryData?.location?.slug.replace(/\D+/, "") || 0;
    let coms_with_comments = [];
    if (
      appController.activePageController &&
      appController.activePageController.pageCommentCounts?.[num] &&
      appController.activePageController.pageCommentCounts?.[num].com
    )
      coms_with_comments =
        appController.activePageController.pageCommentCounts?.[num].com || 0;
  
    let c_ids = appController.states.popUp.ids;
    if(!c_ids.length) c_ids = Object.keys(c_ids);
    if(!c_ids.length) c_ids = [];
    let tabs = (
      <ul
        className={
          "source_tabs souce_tab_list_" + c_ids.length
        }
      >
        {c_ids.map((id, i) => {
          var source = id.substring(5, 8);
          let commentsIcon = coms_with_comments.indexOf(parseInt(id)) >= 0 ? <span className={"comcom"}>💬</span> : null;
          let active = id === appController.states.popUp.activeId ? "active" : "";
          return (
            <li key={"tab" + id + i.toString()} className={active}>
              <img
                alt={source}
                onClick={() => appController.functions.setActivePopUpId({ id: id })}
                src={assetUrl + "/source/cover/" + source}
              ></img>
              {commentsIcon}
            </li>
          );
        })}
        <li
          className="close"
          onClick={() => {
            setOpenState(false);
            appController.functions.closePopUp();
          }}
        >
          ×
        </li>
      </ul>
    );
  
    if (c_ids.length < 2)
      tabs = (
        <ul
          className={
            "source_tabs souce_tab_list_" + c_ids.length
          }
        >
          <li className="close" onClick={appController.functions.closePopUp}>
            ×
          </li>
        </ul>
      );
    
    
    let htmlObject = text;
    let  domObject = parse(text);
    let atvHTML = domObject.querySelector(".source")?.outerHTML.trim() || "";
    if(atvHTML)  htmlObject = htmlObject.replace(atvHTML,"").trim()



  
    return (
      <>
        <Draggable handle=".commentary_head">
          <div
            id="popUp"
            className="card popupwindow commentary"
            style={{
              top: appController.states.popUp.top,
              left: appController.states.popUp.left,
            }}
          >
            <div className="card-header">
              {tabs}
              <div className="popupwindow_head commentary_head">
                {label("commentary_on_x", [commentaryData.reference])}
              </div>
            </div>
            <div className="card-body">
              <div id="my-tab-content" className="tab-content ">
                <div className="tab-pane active " id="home" role="tabpanel">
                  <h3>{commentaryData.title}</h3>
                  <div className="source noselect">
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={commentaryData.publication.source_url}
                    >
                      <img
                        alt={commentaryData.publication.source_title}
                        className="src"
                        src={
                          assetUrl +
                          "/source/cover/" +
                          commentaryData.publication.source_id.padStart(3, 0)
                        }
                        key={commentaryData.publication.source_slug}
                      />
                    </a>
                    <div className="caption">
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={commentaryData.publication.source_url}
                      >
                      <div>
                      <div className="source_name">{commentaryData.publication.source_name}</div>
                      <div className="source_publisher">© {commentaryData.publication.source_year || 2000}, {commentaryData.publication.source_publisher}</div>
                      </div>
                      </a>
                    {!showLegal ? <div className="setLegal" onClick={()=>setLegal(true)} >⚖️ {label("legal_notice")}</div> : null }
                    </div>
                  </div>
                  
                  <div id="bodytext" onMouseUp={handleSelection}>
                    <ATVHeader atvHTML={atvHTML} />
                  <LegalNotice appController={appController} commentaryData={commentaryData} showLegal={showLegal} />
             
                    {Parser(htmlObject)}
                  </div>
                  <div className="attribution"> —
                    <a
                      target="_blank"
                      rel="noreferrer"
                      className="imglink"
                      href={commentaryData.publication.source_url}
                    >
                      {commentaryData.publication.source_title}
                    </a>
                  </div>
                   </div>
              </div>
            </div>
            <Comments
              pageController={appController.activePageController}
              linkData={{ com: parseInt(commentaryData.id) }}
              highlights={commentaryHighlights}
              removeHighlight={removeHighlight}
              setCommentHighlights={setCommentHighlights}
            />
          </div>
        </Draggable>
      </>
    );
  }



function ATVHeader({ atvHTML }) {
 if(!atvHTML) return null


 atvHTML = atvHTML.replace(/\[(.*?)\]/g, ATVBrackets);


  return (
    <div className="atv">{Parser(atvHTML)}</div>
  );
}

function ATVBrackets(a,string) {

    const parts = string.split("|").map(i=>{
        let indexes = i.match(/[A-Z01]+$/)[0];
        let content = i.replace(indexes,"").trim();
        return [content,indexes]
    })

    return parts.map(i=>`<span class="atv-string" data-indexes="${i[1]}">${i[0]}</span>`).join(" / ");

}