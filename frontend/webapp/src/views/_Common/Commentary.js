import React, { useState, useEffect, useRef } from "react";
import Comments from "./Study/Study";
import { assetUrl } from "src/models/BoMOnlineAPI";
import Parser from "html-react-parser";
import { parse } from "node-html-parser";
import Draggable from "react-draggable";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import "./Commentary.css";
import { LegalNotice, Loading } from "./PopUp";
import { addHighlightTagSelectively } from "../Page/TextContent";
import { snapSelectionToWord, label } from "src/models/Utils";
import { ScripturePanelSingle } from "../Page/Narration";
import { setLanguage, detectScriptures } from "scripture-guide";
import { determineLanguage } from "../../models/Utils";
import { ATVHeader } from "./ATV";
import { getHtmlScriptureLinkParserOptions } from "./ViewUtils";
import SweetAlert from "react-bootstrap-sweetalert";
import { Link } from "react-router-dom/cjs/react-router-dom.min";
//

export default function Commentary({ appController }) {

  const [PopUpRef,setPopUpRef] = useState(null)
  const [commentaryHighlights, setCommentaryHighlights] = useState([]);
  const [callingAPI, setAPICallStatus] = useState(false);
  const [popUpOpen, setOpenState] = useState(true);
  const [text, setText] = useState("");
  const [showLegal, setLegal] = useState(false);
	const [showHideCommentaryButton,setShowHideCommentaryButton] = useState(false);
	const [showHideModal,setShowHideModal] = useState({
		sourceTitle:'',
		activeId:null,
		isShow:false,
		sourceId:null
	});
  useEffect(() => {
 //   document.body.style = 'overflow: hidden';
    const popUpWindow = document.getElementById('popUp');
    const cardBodyElement = popUpWindow.childNodes[1];
    if(cardBodyElement.scrollTop !==0) cardBodyElement.scrollTop = 0;
    if(document.activeElement !== popUpWindow) popUpWindow.focus();
    setLegal(false)

    return ()=>{
  //    document.body.style = 'overflow: auto';
    }
  }, [appController.states.popUp.activeId]);

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
        "gi",
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

	const handleKeyboardListener = (e)=>{

		const activeId = appController.states.popUp.activeId;

		const ids = appController.states.popUp.ids;

		const activeIdIndex = ids.findIndex(id=>id === activeId);

		const cardBodyElement = document.getElementById('popUp').childNodes[1];

		if(ids.length >= 2){
			switch(e.key){
				case 'Tab':
				case 'ArrowRight':
					if(activeIdIndex === ids.length - 1){
						appController.functions.setActivePopUpId({ id: ids[0] })
					}else {
						appController.functions.setActivePopUpId({ id: ids[activeIdIndex+1] })
					}
					break;
					case 'ArrowLeft':
						if(activeIdIndex === 0){
							appController.functions.setActivePopUpId({ id: ids[ids.length-1] })
						}else {
							appController.functions.setActivePopUpId({ id: ids[activeIdIndex-1] })
						}
						break;
						default:
							break;
			}
		}

		if(e.key === 'ArrowUp'){
			cardBodyElement.scrollTop = cardBodyElement.scrollTop - 30;
		}else if(e.key === 'ArrowDown'){
			cardBodyElement.scrollTop = cardBodyElement.scrollTop + 30;
		}
	}

  if (!popUpOpen) return null;

  if (appController.states.popUp.loading) {
    if (!callingAPI) {
      setAPICallStatus(true);
      BoMOnlineAPI({ commentary: appController.states.popUp.ids }).then(
        (response) => {
          setAPICallStatus(false);
          setPopUpRef(null);
          appController.functions.setPopUp({
            type: "commentary",
            ids: Object.keys(response.commentary),
            popUpData: response.commentary,
          });
        },
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
    tmp = addHighlightTagSelectively(string, tmp);
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

	const handleHideCommentary = ()=>{
		let prefs = appController.states.preferences;
		let sources = [...prefs.commentary.filter.sources];
		const sourceId = parseInt(showHideModal.sourceId);
		if (sources.includes(sourceId)) {
				const index = sources.indexOf(sourceId);
				if (index > -1) {
						sources.splice(index, 1);
				}

		}
		else {
				sources.push(sourceId);
		}

		prefs.commentary.filter.sources = [...sources];
		appController.functions.updatePrefs(prefs);
		const activeId = showHideModal.activeId;
    let activeNextId = null;

    const activeIdIndex = appController.states.popUp.ids.findIndex(id=>id === activeId);

    if(activeIdIndex === appController.states.popUp.ids.length - 1){
      activeNextId = appController.states.popUp.ids[0];
    }else{
      activeNextId = appController.states.popUp.ids[activeIdIndex+1];
    }

		const popUpIdsFiltered = [...appController.states.popUp.ids].filter(id=>id !== activeId);
    BoMOnlineAPI({ commentary: popUpIdsFiltered }).then(
      (response) => {
        if(Object.keys(response).length === 0) {
          handleCancelHideCommentary();
          setOpenState(false);
          appController.functions.closePopUp();
          return;
        }

        appController.functions.setPopUp({
          type: "commentary",
          ids: Object.keys(response.commentary),
          popUpData: response.commentary,
        });
        appController.functions.setActivePopUpId({ id: activeNextId })
      },
    );
		handleCancelHideCommentary();
}

	const handleCancelHideCommentary = ()=>{
		setShowHideModal({isShow:false,sourceTitle:'',sourceId:null,activeId:null})
    setShowHideCommentaryButton(false);
	}

  const handleOpenHideCommentaryModal = ()=>{
    setShowHideModal({
        isShow:true,
        activeId:appController.states.popUp.activeId,
        sourceTitle:appController.popUpData[appController.states.popUp.activeId].publication.source_title,
        sourceId:appController.popUpData[appController.states.popUp.activeId].publication.source_id
      })
  }

  let commentaryData = false;
  let allKeys = Object.keys(appController.popUpData);
  let randomKey = allKeys[Math.floor(Math.random() * allKeys.length)];
  commentaryData =
    appController.popUpData[appController.states.popUp.activeId] ||
    appController.popUpData[randomKey];

		if(commentaryData ===undefined) {
		const commentaryDataEntriesArray = Object.entries(appController.popUpData);
		const commentaryDataUndefinedIndex = commentaryDataEntriesArray.findIndex(entry=>entry[1] === undefined);
		if(commentaryDataUndefinedIndex === commentaryDataEntriesArray.length -1){
			appController.functions.setActivePopUpId({ id: commentaryDataEntriesArray[0][0] })
		}else{
			appController.functions.setActivePopUpId({ id: commentaryDataEntriesArray[commentaryDataUndefinedIndex+1][0] })
		}
		return null;
	}

  if (!text || text !== commentaryData?.text) {
    setText(commentaryData?.text);
    setLegal(false);
  }
  let num = commentaryData?.location?.slug.replace(/\D+/, "") || 0;
  let coms_with_comments = [];
  if (
    appController.activeLeafCursorController &&
    appController.activeLeafCursorController.pageCommentCounts?.[num] &&
    appController.activeLeafCursorController.pageCommentCounts?.[num].com
  )
    coms_with_comments =
      appController.activeLeafCursorController.pageCommentCounts?.[num].com || 0;

  let c_ids = appController.states.popUp.ids;
  if (!c_ids.length) c_ids = Object.keys(c_ids);
  if (!c_ids.length) c_ids = [];
  let tabs = (
    <ul className={"source_tabs souce_tab_list_" + c_ids.length}>
      {c_ids.map((id, i) => {
        var source = id.substring(5, 8);
        let commentsIcon =
          coms_with_comments.indexOf(parseInt(id)) >= 0 ? (
            <span className={"comcom"}>💬</span>
          ) : null;
        let active = id === appController.states.popUp.activeId ? "active" : "";
        return (
          <li key={"tab" + id + i.toString()} className={'comment_tab '+active}>
            <img
              alt={source}
              onClick={() =>
                appController.functions.setActivePopUpId({ id: id })
              }
              src={assetUrl + "/source/cover/" + source}
            />
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
      <ul className={"source_tabs souce_tab_list_" + c_ids.length}>
        <li className="close" onClick={appController.functions.closePopUp}>
          ×
        </li>
      </ul>
    );

  let htmlObject = text;
  let domObject = parse(text);
  let atvHTML = domObject.querySelector(".source")?.outerHTML.trim() || "";
  if (atvHTML) htmlObject = htmlObject.replace(atvHTML, "").trim();

  // replace the last 2 spaces with non-breaking spaces
  const headingWords = commentaryData?.title?.split(" ") || [];
  const wordCount = headingWords.length;
  const commentaryHeading = headingWords
    .map((word, index) => {
      if (!index) return word;
      const isTailEnd = index <= wordCount - 3;
      if (!isTailEnd) return `\u00A0` + word;
      return ` ` + word;
    })
    .join("");

  if(!commentaryData?.publication) return null;
  setLanguage(determineLanguage());

  htmlObject = detectScriptures(htmlObject,(scripture) => {
    if (!scripture) return;
    return `<a className="scripture_link">${scripture}</a>`
  });

  const parserOptions = getHtmlScriptureLinkParserOptions((ref) => setPopUpRef(ref));

  return (
    <>
      <Draggable handle=".card-header">
        <div
          id="popUp"
          className="card popupwindow commentary"
          style={{
            top: appController.states.popUp.top,
            left: appController.states.popUp.left,
          }}
					onKeyDown={handleKeyboardListener}
					tabIndex={0}
        >
					<SweetAlert
							title="Are you sure you want to disable this commentary?"
							show={showHideModal.isShow}
							onConfirm={handleHideCommentary}
							onCancel={handleCancelHideCommentary}
							confirmBtnBsStyle="danger"
							cancelBtnBsStyle="default"
							confirmBtnText={label("disable")}
							cancelBtnText={label("cancel")}
							showCancel
							btnSize=""
							>
                <p><em>Commentaries from <strong>{showHideModal.sourceTitle}</strong> will no longer appear in the margins.  You can re-enable this commentary in your <Link to="/user/preferences">preferences</Link>.</em></p>
					</SweetAlert>
          <div className="card-header">
            {tabs}
            <div className="popupwindow_head commentary_head">
              {label("commentary_on_x", [commentaryData.reference])}
            </div>
          </div>
          <div className="card-body">
            <div id="my-tab-content" className="tab-content ">
              <div className="tab-pane active " id="home" role="tabpanel">
                {commentaryHeading && <h3>{commentaryHeading}</h3>}
                <div className="source noselect">
                  <div className="commentary_content_image">
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={commentaryData.publication.source_url}
                  >
                    <img
                      alt={commentaryData.publication.source_title}
                      className={`src ${showHideCommentaryButton && 'fade_image'}`}
                      src={
                        assetUrl +
                        "/source/cover/" +
                        commentaryData.publication.source_id.padStart(3, 0)
                      }
                      key={commentaryData.publication.source_slug}
                      onMouseEnter={()=>setShowHideCommentaryButton(true)}
                      onMouseLeave={(e)=>{
                      if(!e.relatedTarget.className?.includes('commentary_hide_button')){
                        setShowHideCommentaryButton(false)
                      };
                      }}
                    />
                  </a>
                  <div
                  className={`commentary_hide_button ${showHideCommentaryButton && 'show_button'}`}
                  onClick={handleOpenHideCommentaryModal}>×</div>
                  </div>
                  <div className="caption">
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={commentaryData.publication.source_url}
                    >
                      <div>
                        <div className="source_name">
                          {commentaryData.publication.source_title} <hr/>
                          {commentaryData.publication.source_name}
                        </div>
                        <div className="source_publisher">
                          © {commentaryData.publication.source_year || 2000},{" "}
                          {commentaryData.publication.source_publisher}
                        </div>
                      </div>
                    </a>
                    {!showLegal ? (
                      <div className="setLegal" onClick={() => setLegal(true)}>
                        ⚖️ {label("legal_notice")}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div id="bodytext" onMouseUp={handleSelection}>
                  <LegalNotice
                    appController={appController}
                    commentaryData={commentaryData}
                    showLegal={showLegal}
                  />

                  <ATVHeader atvHTML={atvHTML} />
                  {Parser(htmlObject, parserOptions)}
                </div>
              </div>
            </div>
          </div>
          <ScripturePanelSingle scriptureData={{ref:PopUpRef}} closeButton={true} setPopUpRef={setPopUpRef} />
          <Comments
            pageController={appController.activeLeafCursorController}
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
