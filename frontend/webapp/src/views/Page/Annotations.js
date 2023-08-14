import React, { useCallback, useEffect, useRef, useState } from "react";

import ReactTooltip from "react-tooltip";
import crypto from "crypto-browserify";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import oldbook from "src/views/User/svg/oldbook.svg";
import { history } from "src/models/routeHistory";

export function FaxBubbleContainer({ textContentController, isQuote }) {
  const [faxVisible, setFaxVisible] = useState(false);
  const [tooltip_id] = useState( crypto.randomBytes(20).toString("hex"));
  useEffect(() => {
    if (!textContentController.states.isOpen) setFaxVisible(false);
    else
      setTimeout(() => setFaxVisible(textContentController.states.isOpen), 500);
  }, [textContentController.states.isOpen]);
  if (isQuote) return null;

  let counts =
    textContentController.narrationController.pageController.pageCommentCounts;
  let num = textContentController.data.slug.replace(/\D+/, "");

  let commentIcon = null;
  if (
    counts &&
    num &&
    counts[num] &&
    counts[num].fax &&
    textContentController.narrationController.appController.states.studyGroup
      .studyModeOn
  ) {
    commentIcon = <span className="comment">💬</span>;
  }

  if(!textContentController.narrationController.appController.states.preferences.facsimiles.on) return null;

  return (
    <>
      <div
        data-tip={label("facsimiles_of_x",[textContentController.data.heading]) }
        data-for={tooltip_id}
        onMouseEnter={
          textContentController.narrationController.functions.preloadFax
        }
        onClick={textContentController.narrationController.functions.toggleFax}
        className={"fax " + (faxVisible ? "visible" : "")}
      >
        <img src={oldbook}/>{commentIcon}
      </div>

      <ReactTooltip id={tooltip_id} effect="solid" />
    </>
  );
}

export function CommentaryBubbles({ textContentController }) {
  if(!textContentController.pageController.appController.states.preferences.commentary.on) return null;
  let narrationController = textContentController.narrationController;
  let blacklist = narrationController.appController.states.preferences.commentary.filter.sources.map(id=>id.toString().padStart(3,0));

  let paddingTop = 30;
  const gatherCommentary = () => {
    var items = [];
    var anchor_items = document.querySelectorAll(  `[textid="${narrationController.data.text.slug}"]  a.c` );
    var container_y = document .querySelector(`[textid="${narrationController.data.text.slug}"] .content`) ?.getBoundingClientRect().top;
    var cursor = 0;
    var groups = {};
    for (var i in anchor_items) {
      var anchor = anchor_items[i];
      if (anchor.className !== "c") continue;
      let id = anchor.attributes.contentid.value;
      var source = id.substring(5, 8);
      if(blacklist.includes(source)) continue;
      let y = anchor?.getBoundingClientRect().top;
      if (y === 0 || !y) continue;
      y = paddingTop + y - container_y;

      if (y - cursor > paddingTop) cursor = y;

      if (groups[cursor] === undefined)
        groups[cursor] = { y: cursor + "px", count: 0, ids: [] };
      groups[cursor].count++;
      groups[cursor].ids.push(id);
    }
    for (var g in groups) items.push(groups[g]);
    return items;
  };

  var items = gatherCommentary();
  return items.map((item, i) => {
    return (
      <CommentaryBubble
        key={"bubble" + item.id + i.toString()}
        item={item}
        narrationController={narrationController}
        textContentController={textContentController}
      />
    );
  });
}

