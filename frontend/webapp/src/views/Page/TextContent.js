import React, { useState, useReducer } from "react";
import { Card, CardHeader, CardBody, Collapse, Col } from "reactstrap";
import {
  CommentaryBubbles,
  ImageBubbles,
} from "./Annotations";
import stringSimilarity from "string-similarity";
import Parser from "html-react-parser";
import "./TextContent.css";
import Comments from "../_Common/Study/Study";
import { snapSelectionToWord } from "src/models/Utils";
import triangle from "./triangle.svg";
import ReactTooltip from "react-tooltip";
import peopleSVG from "../_Common/svg/people.svg";
import placesSVG from "../_Common/svg/places.svg";
import studySVG from "../_Common/svg/study.svg";
import notesSVG from "../_Common/svg/notes.svg";
import faxSVG from "src/views/User/svg/oldbook.svg";
import { determineLanguage, label } from "../../models/Utils";

/* ------------------------------------------- */
/* -------------- STATE CHANGES  ------------- */
/* ------------------------------------------- */

function reducer(textContentController, input) {
  switch (input.fn) {
    case "toggleOpenClose":
      if (textContentController.states.isOpen)
        textContentController.pageController.functions.removeOpenRow(
          textContentController.data.slug
        );
      else
        textContentController.pageController.functions.setActiveRow(
          {
            slug:textContentController.data.slug,
            duration:textContentController.data.duration,
            pagetitle: textContentController.narrationController.pageController.pageData.title,
            heading: textContentController.data.heading
          }
        );
      textContentController.states.isOpen =
        !textContentController.states.isOpen;
      break;
    case "toggleOpenCloseHeader":
      if (textContentController.states.isHeaderOpen)
        textContentController.pageController.functions.removeOpenRow(
          textContentController.data.slug
        );
      else
        textContentController.pageController.functions.setActiveRow(
          {
            slug:textContentController.data.slug,
            duration:textContentController.data.duration,
            pagetitle: textContentController.narrationController.pageController.pageData.title,
            heading: textContentController.data.heading
          }
        );
      textContentController.states.isHeaderOpen =
        !textContentController.states.isHeaderOpen;
      break;
    default:
      break;
  }
  return { ...textContentController };
}


export function addHighlightTagSelectively(newString,tagArray)
{
  const threshHold = 0.5;
  
  let scores = tagArray.map(old=>{
    return stringSimilarity.compareTwoStrings(old,newString) || 0;
  });
  let maxScore = Math.max(...scores);
  let mostSimilarIndex = scores.indexOf(maxScore);
  if(maxScore>threshHold && mostSimilarIndex>=0) tagArray[mostSimilarIndex] = newString;
  else tagArray.push(newString);
  return tagArray;
}


