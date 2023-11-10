import React, { useState, useEffect, useReducer } from "react";
import { Card, CardHeader, CardBody, Collapse, Col } from "reactstrap";
// CHILD
import TextContent from "./TextContent";
import Comments from "../_Common/Study/Study";
// media Url
import { renderPersonPlaceHTML } from "./PersonPlace";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import "./Narration.css";
import "./TextContent.css";
import { snapSelectionToWord,chronoLabel } from "src/models/Utils";
import { SRLWrapper } from "simple-react-lightbox";
import {  label} from "src/models/Utils";
import fullscreen from "src/views/Page/svg/fullscreen.png";
import Loader from "../_Common/Loader";
const {generateReference} = require('scripture-guide');


function ChronoRow ({chrono}) {

  chrono = chronoLabel(chrono);

  if(!chrono) return null;

  return <div className="row chronoRow"><div className="chronoText">{chrono}</div></div>


}

function reducer(narrationController, input) {
  switch (input.fn) {
    case "toggleOpenClose":
      if (narrationController.states.isOpen)
        narrationController.pageController.functions.removeOpenRow(
          narrationController.data.text.slug
        );
      else
        narrationController.pageController.functions.setActiveRow({
          slug: narrationController.data.text.slug,
          duration: narrationController.data.text.duration,
        });
      narrationController.states.isOpen = !narrationController.states.isOpen;
      break;
    case "setPanelImageIds":
      narrationController.states.panelImageIds = input.val;
      break;
    case "setActiveImageId":
      narrationController.states.activeImageId = input.val;
      let newSlug = "art/" + input.val;
      if (!input.val)
        newSlug = narrationController.pageController.states.activeRow;
      narrationController.appController.functions.setSlug(newSlug);
      break;
    case "setActiveFax":
      narrationController.states.showFax = true;
      narrationController.states.activeFax = input.val;
      narrationController.appController.functions.setSlug(
        narrationController.data.text.slug + "/fax/" + input.val
      );

      break;
    case "toggleFax":
      narrationController.states.showFax = !narrationController.states.showFax;
      if (narrationController.states.showFax) {
        narrationController.appController.functions.setSlug(
          narrationController.data.text.slug +
            "/fax/" +
            narrationController.states.activeFax
        );
      } else {
        narrationController.appController.functions.setSlug(
          narrationController.data.text.slug
        );
        narrationController.functions.setActiveImageId(0);
      }
      break;
    case "preLoadSupplement":
      narrationController.supplement = input.val;
      break;
    case "setTextContent":
      narrationController.components.textContent = input.val;
      break;
    case "setHighlights":
      narrationController.states.highlights = input.val;
      break;
    //add setPeoplePlaceSlugs and setScriptures
    case "setPeoplePlaceSlugs":
      narrationController.states.peoplePlaces = input.val;
      break;
    case "setScriptures":
      narrationController.states.scriptures = input.val;
      break;
    case "clearAllPanels":
        narrationController.states.showFax = false;
        narrationController.states.peoplePlaces = {};
        narrationController.states.scriptures = [];
        narrationController.states.panelImageIds = [];
     break;

    default:
      break;
  }
  return { ...narrationController };
}