function CommentaryBubble({
  narrationController,
  textContentController,
  item,
}) {
  let counts = narrationController.pageController.pageCommentCounts;
  let num = textContentController.data.slug.replace(/\D+/, "");
  let studycommentcount = 0;
  let coms_with_comments = [];
  if (
    counts &&
    num &&
    counts[num] &&
    item.ids &&
    counts[num].com &&
    narrationController.appController.states.studyGroup.studyModeOn
  ) {
    coms_with_comments = counts[num].com;
    studycommentcount = item.ids
      .map((i) => parseInt(i))
      .filter((i) => coms_with_comments.includes(i)).length;
  }

  const [fadeClass, makeFadeIn] = useState("");
  const [isHover, setHover] = useState(false);

  useEffect(() => {
    setTimeout(() => makeFadeIn(" fadedIn"), 500);
  });

  const handleMouserEnter = () => {
    setHover(true);
    narrationController.functions.setPreviewCommentaryIds(item.ids);
  };
  const handleMouseLeave = () => {
    setHover(false);
    narrationController.functions.setPreviewCommentaryIds([]);
  };
  const handleClick = () => {
    setHover(false);
    let popUpData = narrationController.functions.getSupplement().commentary;
    narrationController.appController.functions.setPopUp({
      type: "commentary",
      ids: item.ids,
      popUpData: popUpData,
    });
  };

  var booksToolTip = <div className="tooltip_books invisible"></div>;
  var source_imgs = item.ids.map((id, i) => {
    let commentsIcon =
      coms_with_comments.indexOf(parseInt(id)) >= 0 ? (
        <span className={"comcom"}>💬</span>
      ) : null;
    var source = id.substring(5, 8);
    return (
      <div className="coverPreviewDiv" key={"prev" + source + i.toString()}>
        {commentsIcon}
        <img src={`${assetUrl}/source/cover/` + source} alt="Commentary" />
      </div>
    );
  });
  let commentsIcon = null;
  if (studycommentcount > 0)
    commentsIcon = <span className={"comcom"}>💬</span>;
  if (isHover)
    booksToolTip = (
      <div
        onClick={handleClick}
        onMouseEnter={handleMouserEnter}
        onMouseLeave={handleMouseLeave}
        className={
          "tooltip_books visible count" + source_imgs.length.toString()
        }
        style={{ top: item.y }}
      >
        <div className={"com_heading "}>
          {source_imgs.length} {source_imgs.length === 1 ? label("commentary_singular") : label("commentary_plural")}
        </div>
        {source_imgs}
      </div>
    );
  return (
    <>
      {booksToolTip}

      <span
        onClick={handleClick}
        onMouseEnter={handleMouserEnter}
        onMouseLeave={handleMouseLeave}
        className={"annotation" + fadeClass}
        style={{ top: item.y }}
      >
        {item.count}
        {commentsIcon}
      </span>
    </>
  );
}

export function gatherImages(slug) {
  let paddingTop = 30;
  let height = 25;
  var items = [];
  var anchor_items = document.querySelectorAll(`[textid="${slug}"] a.i`);
  var container_y = document.querySelector(`[textid="${slug}"] .content`)?.getBoundingClientRect().top;

  var cursor = 0;
  var groups = {};
  for (var i in anchor_items) {
    var anchor = anchor_items[i];
    if (anchor.className !== "i") continue;
    let id = anchor.attributes.contentid.value;
    let y = anchor?.getBoundingClientRect().top;
    if (y === 0 || !y) continue;
    y = paddingTop + y - container_y;

    if (y - cursor > height) cursor = y;

    if (groups[cursor] === undefined)
      groups[cursor] = {
        y: cursor + "px",
        count: 0,
        ids: [],
      };

    groups[cursor].count++;
    groups[cursor].ids.push(id);
  }
  for (var g in groups) items.push(groups[g]);
  return items;
}

export function ImageBubbles({ textContentController }) {
  if(!textContentController.pageController.appController.states.preferences.art) return null;


  let narrationController = textContentController.narrationController;

  var items = gatherImages(narrationController.data.text.slug) || [];

  return items.map((item) => {
    return (
      <ImageBubble
        key={item.ids[0] + "-img"}
        item={item}
        narrationController={narrationController}
        textContentController={textContentController}
      />
    );
  });
}

