import React, { useState, useReducer } from "react";
import { Card, CardHeader, CardBody, Collapse, Col } from "reactstrap";
import {
  CommentaryBubbles,
  ImageBubbles,
  FaxBubbleContainer,
} from "./Annotations";
import stringSimilarity from "string-similarity";
import Parser from "html-react-parser";
import "./TextContent.css";
import Comments from "../_Common/Study/Study";
import { snapSelectionToWord } from "src/models/Utils";
import triangle from "./triangle.svg";

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

  let faxBubbleContainer = (
    <FaxBubbleContainer
      textContentController={textContentController}
      isQuote={isQuote}
    />
  );
  let cardWithoutNestedBlocks = true;
  if (Array.isArray(textContentController.renderedTextContent)) {
    for (let item of textContentController.renderedTextContent) {
      if (typeof item.type === "symbol") {
        cardWithoutNestedBlocks = false;
      }
    }
  }

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
          <CardHeader role="tab" className="reference">
            <a
              href={"/"+textContentController.data.slug.toString()}
              aria-expanded={
                cardWithoutNestedBlocks
                  ? textContentController.states.isOpen
                  : textContentController.states.isHeaderOpen
              }
              data-toggle="collapse"
              className={"noselect"+openClass}
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
                  <span className="chrono">
                    {textContentController.data.chrono}
                  </span>
                </>
              ) : (
                <>
                <span className="triangle"><img src={triangle}/></span>
                  {narrationController?.data &&
                    narrationController?.data?.text?.heading}
                  <span className="chrono">
                    {narrationController?.data?.text?.chrono}
                  </span>
                </>
              )}
            </a>
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
              {faxBubbleContainer}
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