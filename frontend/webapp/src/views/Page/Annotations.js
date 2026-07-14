import React, { useCallback, useEffect, useRef, useState } from "react";

import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { history } from "src/models/routeHistory";
import { useNarration } from "src/contexts/NarrationContext";
import { useTextContent } from "src/contexts/TextContentContext";

// Study-mode 💬 badge inputs shared by both bubble kinds.
function countStudyComments({ counts, num, ids, type, studyModeOn }) {
  if (!studyModeOn || !counts || !num || !counts[num]?.[type] || !ids)
    return { count: 0, idsWith: [] };
  const idsWith = counts[num][type];
  return {
    count: ids.map((i) => parseInt(i)).filter((i) => idsWith.includes(i)).length,
    idsWith,
  };
}

function useFadeIn(delayMs = 500) {
  const [fadeClass, setFadeClass] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFadeClass(" fadedIn"), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return fadeClass;
}

export function CommentaryBubbles() {
  const textContentController = useTextContent();
  if(!textContentController.pageController.appController.states.preferences.commentary.on) return null;
  let narrationController = textContentController.narrationController;
  let blacklist = narrationController.appController.states.preferences.commentary.filter.sources.map(id=>id.toString().padStart(3,0));

  const items = gatherAnchorGroups(
    narrationController.data.text.slug,
    "c",
    30,
    (id) => !blacklist.includes(id.substring(5, 8))
  );
  return items.map((item, i) => {
    return (
      <CommentaryBubble
        key={"bubble" + item.id + i.toString()}
        item={item}
      />
    );
  });
}

function CommentaryBubble({
  item,
}) {
  const textContentController = useTextContent();
  const narrationController = useNarration();
  const { count: studycommentcount, idsWith: coms_with_comments } =
    countStudyComments({
      counts: narrationController.pageController.pageCommentCounts,
      num: textContentController.data.slug.replace(/\D+/, ""),
      ids: item.ids,
      type: "com",
      studyModeOn:
        narrationController.appController.states.studyGroup.studyModeOn,
    });
  const fadeClass = useFadeIn();
  const [isHover, setHover] = useState(false);

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

// Groups inline anchors (a.c commentary refs / a.i art refs) into vertically
// clustered bubbles. `spacing` is the min px gap before a new cluster starts;
// `keepId` filters ids out BEFORE grouping (blacklisted commentary sources
// must not affect cluster positions).
function gatherAnchorGroups(slug, anchorClass, spacing, keepId = () => true) {
  const paddingTop = 30;
  const container_y = document
    .querySelector(`[textid="${slug}"] .content`)
    ?.getBoundingClientRect().top;
  const anchors = document.querySelectorAll(`[textid="${slug}"] a.${anchorClass}`);
  let cursor = 0;
  const groups = {};
  for (const anchor of anchors) {
    if (anchor.className !== anchorClass) continue;
    const id = anchor.attributes.contentid.value;
    if (!keepId(id)) continue;
    let y = anchor.getBoundingClientRect().top;
    if (!y) continue;
    y = paddingTop + y - container_y;
    if (y - cursor > spacing) cursor = y;
    if (!groups[cursor]) groups[cursor] = { y: cursor + "px", count: 0, ids: [] };
    groups[cursor].count++;
    groups[cursor].ids.push(id);
  }
  return Object.values(groups);
}

export function ImageBubbles() {
  const textContentController = useTextContent();
  if(!textContentController.pageController.appController.states.preferences.art) return null;


  let narrationController = textContentController.narrationController;

  const items = gatherAnchorGroups(narrationController.data.text.slug, "i", 25);

  return items.map((item) => {
    return (
      <ImageBubble
        key={item.ids[0] + "-img"}
        item={item}
      />
    );
  });
}

function ImageBubble({ item }) {
  const textContentController = useTextContent();
  const narrationController = useNarration();
  const { count: studycommentcount } = countStudyComments({
    counts: narrationController.pageController.pageCommentCounts,
    num: textContentController.data.slug.replace(/\D+/, ""),
    ids: item.ids,
    type: "img",
    studyModeOn:
      narrationController.appController.states.studyGroup.studyModeOn,
  });
  const fadeClass = useFadeIn();
  const [cycleIndex, setCycleIndex] = useState(0);
  const [autoCyle, setAutoCyle] = useState(true);
  let cycleTimer = useRef(null);

  useEffect(() => {
    const req = narrationController.pageController.appController.states.imageActivationRequest;
    const urlOpenImageId = req?.imageId;
    if (
      urlOpenImageId &&
      item.ids.indexOf(urlOpenImageId) >= 0 &&
      !narrationController.states.activeImageId
    ) {
      narrationController.functions.setActiveImageId(urlOpenImageId);
      narrationController.functions.setPanelImageIds(item.ids);
      history.push(`/art/${urlOpenImageId}`);
      setAutoCyle(false);
      // Clear the request so re-renders don't repeat
      narrationController.pageController.appController.functions.requestImageActivation(null);
    }
  }, [
    item.ids,
    narrationController.functions,
    narrationController.pageController.appController.states.imageActivationRequest,
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