function ImageBubble({ narrationController, textContentController, item }) {
  let counts = narrationController.pageController.pageCommentCounts;
  let num = textContentController.data.slug.replace(/\D+/, "");
  let studycommentcount = 0;
  if (
    counts &&
    num &&
    counts[num] &&
    item.ids &&
    counts[num].img &&
    narrationController.appController.states.studyGroup.studyModeOn
  ) {
    let imgs_with_comments = counts[num].img;
    studycommentcount = item.ids
      .map((i) => parseInt(i))
      .filter((i) => imgs_with_comments.includes(i)).length;
  }

  const [fadeClass, makeFadeIn] = useState("");
  const [cycleIndex, setCycleIndex] = useState(0);
  const [autoCyle, setAutoCyle] = useState(true);
  let cycleTimer = useRef(null);

  useEffect(() => {
    
    if (fadeClass !== " fadedIn") setTimeout(() => makeFadeIn(" fadedIn"), 500);
    let urlOpenImageId =
      narrationController.pageController.states.initOpen.imageId;
    if (
      urlOpenImageId &&
      item.ids.indexOf(urlOpenImageId) >= 0 &&
      !narrationController.pageController.states.loading &&
      !narrationController.states.activeImageId
    ) {
      narrationController.functions.setActiveImageId(urlOpenImageId);
      narrationController.functions.setPanelImageIds(item.ids);
      history.push(`/art/${urlOpenImageId}`)
      setAutoCyle(false);
    }
  }, [
    fadeClass,
    item.ids,
    narrationController.functions,
    narrationController.pageController.states.initOpen.imageId,
    narrationController.pageController.states.loading
  ]);

  const cycleImage = useCallback(() => {
    if (item.ids.includes(narrationController.states.activeImageId))
      return false;
    let newVal = cycleIndex + 1;
    if (newVal > item.ids.length - 1) newVal = 0;
    setCycleIndex(newVal);
    clearTimeout(cycleTimer.current);
    cycleTimer.current = null;
  }, [cycleIndex, item.ids, narrationController.states.activeImageId]);

  useEffect(() => {
    if (item.ids.length > 1 && autoCyle)
      cycleTimer.current = setTimeout(
        () => cycleImage(),
        5000 + 5000 * Math.random()
      );
  }, [autoCyle, cycleImage, cycleIndex, item.ids.length]);

  let activeIndex = item.ids.indexOf(narrationController.states.activeImageId);
  if (activeIndex >= 0 && cycleIndex !== activeIndex)
    setCycleIndex(activeIndex);
  var activeClass =
    narrationController.states.activeImageId === item.ids[cycleIndex]
      ? " active"
      : "";

  const handleMouserEnter = () => {
    narrationController.functions.setPreviewImageIds(item.ids);
  };
  const handleMouserLeave = () => {
    narrationController.functions.setPreviewImageIds([]);
  };

  const handleClick = () => {
    var list = item.ids;
    let shouldCycle = false;
    if (narrationController.states.showFax)
      narrationController.functions.toggleFax();
    if (
      narrationController.states.panelImageIds.includes(item.ids[cycleIndex])
    ) {
      let index =
        1 + item.ids.indexOf(narrationController.states.activeImageId);
      if (!item.ids[index]) {
        index = 0;
        narrationController.functions.setPanelImageIds([]);
        narrationController.functions.setActiveImageId(false);
        shouldCycle = true;
      } else {
        narrationController.functions.setActiveImageId(item.ids[index]);
      }
      setCycleIndex(index);
    } else {
      //open and load
      narrationController.functions.setActiveImageId(list[cycleIndex]);
      narrationController.functions.setPanelImageIds(list);
    }
    setAutoCyle(shouldCycle);
  };

  let commentsIcon = null;
  if (studycommentcount > 0)
    commentsIcon = (
      <span
        onClick={handleClick}
        onMouseEnter={handleMouserEnter}
        onMouseLeave={handleMouserLeave}
        className={"imgcom" + activeClass + fadeClass}
        style={{ top: item.y }}
      >
        💬
      </span>
    );

  var url = `${assetUrl}/art/` + item.ids[cycleIndex];
  return (
    <>
      {commentsIcon}
      <span
        onClick={handleClick}
        onMouseEnter={handleMouserEnter}
        onMouseLeave={handleMouserLeave}
        className={"art_bubble" + activeClass + fadeClass}
        style={{ top: item.y }}
      >
        <img src={url} alt={"A"} />
      </span>
    </>
  );
}