function Narration({ rowData, pageController, addHighlight }) {
  const preLoadFax = () => {
    return narrationController.states.faxList.forEach((version) => {
      const img1 = new Image();
      let m = narrationController.data.text.slug.match(/([a-z-]+)\/(\d+)$/);
      img1.src = `${assetUrl}/fax/text/${version}/${m[1]}-${m[2]}`;
      const img2 = new Image();
      img2.src = `${assetUrl}/fax/tabs/${version}`;
    });
  };

  const preLoadSupplement = (narrationController) => {
    if (Object.keys(narrationController.supplement).length > 0) return false;
    if (
      narrationController.data.commentaryIds.length === 0 &&
      narrationController.data.imageIds.length === 0
    )
      return false;
    BoMOnlineAPI({
      commentary: narrationController.data.commentaryIds,
      image: narrationController.data.imageIds,
    }).then((response) => {
      dispatch({ fn: "preLoadSupplement", val: response });
    });
  };

  const setHighlights = (activeId, previewIds, commentHighlights) => {
    const rowImageData = narrationController.supplement.image;
    const rowCommentaryData = narrationController.supplement.commentary;
    var highlights = [];
    if (rowImageData !== undefined) {
      for (let i in rowImageData) {
        if (rowImageData[i].id === activeId) {
          highlights.push({
            class: "primary",
            string: rowImageData[i].title
              .replace(/^[^a-z\d]*|[^a-z\d]*$/gi, "")
              .replace(/[^a-z]+/gi, "([^a-z]|<[^>]*>)+?"),
          });
        } else if (previewIds.includes(rowImageData[i].id)) {
          highlights.push({
            class: "secondary",
            string: rowImageData[i].title
              .replace(/^[^a-z\d]*|[^a-z\d]*$/gi, "")
              .replace(/[^a-z]+/gi, "([^a-z]|<[^>]*>)+?"),
          });
        }
      }
    }
    if (rowCommentaryData !== undefined) {
      for (let i in rowCommentaryData) {
        if (rowCommentaryData[i]?.id === activeId) {
          highlights.push({
            class: "primary",
            string: rowCommentaryData[i]?.title
              .replace(/^[^a-z\d]*|[^a-z\d]*$/gi, "")
              .replace(/[^a-z]+/gi, "([^a-z]|<[^>]*>)+?"),
          });
        } else if (previewIds.includes(rowCommentaryData[i]?.id)) {
          highlights.push({
            class: "secondary",
            string: rowCommentaryData[i]?.title
              .replace(/^[^a-z\d]*|[^a-z\d]*$/gi, "")
              .replace(/[^a-z]+/gi, "([^a-z]|<[^>]*>)+?"),
          });
        }
      }
    }

    if (commentHighlights) {
      for (let i in commentHighlights) {
        highlights.push({ class: "commented", string: commentHighlights[i] });
      }
    }

    dispatch({ fn: "setHighlights", val: highlights });
  };

  const loadNumsFromText = (text) => {
    let nums = [];
    nums.push(parseInt(text.slug.match(/\d+$/)));
    for (let i in text.quotes) {
      let quote = text.quotes[i];
      nums.push(parseInt(quote.slug.match(/\d+$/)));
    }
    return nums;
  };

  const getSupplement = () => {
    return { ...narrationController.supplement };
  };

  // This is the main row Controller
  const [narrationController, dispatch] = useReducer(
    reducer,
    (() => {
      //Set Initial States
      let faxData = pageController.appController.preLoad.fax;
      if (typeof faxData === "object") faxData = Object.values(faxData);

      var states = {
        isOpen: false,
        showFax: false,
        faxList: faxData?.map((i) => i.slug),
        faxData: faxData,
        activeFax: "1830",
        panelImageIds: [],
        activeImageId: 0,
        highlights: [],
      };

      //Define all Row-level functions
      let functions = {
        toggleOpenClose: (e) => {
          e.preventDefault();
          dispatch({ fn: "toggleOpenClose" });
        },
        setPanelImageIds: (ids) => {
          dispatch({ fn: "setPanelImageIds", val: ids });
        },
        setActiveImageId: (id) => {
          dispatch({ fn: "setActiveImageId", val: id });
          setHighlights(id, []);
        },
        setPreviewImageIds: (ids) => {
          setHighlights(narrationController.states.activeImageId, ids);
        },
        setPreviewCommentaryIds: (ids) => {
          setHighlights(null, ids);
        },
        setActiveFax: (id) => {
          dispatch({ fn: "setActiveFax", val: id });
        },
        toggleFax: (id) => {
          dispatch({ fn: "toggleFax", val: id });
        },
        setPeoplePlaces: (slugs) => {
          dispatch({ fn: "setPeoplePlaceSlugs", val: slugs });
        },
        setScriptures: (verse_ids) => {
          dispatch({ fn: "setScriptures", val: verse_ids });
        },
        clearAllPanels: () => {
          dispatch({ fn: "clearAllPanels" });
        },
        preloadFax: preLoadFax,
        preLoadSupplement: preLoadSupplement,
        getSupplement: getSupplement,
        setCommentHighlights: (items) => {
          setHighlights(null, [], items);
        },
      };

      //Create Initial Controller
      var initNarrationController = {
        data: rowData.narration,
        nums: loadNumsFromText(rowData.narration.text),
        states: states,
        supplement: {},
        components: {},
        functions: functions,
        pageController: pageController,
        appController: pageController.appController,
      };

      //Extract Image and Commentary Values
      let imageIds = [];
      imageIds = imageIds.concat(
        initNarrationController.data.text.content.match(/\[i\](\d+)\[\/i\]/gi)
      );
      if (initNarrationController.data.text.quotes)
        imageIds = imageIds.concat(
          initNarrationController.data.text.quotes
            .map((q) => q.content.match(/\[i\](\d+)\[\/i\]/gi))
            .flat()
        );
      imageIds =
        imageIds &&
        imageIds.filter((x) => x !== null).map((i) => i.replace(/\D+/g, ""));
      let commentaryIds = [];
      commentaryIds = commentaryIds.concat(
        initNarrationController.data.text.content.match(/\[c\]((\d+))\[\/c\]/gi)
      );
      if (initNarrationController.data.text.quotes)
        commentaryIds = commentaryIds.concat(
          initNarrationController.data.text.quotes
            .map((q) => q.content.match(/\[c\]((\d+))\[\/c\]/gi))
            .flat()
        );
      commentaryIds =
        commentaryIds &&
        commentaryIds
          .filter((x) => x !== null)
          .map((i) => i.replace(/\D+/g, ""));
      initNarrationController.data.imageIds =
        imageIds && imageIds.length ? imageIds : [];
      initNarrationController.data.commentaryIds =
        commentaryIds && commentaryIds.length ? commentaryIds : [];
      let personIds =
        initNarrationController.data.description.match(/\|([^\]}]+?)}/g);
      let placeIds =
        initNarrationController.data.description.match(/\|([^\]}]+?)\]/g);
      initNarrationController.data.personIds =
        personIds && personIds.length
          ? personIds.map((i) => i.replace(/[|}]/g, ""))
          : [];
      initNarrationController.data.placeIds =
        placeIds && placeIds.length
          ? placeIds.map((i) => i.replace(/[|\]]/g, ""))
          : [];
      //Render React Components from plain text
      initNarrationController.components.description = renderPersonPlaceHTML(
        initNarrationController.data.description,
        pageController
      );
      //Return the Row Controller
      return initNarrationController;
    })()
  );

  narrationController.pageController = pageController;
  const handleSelection = () => {
    snapSelectionToWord();
    let selection = window.getSelection().toString();
    addHighlight(selection);
  };

  const handleLocationChange = () => {
    if (!pageController.appController.states.studyGroup.studyModeOn)
      return null;
    if (!pageController.appController.states.user.user) return null;
    let username = pageController.appController.states.user.social?.user_id;
    let location = narrationController.data.text.slug.match(/\d+$/)[0];
    let pageSlug = pageController.pageData.slug;
    let channel = pageController.appController.states.studyGroup.activeGroup;

    pageController.appController.sendbird?.updatePagePosition({
      channel,
      pageSlug,
      location,
      username,
    });
  };

  let active_items = pageController.states.progress?.active_items;
  let completed_items = pageController.states.progress?.completed_items;
  let started_items = pageController.states.progress?.started_items;
  let link_index = parseInt(
    narrationController?.data?.text?.slug?.match(/\d+$/)[0]
  );
  let progress = started_items?.includes(link_index)
    ? "started"
    : active_items?.includes(link_index)
    ? "active"
    : completed_items?.includes(link_index)
    ? "completed"
    : "not_started";
  if (!pageController?.states?.progress?.count) progress = "unknown";



  return (
    <div className="card-body">
      {/* CONTENT ROW */}
      <ChronoRow chrono={narrationController.data.text.chrono} />
      <div className="row" onMouseEnter={handleLocationChange}>
        <div className="col-sm-6 narration">
          <p onMouseUp={handleSelection} className={progress}>
            {narrationController.components.description}
          </p>
          <ImagePanel narrationController={narrationController} />
          <FacsimilePanel narrationController={narrationController} />
          <PeoplePlacePanel narrationController={narrationController} />
          <ScripturePanel narrationController={narrationController} />
        </div>
        <TextContent
          content={narrationController.data.text}
          narrationController={narrationController}
        />
      </div>
    </div>
  );
}