export default function TextContent({ content, narrationController, isQuote }) {
  const [textContentHighlights, setTextContentHighlights] = useState([]);
  const [quoteContentHighlights, setQuoteContentHighlights] = useState([]);
  const addHighlight = (string, isQuote) => {
    string = string.replace(/\n+/, "");
    if (string.replace(/\s+/, "") === "") return false;
    let tmp = isQuote
      ? [...quoteContentHighlights]
      : [...textContentHighlights];
    
    tmp = addHighlightTagSelectively(string,tmp);

    isQuote ? setQuoteContentHighlights(tmp) : setTextContentHighlights(tmp);
  };

  const removeHighlight = (i, isQuote) => {
    if (i === -1)
      return isQuote
        ? setQuoteContentHighlights([])
        : setTextContentHighlights([]);
    isQuote
      ? quoteContentHighlights.splice(i, 1)
      : textContentHighlights.splice(i, 1);
    isQuote
      ? setQuoteContentHighlights([...quoteContentHighlights])
      : setTextContentHighlights([...textContentHighlights]);
  };

  /* ------------------------------------------- */
  /* -------------- TEXT RENDERING ------------- */
  /* ------------------------------------------- */

  // let appController = narrationController.appController;
  const renderTextContent = (content, textContentController) => {
    content = content.replace(
      /\[([a-z])\]([0-9]+?)\[\/[a-z]\]/g,
      '<a class="$1" contentid="$2"></a>'
    );
    content = content.replace(/_/g, '<span class="indent"></span>');
    content = content.replace(
      /\[quote\](.*?)\[\/quote\]/g,
      "<div class='quote' guid='$1'></div>"
    );
    //Process Highlights
    let highlighted = "";
    for (var i in narrationController.states.highlights) {
      let highlight = narrationController.states.highlights[i];
      var re = new RegExp("(" + highlight.string + ")", "gi");
      if (highlighted.match(re)) continue;
      highlighted += highlight.string;
      content = content.replace(re, (string) => {
        return (
          '<span class="highlight ' +
          highlight.class +
          '">' +
          string.trim() +
          "</span>"
        );
      });
    }
    content = content.replace(/\s+/g, " ");
    const options = {
      replace: (domNode) => {
        if (domNode.attribs && domNode.attribs.class === "quote") {
          return (
            <>
              {narrationController.data.text.quotes?.map((quote) => {
                if (quote.parent !== domNode.attribs.guid) return null;
                return (
                  <TextContent
                    key={quote.slug}
                    content={quote}
                    narrationController={narrationController}
                    isQuote={true}
                  />
                );
              })}
            </>
          );
        }
      },
    };
    return Parser(content, options);
  };

  /* ------------------------------------------- */
  /* -------------- TextController ------------- */
  /* ------------------------------------------- */

  // This is the main row Controller
  const [textContentController, dispatch] = useReducer(
    reducer,
    (() => {
      //Set Initial States
      var states = {
        isOpen:
          narrationController.pageController.states.openRows.indexOf(
            content.slug
          ) >= 0,
        isHeaderOpen: false,
      };

      //Define all Row-level functions
      let functions = {
        toggleOpenClose: (e) => {
          e.preventDefault();
          dispatch({ fn: "toggleOpenClose" });
        },
        toggleOpenCloseHeader: (e) => {
          e.preventDefault();
          dispatch({ fn: "toggleOpenCloseHeader" });
        },
      };

      //Create Initial Controller
      var initTextContentController = {
        data: content,
        renderedTextContent: null,
        states: states,
        functions: functions,
        pageController: narrationController.pageController,
        narrationController: narrationController,
      };

      //Extract Image and Commentary Values
      let imageIds =
        initTextContentController.data.content.match(/\[i\](\d+)\[\/i\]/gi);
      imageIds = imageIds && imageIds.map((i) => i.replace(/\D+/g, ""));
      let commentaryIds =
        initTextContentController.data.content.match(/\[c\]((\d+))\[\/c\]/gi);
      commentaryIds =
        commentaryIds && commentaryIds.map((i) => i.replace(/\D+/g, ""));
      initTextContentController.data.imageIds =
        imageIds && imageIds.length ? imageIds : [];
      initTextContentController.data.commentaryIds =
        commentaryIds && commentaryIds.length ? commentaryIds : [];
      return initTextContentController;
    })()
  );

  const handleSelection = (e, isQuote) => {
    if (e.target.tagName === "BUTTON") return;
    e.stopPropagation();
    snapSelectionToWord();
    let selection = window.getSelection().toString();
    addHighlight(selection, isQuote);
  };

  /* ------------------------------------------- */
  /* -------------- RENDERING ------------- */
  /* ------------------------------------------- */

  if (textContentController.data === undefined) return null;

  textContentController.pageController = narrationController.pageController;

  let num = parseInt(textContentController.data.slug.replace(/\D+/g, ""));

  let counts = null;
  if (
    textContentController.pageController.pageCommentCounts &&
    textContentController.pageController.appController.states.studyGroup
      .studyModeOn
  )
    counts = textContentController.pageController.pageCommentCounts?.[num] || 0;

  textContentController.renderedTextContent = renderTextContent(
    textContentController.data.content,
    textContentController
  );
  let isOpen = textContentController.states.isOpen || textContentController.states.isHeaderOpen;
  let CommentaryBubblesContainer = isOpen && !isQuote && <CommentaryBubbles textContentController={textContentController} /> || null;
  let ImageBubblesContainer = isOpen && !isQuote &&   <ImageBubbles textContentController={textContentController} /> || null;


  let cardWithoutNestedBlocks = true;
  if (Array.isArray(textContentController.renderedTextContent)) {
    for (let item of textContentController.renderedTextContent) {
      if (typeof item.type === "symbol") {
        cardWithoutNestedBlocks = false;
      }
    }
  }

  if(textContentController.data?.heading)
  textContentController.data.heading = textContentController.data.heading.replace(/^\[.*?\]/, "").trim();

  let openClass =  (textContentController.states.isOpen || textContentController.states.isHeaderOpen) ? " open" : "";
  return (
    <Col
      md={isQuote ? 12 : 6}
      textid={textContentController.data.slug}
      className={"scripture "}
    >
      {counts ? (
        <span
          className="comments"
          onClick={textContentController.functions.toggleOpenClose}
        >
          💬
        </span>
      ) : null}
      <div role="tablist" aria-multiselectable="true" className="card-collapse">
        <Card className="card-plain textblock">
          <CardHeader role="tab" className={"reference" + openClass}>
            <a
              href={"/"+textContentController.data.slug.toString()}
              aria-expanded={
                cardWithoutNestedBlocks
                  ? textContentController.states.isOpen
                  : textContentController.states.isHeaderOpen
              }
              data-toggle="collapse"
              className={"refheader noselect"+openClass}
              onClick={
                cardWithoutNestedBlocks
                  ? textContentController.functions.toggleOpenClose
                  : textContentController.functions.toggleOpenCloseHeader
              }
              onMouseEnter={() => {
                narrationController.functions.preLoadSupplement(
                  narrationController
                );
                window.getSelection().removeAllRanges();
              }}
            >
              {cardWithoutNestedBlocks ? (
                <>
                  <span className="triangle"><img src={triangle}/></span>
                  {textContentController.data &&
                    textContentController.data.heading}
                  
                </>
              ) : (
                <>
                <span className="triangle"><img src={triangle}/></span>
                  {narrationController?.data &&
                    narrationController?.data?.text?.heading}
                  
                </>
              )}
            </a>
            <TextItemCounters narrationController={narrationController}/>
          </CardHeader>
          <Collapse
            role="tabpanel"
            isOpen={
              cardWithoutNestedBlocks
                ? textContentController.states.isOpen
                : textContentController.states.isHeaderOpen
            }
          >
            <CardBody
              className="content"
              onMouseUp={(e) => handleSelection(e, isQuote)}
            >
              {ImageBubblesContainer}
              {CommentaryBubblesContainer}
              {textContentController.renderedTextContent}
            </CardBody>
          </Collapse>
          <Comments
            isOpen={textContentController.states.isOpen}
            pageController={narrationController.pageController}
            setCommentHighlights={
              narrationController.functions.setCommentHighlights
            }
            linkData={{ text: num }}
            highlights={
              isQuote ? quoteContentHighlights : textContentHighlights
            }
            removeHighlight={removeHighlight}
            isQuote={isQuote}
          />
        </Card>
      </div>
    </Col>
  );
}