export default Narration;

function idsWithComments(type, narrationController) {
  let idsWithComments = [];
  let pageController = narrationController.pageController;
  if (pageController.pageCommentCounts) {
    for (let i in narrationController.nums) {
      let num = narrationController.nums[i];
      let narrationComments = pageController.pageCommentCounts?.[num] || {};
      if (narrationComments && narrationComments[type]) {
        idsWithComments = idsWithComments.concat(narrationComments[type]);
      }
    }
  }
  return idsWithComments;
}

function LightBox({ narrationController, setOpenLightBox,imgClicker }) {
  const activeImageId = narrationController.states.activeImageId;
  const activeImg = document.querySelector(`.img-${activeImageId}`);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
        imgClicker.click();
    if (activeImg && !isOpen) {
        setTimeout(()=>{
        activeImg.click();
        },[100]);
    }
  }, [activeImageId, activeImg]);

  if (!activeImageId) return null;

  if (narrationController.supplement.image === undefined) {
    narrationController.functions.preLoadSupplement(narrationController);
    return null;
  }

  const options = {
    buttons: {
      showNextButton:
        narrationController.states.panelImageIds.length > 1 ? true : false,
      showPrevButton:
        narrationController.states.panelImageIds.length > 1 ? true : false,
    },
  };

  const callbacks = {
    onSlideChange: ({ slides }) => {
      const regexp = /-?\d+(\.\d+)?/g;
      const id = slides.current.source.match(regexp);
      narrationController.functions.setActiveImageId(id);
    },
    onLightboxOpened: () => {
      setIsOpen(true);
    },
    onLightboxClosed: () => {
      setIsOpen(false);
      setOpenLightBox(false);
    },
  };

  let panelImages = null;

  if (narrationController.states.panelImageIds.length > 1) {
    panelImages = narrationController.states.panelImageIds.map((id) => {
      const caption = narrationController.supplement.image?.[id]?.title || "Artwork";
      return (
        <img
          className={`img-${id}`}
          src={assetUrl + "/art/" + id}
          alt={caption}
        />
      );
    });
  }

  const caption = narrationController.supplement.image?.[activeImageId]?.title || "Artwork";

  return (
    <SRLWrapper options={options} callbacks={callbacks}>
      <div className="lightbox-wrapper" style={{ display: "none" }}>
        {panelImages === null && (
          <img
            className={`img-${activeImageId}`}
            src={`${assetUrl}/art/` + activeImageId}
            alt={caption}
          />
        )}
        {panelImages}
      </div>
    </SRLWrapper>
  );
}

function ImagePanel({ narrationController }) {
  const [openLightBox, setOpenLightBox] = useState(false);
  const [marginTop, setMarginTop] = useState(0);
  useEffect(() => {
    if (
      !document.getElementsByClassName(
        "ii" + narrationController.states.activeImageId
      )[0]
    )
      return false;
    let distanceOffScreen =
      marginTop -
      document
        .getElementsByClassName(
          "ii" + narrationController.states.activeImageId
        )[0]
        .getBoundingClientRect().y;
    if (distanceOffScreen > 0) {
      setMarginTop(distanceOffScreen + 100);
    } else {
      setMarginTop(0);
    }
    
    const activeId = narrationController.states.activeImageId;
    const caption = narrationController.supplement.image?.[activeId]?.title || "Artwork";
    if(caption) document.title = "Art: " + caption + " | " + label("home_title");

  }, [marginTop, narrationController.states.activeImageId]);

  if (narrationController.states.showFax) return null;
  let imgsWithComments = idsWithComments("img", narrationController);
  var tabs = null;

  if (narrationController.states.panelImageIds.length > 1) {
    tabs = (
      <div className="thumb_tabs">
        <ul>
          {narrationController.states.panelImageIds?.map((id) => {
            let commentIcon =
              imgsWithComments.indexOf(parseInt(id)) < 0 ? null : (
                <span className="comment">💬</span>
              );
            return (
              <li
                key={id + "ix"}
                className={
                  id === narrationController.states.activeImageId
                    ? "active"
                    : ""
                }
                onClick={() =>{
                  narrationController.functions.setActiveImageId(id);
                  }
                }
              >
                <img src={assetUrl + "/art/" + id} alt="art" />
                {commentIcon}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const close = function close() {
    narrationController.functions.setPanelImageIds([]);
    narrationController.functions.setActiveImageId(false);
  };

  if (narrationController.states.panelImageIds.length === 0) return null;

  let title = "Loading...";
  let artist = "Loading...";
  let link = "#";
  let img = null;
  if (narrationController.supplement.image !== undefined) {
    for (let i in narrationController.supplement.image) {
      if (
        narrationController.supplement.image[i].id ===
        narrationController.states.activeImageId
      ) {
        img = narrationController.supplement.image[i];
        title = img.title;
        artist = img.artist;
        link = img.link;
        break;
      }
    }
  } else {
    //Load Supplement explicity
    narrationController.functions.preLoadSupplement(narrationController);
  }
  const imgClicker = document.querySelector('.fullscreen-image');
  return (
    <div
      className={"images ii" + narrationController.states.activeImageId}
      style={{ marginTop: marginTop + "px" }}
    >
      {tabs}
      <div className="heading">
        <span className="close" onClick={() => close()}>
          ×
        </span>
        {title}
      </div>
      <div className="imgWCredit">
        <img
          title="Open Fullscreen"
          src={fullscreen}
          alt="fullscreen"
          className="fullscreen-image"
          onClick={() => {
            setOpenLightBox(true);
          }}
        />
        <img
          className={"panel i" + narrationController.states.activeImageId}
          src={`${assetUrl}/art/` + narrationController.states.activeImageId}
          alt={"art" + narrationController.states.activeImageId}
        />
        <a className="credit" href={link} target="_blank" rel="noreferrer">
          © {artist}
        </a>
      </div>
      <Comments
        pageController={narrationController.pageController}
        linkData={{ img: narrationController.states.activeImageId }}
      />
      {openLightBox && (
        <LightBox
          narrationController={narrationController}
          setOpenLightBox={setOpenLightBox}
          imgClicker={imgClicker}
        />
      )}
    </div>
  );
}

function PeoplePlacePanel({ narrationController }) {
  const states = narrationController.states;
  const peoplePlaces = states.peoplePlaces || {};

  const people = peoplePlaces?.people?.map((person)=> {
    return { ...person, type: "people" };
  }) || [];
  const places = peoplePlaces?.places?.map((place)=> {
    return { ... place, type: "places" };
  }) || [];
  const items = [...people, ...places];

  const popUpPerson = (slug,type) => {
    ///    appController.functions.setPopUp({ type: "places", ids: [id], popUpData: pageController.preLoad?.peoplePlaces?.place });

    narrationController.appController.functions.setPopUp({
      type: type,
      ids: [slug],
      popUpData: narrationController.appController.preLoad?.peoplePlaces?.[type==="people"?"people":"place"],
    });
  }

  const closePanel = () => {
    narrationController.functions.setPeoplePlaces({});
  }

  useEffect(() => {
    //Preload People and Places

  }, [narrationController.states.peoplePlaces]);

  if(items.length === 0) return null;

  const replaceNumbers = (str) => {
    return str.replace(/[1-4]/g, function(match) {
      const superscripts = { '1': '¹', '2': '²', '3': '³', '4': '⁴' };
      return superscripts[match];
    });
  }

  const peopleCount = people.length;
  const placesCount = places.length;

  return (
    <div className="peoplePlacePanelWrapper">
      <h5>{placesCount  && peopleCount ? label("people_places") : placesCount ? label("menu_places") : label("menu_people")}
        <span onClick={closePanel}> × </span>
      </h5>
    <div className="peoplePlacePanel">
      
      {items.map((item)=> {
        return <div key={item.name} className="item" onClick={()=>popUpPerson(item.slug,item.type)}>

          <div className="name">
            {item.name.replace(/[1-4]/g, replaceNumbers)}
          </div>
          <img src={`${assetUrl}/${item.type}/${item.slug}`} alt={item.name} />
          <div className="info">{(item.title || item.info).replace(/[1-4]/g, replaceNumbers)}</div>
          
            </div>;
      })}
    </div>
    </div>
  );
}

function ScripturePanel({ narrationController }) {

  const states = narrationController.states;
  const {refs} = states?.scriptures || {refs:[]};

  const closePanel = () => {
    narrationController.functions.setScriptures(null);
  }

  const [textRefs, setTextRefs] = useState([]);
  const [activeRef, setActiveRef] = useState(null);

  useEffect(() => {
    if(!refs?.length) return false;
    const textRefs = refs.map(({verse_id})=> ({ref:generateReference(verse_id),verse_id}));
    setTextRefs(textRefs);
  }, [refs]);


  useEffect(() => {
    const handleKeyDown = (event) => {
      const length = textRefs.length;
      const gridEl = document.querySelector(".scripturePanel");
      const singleW = gridEl?.childNodes[0].clientWidth || null;
      const colCount = singleW ? Math.floor(gridEl.clientWidth / singleW) : 1;
      const rightIndex = activeRef < length - 1 ? activeRef + 1 : 0;
      const leftIndex = activeRef > 0 ? activeRef - 1 : length - 1;
      const downIndex = activeRef + colCount < length ? activeRef + colCount : activeRef;
      const upIndex = activeRef - colCount >= 0 ? activeRef - colCount : activeRef;

      switch (event.key) {
        case 'ArrowRight':
        case 'Tab':
          setActiveRef(rightIndex);
          event.preventDefault();
          break;
        case 'ArrowLeft':
          setActiveRef(leftIndex);
          event.preventDefault();
          break;
        case 'ArrowDown':
          setActiveRef(downIndex);
          event.preventDefault();
          break;
        case 'ArrowUp':
          setActiveRef(upIndex);
          event.preventDefault();
          break;
        case 'Escape':
          closePanel();
          event.preventDefault();
          break;
        default:
          break;
      }
    };
  
    window.addEventListener('keydown', handleKeyDown);
  
    // Cleanup: remove the event listener when the component is unmounted
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeRef]); // Re-run the effect when activeRef changes

  if(!refs?.length) return null;
  return <div className="scripturePanelWrapper">
  <h5 className="noselect">{label("related_scriptures")}
    <span onClick={closePanel}> × </span>
  </h5>
    <div className="scripturePanel noselect">
      {textRefs.map(({ref},i)=> {
        return <div key={ref} className={"scriptureItem" + (activeRef===i?" active":"")} onClick={()=>setActiveRef(i)}>
          <div className="ref">{ref}</div>
          <div>
        </div>
        </div>
      })}
    </div>
    <ScripturePanelSingle narrationController={narrationController} scriptureData={textRefs[activeRef]}/>
  </div>
}

function ScripturePanelSingle({ narrationController,scriptureData }) {

  const {ref} = scriptureData || {ref:null,verse_id:null};
  const [text, setText] = useState(null);


  useEffect(() => {
    if(!ref) return false;
    let timer = setTimeout(()=> {
      setText(null);
    },200);
    BoMOnlineAPI({scripture:ref}).then(({scripture})=> {
      clearTimeout(timer);
      setText(scripture[ref]?.verses?.map(i=>i.text).join(" "));
    })

  }, [ref]);


  if(!ref) return null;

  return <div className="scripturePanelSingle">
    <h5>{ref}</h5>
   {text ? <div className="text">{text}</div> : <Loader/>}
  </div>

}

function FacsimilePanel({ narrationController }) {
  const [imgHW, setHW] = useState({ h: 0, w: 0 });
  const [position, setPosition] = useState("center center");
  useEffect(() => {
    // if (narrationController.states.isOpen) debugger;
    let initOpenVersion =
      narrationController.pageController.states.initOpen.faxVersion;
    let fromURL =
      narrationController.pageController.states.route.params.pageSlug +
      "/" +
      narrationController.pageController.states.route.params.textId;
    if (narrationController.data.text.slug !== fromURL) return false;
    if (
      narrationController.states.faxList?.includes(initOpenVersion)
      //&& !narrationController.pageController.states.init
    ) {
      narrationController.functions.setActiveFax(initOpenVersion);
      //narrationController.pageController.functions.markAsInitiated()
    }


  }, [narrationController.states]);


  useEffect(() => {

    const version = narrationController.states.activeFax;
    document.title = "Facsimile: " + version + "—" + narrationController.data.text.heading + " | " + label("home_title");

  }, [narrationController.states.activeFax]);

  let appController = narrationController.appController;
  let ref = narrationController.data.text.heading;
  let slug = narrationController.data.text.slug;
  let faxWithComments = idsWithComments("fax", narrationController);
  var tabs = (
    <div className="thumb_tabs">
      <ul>
        {narrationController.states.faxData?.map((item) => {
          let id = item.slug;
          if (
            appController.states.preferences.facsimiles.filter.versions.includes(
              id
            )
          )
            return null;

          let commentIcon =
            faxWithComments.indexOf(id) < 0 ? null : (
              <span className="comment">💬</span>
            );
          return (
            <li
              key={id + "ix"}
              className={
                id === narrationController.states.activeFax ? "active" : ""
              }
              onClick={() => narrationController.functions.setActiveFax(id)}
            >
              {commentIcon}
              <img src={`${assetUrl}/fax/tabs/${id}`} alt="covers" />
            </li>
          );
        })}
      </ul>
    </div>
  );

  const close = function close() {
    narrationController.functions.toggleFax();
  };

  if (!narrationController.states.showFax) return null;

  let activeFaxItem = appController.preLoad.fax?.filter((i) => i.slug === narrationController.states.activeFax)
    .shift();
  let versionName = activeFaxItem?.title;



  let title = versionName + "—" + narrationController.data.text.heading;

  const magnify = ({ nativeEvent: e, target: div }) => {
    if (imgHW.h === 0) return false;
    let margin = 0;
    let mousePos = { x: e.offsetX - margin, y: e.offsetY - margin };
    let boxSize = { w: div.offsetWidth + margin, h: div.offsetHeight + margin };

    let x = -(mousePos.x / boxSize.w) * (imgHW.w - boxSize.w);
    let y = -(mousePos.y / boxSize.h) * (imgHW.h - boxSize.h);
    setPosition(x + "px " + y + "px");
  };
  const resetMag = () => {
    setPosition("center center");
  };

  let m = slug.match(/([a-z-]+)\/(\d+)$/);
  let imgUrl = `${assetUrl}/fax/text/${narrationController.states.activeFax}/${m[1]}-${m[2]}`;

  let style = {
    backgroundPosition: position,
    backgroundImage: "url('" + imgUrl + "')",
  };

  const onImgLoad = ({ target: img }) => {
    setHW({ h: img.naturalHeight, w: img.naturalWidth });
  };
  let num = narrationController.nums[0];

  if(!imgUrl) return null;

  return (
    <div className="images faxbox" key={narrationController.states.activeFax}>
      {tabs}
      <div className="heading">
        <span className="close" onClick={() => close()}>
          ×
        </span>
        {title}
      </div>
      <img src={imgUrl} className="imgRef" alt="imgRef" onLoad={onImgLoad} />
      <div
        className={
          "panel fax" +
          narrationController.nums[0] +
          "_" +
          narrationController.states.activeFax
        }
        onMouseEnter={magnify}
        onMouseMove={magnify}
        onMouseLeave={resetMag}
        key={narrationController.states.activeFax + "/" + ref}
        style={style}
        alt="fax"
      ></div>
      <Comments
        pageController={narrationController.pageController}
        linkData={{ fax: num + "." + narrationController.states.activeFax }}
      />
    </div>
  );
  // }
}