function TextItemCounters({narrationController})
{
  let appController = narrationController?.pageController?.appController;
  const {text} = narrationController?.data;
	const {faxData} = narrationController?.states;
  if(!text) return null;

  const {people,places,refs,guid,notes} = text;
  const lang = determineLanguage();

  let peopleCount = people?.length || 0;
  let placeCount = places?.length || 0;
  let refCount = refs?.length || 0;
  let faxCount = faxData?.filter(fax=>!appController?.states?.preferences?.facsimiles?.filter?.versions?.includes(fax.slug))?.length || 0;


  const setPeoplePlaces = () => {
    const {states: {peoplePlaces}, functions: {setPeoplePlaces,clearAllPanels}} = narrationController;
    //clear images and fax
    clearAllPanels();
    setPeoplePlaces((peoplePlaces?.people?.length || peoplePlaces?.places?.length) ? {} : { people, places });
  }

  const setScriptures = () => {
    const {states: {scriptures}, functions: {setScriptures,clearAllPanels}} = narrationController;
    clearAllPanels();
    setScriptures(scriptures?.refs?.length ? { refs:[] } : { refs });
  }

  const setNotes = () => {
    const {data: {text: {notes}}, functions: {setNotes, clearAllPanels}} = narrationController;
    const hasNotes = !!notes?.length;
    clearAllPanels();
    setNotes(hasNotes ? notes : []);
  }

  const setFaxVisible = () => {
    const { functions: {toggleFax,clearAllPanels}} = narrationController;
    clearAllPanels();
    toggleFax();
  }

  const ppLabel = (peopleCount,placeCount) => {
    if(peopleCount>1 && placeCount>1) return label(`x_people_and_x_places`,peopleCount,placeCount);
    if(peopleCount>1 && placeCount===1) return label(`x_people_and_x_place`,peopleCount,placeCount);
    if(peopleCount===1 && placeCount>1) return label(`x_person_and_x_places`,peopleCount,placeCount);
    if(peopleCount===1 && placeCount===1) return label(`x_person_and_x_place`,peopleCount,placeCount);
    if(!placeCount && peopleCount>1) return label(`x_people`,peopleCount);
    if(!placeCount && peopleCount===1) return label(`x_person`,peopleCount);
    if(placeCount && !peopleCount) return label(`x_places`,placeCount);
    return label(`x_place`,placeCount);
  }

  const tooltipId = `text-item-tooltip-${guid}`
  const noteCount = notes?.length || 0;
  return <>
  <ReactTooltip
      effect="solid"
      backgroundColor="#666"
      id={tooltipId}
      getContent={(text) => {
        return (
            <div className={"text_item_tooltip"}>{text}</div>
        )}}
      />
  <div className="text_item_counter noselect">
          
    {!!peopleCount && <span className="item_counter people" 
      data-tip={ ppLabel(peopleCount,placeCount) } data-for={tooltipId} onClick={setPeoplePlaces}>
      <img src={peopleCount ? peopleSVG : placesSVG}/>{peopleCount + placeCount}</span>}

    {!!appController.states.preferences.facsimiles.on && faxCount && <span className="item_counter fax"         onClick={setFaxVisible}
    data-tip={label(`x_facsimiles`,faxCount)} data-for={tooltipId} ><img src={faxSVG}/>{faxCount}</span>}

    {!!refCount && <span className="item_counter refs"        onClick={setScriptures}
    data-tip={refCount===1 ? label(`x_related_scripture`,refCount) : label(`x_related_scriptures`,refCount)}
    data-for={tooltipId}><img src={studySVG}/>{refCount}</span>}

    {!!notes?.length && <span className="item_counter notes"       onClick={setNotes}
    data-tip={label(noteCount===1 ? `x_note` : `x_notes` ,noteCount)} data-for={tooltipId}><img src={notesSVG}/>{notes?.length}</span>}

  </div></>
}

