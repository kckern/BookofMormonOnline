import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import Parser from "html-react-parser";
import Loader from "../_Common/Loader";
import { useRouteMatch, useHistory, Link } from "react-router-dom";
import { label } from "src/models/Utils";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { toast } from "react-toastify";
import "./Theater.css";
import {Alert} from "reactstrap";
import ReactAudioPlayer from "react-audio-player";
import canAutoplay from 'can-autoplay';
import ReactTooltip from "react-tooltip";
import nowifi from "src/views/_Common/svg/no-wifi.svg";
import logo from "src/views/_Common/svg/logo.svg";
import menu from "src/views/User/svg/settings.svg";
import mute from "./svg/mute.svg";
import studyimg from "src/views/_Common/svg/study.svg";
import next from "./svg/next.svg";
import pause from "./svg/pause.svg";
import play from "./svg/play.svg";
import prev from "./svg/prev.svg";
import crossroads from "./svg/crossroads.svg";
import detour from "./svg/detour.svg";
import again from "./svg/again.svg";
import Switch from "react-bootstrap-switch";


import { determineLanguage, flattenDescription, playSound } from "../../models/Utils";


const {lookup} = require('scripture-guide');
const loadQueueItemsFromQueue = items => {
  const pages = {};
  for (let item of items) {
    const { slug } = item;
    const [number, slugEnd] = slug.split("/").reverse();
    pages[slugEnd] = pages[slugEnd] || [];
    pages[slugEnd].push(parseInt(number));
  }
  const keys = Object.keys(pages);
  const output = keys.map(key => {
    return {
      slug: key,
      blocks: pages[key]
    };
  });
  return output;
};

const playAudioElement = (id) => {

  const player = document.getElementById(id);
  if(!player) return;
  try{
    player.play();
  }
  catch(e){
    console.log(e);
  }

}

function TheaterWrapper({ appController }) {

  let match = useRouteMatch();
  let slug = match?.params?.slug || null;

  const slugIsRef = ((slug)=>{
    let {verse_ids} = lookup(slug);
    return !!verse_ids?.length;
  })(slug);


  const [queue, setQueue] = useState([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [queueStatus, setQueueStatus] = useState([]);
  const [cursorIndexArray, setCursorIndexArray] = useState((prev, current) => {
    const [index] = Array.isArray(current) ? current : [0];
    if (!queue?.length) return [0, false];
    if (!queue[index]) return prev;
  });
  const [cursorIndex, cursorChangeWasManual] = cursorIndexArray;

  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentDuration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(
    parseFloat(localStorage.getItem("playbackRate")) || 1
  );
	const [playbackVolume, setPlaybackVolume] = useState(
    parseFloat(localStorage.getItem("playbackVolume")).toFixed(1) || 1
  );
	const [isMuted,setIsMuted] = useState((localStorage.getItem("playbackMuted")==='true'?true:false) || false);
  const token = appController.states.user.token;
  const controls = {
    log: () => {
      BoMOnlineAPI(
        {
          log: {
            token,
            key: "block",
            val: queue[cursorIndex]?.slug,
          }
        },
        { useCache: false }
      );
    },
    pause: () => {
      document.getElementById("theater-audio-player")?.pause();
    },
    play: () => {
      playAudioElement("theater-audio-player");
    },
    stop: () => {
      document.getElementById("theater-audio-player").pause();
      document.getElementById("theater-audio-player").currentTime = 0;
    },
    next: (trigger, setSubCursorIndex=null) => {
      if(!!setSubCursorIndex) return setSubCursorIndex(1);
      if (cursorIndex + 1 >= queue.length) return;
      theaterController.goto(cursorIndex + 1,trigger);
    },
    goto:  (index,trigger) => {
      if (index >= queue.length || index < 0) return;


      const isManual = trigger === "manual";
      setCursorIndexArray([index, isManual]);
    },
    previous: (trigger) => {
      if (cursorIndex - 1 < 0) return;
      theaterController.goto(cursorIndex - 1,trigger);
    },
    incrementPlaybackSpeed: neg => {
      setPlaybackRate(prevRate => {
        let newRate = prevRate;
        const isNum = typeof prevRate === "number";
        const isNan = isNaN(prevRate);
        if(!isNum || isNan) return;
        if (neg) {
          newRate -= 0.1;
          if (newRate < 0.75) newRate = 0.75; // limiting the minimum speed to 0.5
        } else {
          newRate += 0.1;
          if (newRate > 2) newRate = 2; // limiting the maximum speed to 2
        }
        //set local storage
        localStorage.setItem("playbackRate", newRate);
        if(!document.getElementById("theater-audio-player")) return;
        document.getElementById("theater-audio-player").playbackRate = newRate;
        return parseFloat((newRate||1).toFixed(1)); // keeping it in float with one decimal point
      });
    },
    cyclePlaybackSpeed: () => {
      setPlaybackRate(prevRate => {
        let newRate = prevRate + 0.25;
        if (newRate > 2.5) newRate = 0.5;
        //set local storage
        localStorage.setItem("playbackRate", newRate);
        if(!document.getElementById("theater-audio-player")) return;
        document.getElementById("theater-audio-player").playbackRate = newRate;
        return parseFloat((newRate||1).toFixed(1)); // keeping it in float with one decimal point
      });
    },

    cycleVolume: () => {
      const player = document.getElementById("theater-audio-player");
      const volume = player.volume;
      if (volume === 0.2) player.volume = 0.4;
      if (volume === 0.4) player.volume = 0.6;
      if (volume === 0.6) player.volume = 0.8;
      if (volume === 0.8) player.volume = 1;
      if (volume === 1) player.volume = 0.2;
    },
		toggleMusic : ()=>{
			setIsMuted(prev=>{
					localStorage.setItem("playbackMuted", !prev);
					if(!document.getElementById("theater-audio-player")) return;
					return !prev;
				});
		}
  };

  const [isScrollingPanel, setIsScrollingPanel] = useState(false);

  const theaterController = {
    appController,
    ...controls,
    queue,
    setQueue,
    setQueueStatus,
    queueStatus,
    cursorIndex,
    currentProgress,
    currentDuration,
    setCurrentProgress,
    setDuration,
    setIsPlaying,
    isPlaying,
		playbackVolume,
		setPlaybackVolume,
    playbackRate,
    cursorChangeWasManual,
    setPlaybackRate,
    isScrollingPanel,
    setIsScrollingPanel,
		isMuted,
		setIsMuted,
  };

  useEffect(async () => {
    let items = slug ? [{slug}] : null; //todo: handle reading plan id / index input;
    if(slugIsRef) items = [{reference:slug}];
    //items = [{slug:"ammon",blocks:[4,5,6,7,8]}];
    const token = localStorage.getItem("token");
    let { queue:loadedQueue } = await BoMOnlineAPI(
      { queue: { token, items } },
      { useCache: false }
    );
    if(!loadedQueue || !loadedQueue?.length || !loadedQueue?.[0]) return setLoadFailed(true);
    loadedQueue = loadedQueue.map(item => {
      if(!item?.coms) return item;
      item.coms = (item?.coms || []).sort((a, b) => {
        //random
        return Math.random() - 0.5;
      });
      return item;
    });
    setQueue(loadedQueue);
    setQueueStatus((loadedQueue||[]).map(item => item?.status));
  }, []);

  useEffect(() => {
    //determine cursor
    const firstIncompleteItem = queue.findIndex(
      item => item?.status !== "completed"
    );
    theaterController.goto(0, "auto");
    //TODO: are there cases when this is needed?
  }, [queue]);

  const [isOutroActive, setIsOutroActive] = useState(false);
  theaterController.setIsOutroActive = setIsOutroActive;
  useEffect(() => {
    if (isOutroActive) {
      const playerA = document.getElementById("theater-music-player-a");
      const playerB = document.getElementById("theater-music-player-b");
      const player = playerA.volume > 0 ? playerA : playerB;
      if (player && player.volume > 0) {
        const fadeOutInterval = setInterval(() => {
          player.volume -= 0.05;
          if (player.volume <= 0) {
            player.pause();
            clearInterval(fadeOutInterval);
          }
        }, 200);
      }
    }
  }, [isOutroActive]);

  //Keyboard
  useEffect(() => {
    const handleKeyDown = e => {
      switch (e.code) {
        case "Space":
          setIsPlaying(!isPlaying);
          if (isPlaying) {
            controls.pause();
          } else {
            controls.play();
          }
          break;
        case "ArrowLeft":
          controls.previous("manual");
          break;
        case "ArrowRight":
          controls.next("manual");
          break;
        // equals sign key speeds up
        case "Equal":
          controls.incrementPlaybackSpeed();
          break;
        // minus sign key slows down
        case "Minus":
          controls.incrementPlaybackSpeed(-1);
          break;
        // tab key clicks the most recent commentary
        //zero should reset speed to 1
        case "Digit0":
          setPlaybackRate(1);
          if(!document.getElementById("theater-audio-player")) return;
          document.getElementById("theater-audio-player").playbackRate = 1;
          break;

        case "Tab":
          e.preventDefault();
          const commentFeed = document.querySelector(".theater-comment-feed");
          if (!commentFeed) return false;
          const lastComment = commentFeed.querySelector(".comment:last-child");
          if (!lastComment) return false;
          lastComment.click();
          break;
				case "KeyM":
					// toggle background music from on to off
					controls.toggleMusic();
					break;
        default:
          break;
      }
    };

    //set current item status to prestarted ifnot complete
    if (!["completed", "started"].includes(queueStatus[cursorIndex])) {
      queueStatus[cursorIndex] = "prestarted";
      setQueueStatus([...queueStatus]);
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, cursorIndex]);


  if(loadFailed) return (
                   <div className="theater-wrapper">
                     <div className="failed-to-load">
                       <img src={nowifi} />
                       <p>Failed to load theater</p>
                     </div>
                   </div>
                 );

  if (!queue?.length) return <div className="theater-wrapper"><Loader /></div>;

  return (
    <div className="theater-wrapper">
      <TheaterMainPanel theaterController={theaterController} />
      <TheaterSidePanel theaterController={theaterController} />
    </div>
  );
}

function TheaterMobileControls({ theaterController }) {

  const isPlaying = theaterController.isPlaying;
  const img = isPlaying ? pause : play;
  const onClickFn = isPlaying ? theaterController.pause : theaterController.play;

  return <div className="theater-mobile-controls" onClick={onClickFn}>
   <img src={img} />
  </div>

}
function TheaterMainPanel({ theaterController }) {
  const { queue, cursorIndex,cursorChangeWasManual } = theaterController;
  const currentItem = queue[cursorIndex] || null;

  const [canAutoPlayState, setCanAutoPlay] = useState(false);

  const thisSection = currentItem?.parent_section?.title || null;
  const prevSection = queue[cursorIndex - 1]?.parent_section?.title || null;
  const isNewSection =  thisSection !== prevSection;
  const isLastItem = cursorIndex === queue.length - 1;
  const hasNextContent = !!currentItem?.next && !!currentItem?.next?.[0]
  const posttype = isLastItem ? "outro" : hasNextContent ? "crossroads" : null;

  const isFirstItem = cursorIndex === 0;
  const initSubCursorIndex = cursorChangeWasManual ? 0 : isNewSection || isFirstItem ? -1 : 0;
  const [subCursorIndex, setSubCursorIndex] = useState(initSubCursorIndex);

  const pretype = isFirstItem
    ? "intro"
    : isNewSection
    ? "section"
    : null;

  useEffect(()=>{
      setSubCursorIndex(initSubCursorIndex);
      theaterController.setIsScrollingPanel(!initSubCursorIndex);
      if(cursorIndex) return;
      canAutoplay.audio().then(({result}) => {result ? setCanAutoPlay(true) : setCanAutoPlay(false);} );
  },[cursorIndex])

  theaterController = {
    ...theaterController,
    subCursorIndex,
    setSubCursorIndex,
    hasNextContent,
    canAutoPlayState,
    setCanAutoPlay
  };

  const showStatic = subCursorIndex !== 0;
  
  if(!canAutoPlayState) return <div className="theater-main-panel">
    <TheaterQueueIndicator theaterController={theaterController} />
    <TheaterStaticContent theaterController={theaterController} type="idle" />
  </div>

  return (
    <div className="theater-main-panel">
    <TheatherMusicPlayer theaterController={theaterController} />
    <TheaterQueueIndicator theaterController={theaterController} />
      {canAutoPlayState && showStatic ? (
        <TheaterStaticContent
          theaterController={theaterController}
          type={subCursorIndex < 0 ? pretype : posttype}
        />
      ) : (
        <>
          <TheaterContent theaterController={theaterController} />
        </>
      )}
          <TheaterMeta theaterController={theaterController} visible={!showStatic}/>
          <TheaterControls theaterController={theaterController} visible={!showStatic} />
    </div>
  );
}

function TheaterStaticContent({ theaterController, type }) {
  switch (type) {
    case "intro":
      return <TheaterQueueIntro theaterController={theaterController} />;
    case "section":
      return <TheaterSectionIntro theaterController={theaterController} />;
    case "crossroads":
      return <TheaterCrossRoads theaterController={theaterController} />;
    case "outro":
      return <TheaterQueueOutro theaterController={theaterController} />;
    case "idle":
      return <TheaterIdle theaterController={theaterController} />;
    default:
      return <pre>NO TYPE</pre>;
  }
}
function TheaterIdle({ theaterController }) {
  const {setCanAutoPlay } = theaterController;

  //listen for enter or space keys
  useEffect(() => {
    const handleKeyDown = e => {
      switch (e.code) {
        case "Space":
        case "Enter":
          setCanAutoPlay(true);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  let currentItemText = theaterController.queue[theaterController.cursorIndex]?.content || null;
  currentItemText = prepareContent(currentItemText);
  //remove html
  currentItemText = currentItemText.replace(/(<([^>]+)>)/gi, "");

  return <div className="theater-content-frame theater-queue-intro"
  >

    <div className={"theater-intro-slide"}>
    <p className="idleText">{currentItemText}</p>
    <button className="playbutton" onClick={()=>setCanAutoPlay(true)}>
      <img src={play} />
    </button>
      <p>{label("theater_press_play")}</p>
    </div>
    
  </div>;

}


function TheaterQueueOutro({ theaterController }) {

  return <TheaterCrossRoads theaterController={theaterController} />;

}
function TheaterQueueIntro({ theaterController }) {
  const { queue, cursorIndex } = theaterController;
  const currentItem = queue[cursorIndex] || null;

  const [initSFX] = useState(
    new Audio(`${assetUrl}/interface/audio/theater`)
);



  const secondsToShow = 15;
  const [countdown, setCountdown] = useState(secondsToShow);

  useEffect(() => {
    if(!cursorIndex) playSound(initSFX);
    setTimeout(()=>setPart(1),200);
    setTimeout(()=>setPart(2),6000);
    setTimeout(()=>setPart(3),12000);
    const timer = setInterval(() => {
      setCountdown(previousCountdown => {
        if (previousCountdown === 1) {
          // TODO: call setSubCursorIndex when countdown reaches 0
          theaterController.setSubCursorIndex(0);
          theaterController.setIsScrollingPanel(true);
          clearInterval(timer);
        } else {
          return previousCountdown - 1;
        }
      });
    }, 1000);
    return () => clearInterval(timer); // this will clear Timeout when component unmount like in willComponentUnmount
  }, []);

  const pageTitle = currentItem?.parent_page?.title || null;
  const sectionTitle = currentItem?.parent_section?.title || null;
  const queueItemsInSameSection = queue.filter( item => item?.parent_section?.title === currentItem?.parent_section?.title);
  const narrations = queueItemsInSameSection
    .map(item => item?.narration?.description || null)
    .filter(item => item)
    .map(item => item.replace(/(<([^>]+)>)/gi, ""));
  const uniqueNarrations = [...new Set(narrations)];
  let narrationString = flattenDescription(uniqueNarrations.join(" • ")) || "";

  const [part,setPart] = useState(0);

  const pages = [...new Set(queue.map(item => item?.parent_page?.title || null))];
  const lastPage = pages.pop();
  const pageString = pages.length > 1 ? pages.join(", ") + "</em> "+label("theater_list_and")+" <em>" + lastPage : lastPage;

  let sections = [...new Set(queue.map(item => item?.parent_section?.title || null))];

  const maxCharCount = 400;
  while(sections.join("").length + pageString.length > maxCharCount){
    sections.pop();
  }

  const sectionString = sections.length > 1 ? sections.slice(0,-1).join(", ") + "</em> "+label("theater_list_and")+" <em>" + sections.reverse()[0] : sections.reverse()[0];


  const passageCount = queue.length;
  return (
    <div className="theater-content-frame theater-queue-intro">
      <div className={"theater-intro-slide " + (part===1 ? "on" : "off") }>
      <p className="presents">{Parser(label("bom_presents"))}</p>
      <img src={logo} className="logo" />
      <p>{Parser(label("theater_x_passages_from_y",[`${passageCount}`,`<em>${pageString}</em>`])|| "x")}</p>
      <p>{Parser(label("theater_covering_x",[`<em>${sectionString}</em>`])||"x")}</p>
      </div>
      <div className={"theater-intro-slide section-intro " + (part===2 ? "on" : "off") }>
      <p><span className="pageTitle">{pageTitle}:</span><br/>{sectionTitle}</p>
      <small>{Parser(narrationString)}</small>
      </div>
    </div>
  );
}

function TheaterSectionIntro({ theaterController }) {
  const secondsToShow = 10;
  const { queue, cursorIndex } = theaterController;
  const currentItem = queue[cursorIndex] || null;
  const { parent_section } = currentItem || {};
  const { title } = parent_section || {};
  const [countdown, setCountdown] = useState(secondsToShow);
  const [startTimestamp, setStartTimestamp] = useState(Date.now());

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(()=>setVisible(true),100);
  }, []);

  let sectionNarrations = queue
    .filter(
      item => item?.parent_section?.title === currentItem?.parent_section?.title
    )
    .map(item => item?.narration?.description || null)
    .filter(item => item)
    .map(item => flattenDescription(item));

    const maxCharCount = 400;
  while(sectionNarrations.join("").length > maxCharCount){
    sectionNarrations.pop();
  }

  useEffect(() => {
    setTimeout(() => {
      theaterController.setSubCursorIndex(0);
    }, secondsToShow * 1000);

    //interval counddown
    const timer = setInterval(() => {
      const now = Date.now();
      const timeLeft = now - startTimestamp;
      setCountdown(parseInt((secondsToShow * 1000 - timeLeft) / 1000));
    }, 200);
  }, []);

  const narrationString = sectionNarrations.join(" • ");
  const pageTitle = currentItem?.parent_page?.title || null;
  const sectionTitle = currentItem?.parent_section?.title || null;

  return (
    <div className="theater-content-frame theater-section-intro">
      
      <div className={"theater-intro-slide section-intro " + (visible ? "on" : "off") }>
        <p className="upnext">{label("theater_up_next")}</p>
      <p><span className="pageTitle">{pageTitle}:</span><br/>{sectionTitle}</p>
      <small>{narrationString}</small>
      </div>
    </div>
  );
}

function ButtonTimer({timerprogress}){

  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => { 
    if(timerprogress===null) setTimeout(()=>setIsHidden(true),2500);
  },[timerprogress]);

  return <div className={"timerContainer" + (isHidden ? " hidden" : "")}>
  {timerprogress && <div className="timerBand">
    <div className="timerProgress" style={{width:timerprogress+"%"}}></div>
  </div>}
  </div>

}


function TheaterCrossRoadsButton({theaterController,config,optionalOverride,page,narration,slug,onClick,index,setSelectedIndex,selectedIndex,timerprogress}) {
  narration = flattenDescription(narration);

  const setQueueStatus = theaterController.setQueueStatus;

  const {finish,more} = config || {};  
  const isContinue = !finish && !more && !slug;
  const loadItem = more ? null : (slug||null);
  const items = loadItem ? [{slug:loadItem}] : null;

  const [mainLabel, setMainLabel] = useState(page || (finish ? label("finish") : more ? label("more") : null));
  const [subLabel, setSubLabel] = useState(optionalOverride || narration || (finish ? label("finish_narration") : more ? label("more_narration") : null));

  const nextQueuePromiseRef = useRef(null);


  useEffect(() => {
    const token = theaterController.appController.states.user.token;
    nextQueuePromiseRef.current = BoMOnlineAPI({ queue: { token, items } }, { useCache: false }).then(({ queue }) => queue)
  }, []);

  const handleClick = onClick || (async () => {
    setMainLabel(label("loading"));
    setSubLabel(label("loading_narration"));
    if (finish) {  document.location = "/user";  return; }
    if(isContinue) return theaterController.next("manual");

    //clear theater progres
    //clear queue status
    setQueueStatus([]);
    const nextQueue = await nextQueuePromiseRef.current;
    if (nextQueue) {
      theaterController.setQueue(nextQueue);
    }

    }
  );
  const isActive = selectedIndex === index;

return (
    <div className={"theater-crossroads-box-button" + (isActive ? " active" : "") } onClick={handleClick} onMouseEnter={()=>setSelectedIndex(index)} >

    {!index && <ButtonTimer timerprogress={timerprogress} />}
    {!finish && !more && <h5>{mainLabel}</h5>}
    <h6>{subLabel}</h6>
    </div>
  );
}



function TheaterCrossRoads({ theaterController }) {
  const { queue, cursorIndex } = theaterController;
  const currentItem = queue[cursorIndex] || null;
  const { next } = currentItem || {};
  const isLast = cursorIndex === queue.length - 1;
  
  const thisItem = queue[cursorIndex] || null;


  const narration = thisItem?.narration?.description || null;
  const page = thisItem?.parent_page?.title || null;
  const slug = thisItem?.slug || null;


  //add countdown from 10 sec
  const secondsToShow = 10;
  const [countdown, setCountdown] = useState(secondsToShow);
  const [startTimestamp] = useState(Date.now());
  const defaultState = useRef(true);
  const [showProgress, setShowProgress] = useState(true);

  useEffect(theaterController.log, [cursorIndex]);

  useEffect(() => {

    //interval countdown
    const timer = setInterval(() => {
      const now = Date.now();
      const timePassed = now - startTimestamp;
      const timeLeft = defaultState.current ? secondsToShow - timePassed/1000 : secondsToShow;

      if(!defaultState.current) return clearInterval(timer);  // Stop interval

      setCountdown(timeLeft);  // Update countdown

      if(timeLeft <= 0 && defaultState.current){
        
        //click default button
        const defaultButton = document.querySelector(".theater-crossroads-box-button");
        if(defaultButton) defaultButton.click();

        clearInterval(timer);  // Stop interval
      }
    }, 50);

    return () => clearInterval(timer);   // Clean up on unmount

  }, [startTimestamp, cursorIndex, theaterController]);

  const nextclass = next?.[0]?.nextclass || null;
  const img = isLast ? again : nextclass==="C" ? crossroads : detour;
  const {optionalText,defaultLabel,optionalLabel,headingLabel,titleLabel,helperText,optionalOverride} = (()=>{
    if(isLast) return{
      titleLabel:label("section_complete"),
      headingLabel:label("finish_or_more"),
      defaultLabel:label("finish"),
      optionalLabel:label("more"),
      helperText:label("theater_finish_help"),
      optionalText:null
    }
    if(nextclass==="C") return{
      titleLabel:label("crossroads"),
      headingLabel:label("continue_or_detour"),
      defaultLabel:label("continue"),
      optionalLabel:label("detour"),
      helperText:label("theater_crossroads_help"),
      optionalText:flattenDescription(next?.[0]?.text || null)
    }
    return {
      titleLabel:label("embedded"),
      headingLabel:label("step_over_or_into"),
      defaultLabel:label("step_over"),
      helperText:label("theater_contained_help"),
      optionalLabel:label("step_into"),
      optionalText:null,
      optionalOverride:flattenDescription(next?.[0]?.text || null)
    }
  })();

  const [selectedIndex,setSelectedIndex] = useState(0);

  const timerprogress = showProgress ? 100-(countdown/secondsToShow)*100 : null

  useEffect(() => {

    if(!selectedIndex) return;
    defaultState.current =false;
    setShowProgress(false);

  }, [selectedIndex]);


  


  const finishButton = <TheaterCrossRoadsButton config={{finish:true}} timerprogress={timerprogress} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} theaterController={theaterController} index={0} />;
  const moreButton = <TheaterCrossRoadsButton config={{more:true}}  isLast={true} isMore={true} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} theaterController={theaterController} index={1} />;
  const nextButton = <TheaterCrossRoadsButton timerprogress={timerprogress}  selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} theaterController={theaterController} page={page} narration={narration} />;
  const divergeButtons = !next?.length ? null : <>{next.map((n,i) => <TheaterCrossRoadsButton optionalOverride={optionalOverride}  selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} theaterController={theaterController} {...n} index={i+1} />)}</>;

  const defaultButton = isLast ? finishButton : nextButton;
  const optionalButtons = isLast ? moreButton : divergeButtons;


  return (  <div className="theater-crossroads">
  <h2>{titleLabel}</h2>
  <h3>{headingLabel}</h3>
  <div className="crossroads-helper">{helperText}</div>
    <div className="theater-crossroads-box">
    <div className="theater-crossroads-box-top">
      <div className="buttonheader">{defaultLabel}:</div>
      {defaultButton}
      <div className="theater-crossroads-box-bottom">
        <img src={img} />
        <div className="theater-crossroads-box-offramp">
          <div className="buttonheader">{optionalLabel}: {optionalText}</div>
          {optionalButtons}
        </div>
      </div>
    </div>
  </div>
</div>);
}




function TheaterSidePanel({ theaterController }) {
  return (
    <div className="theater-side-panel">
      <TheaterPeoplePlacePanel theaterController={theaterController} />
      <div className="theater-image-comment-panel">
      <TheaterImagePanel theaterController={theaterController} />
      <TheaterCommentFeed theaterController={theaterController} />
      </div>
    </div>
  );
}

function TheaterMeta({ theaterController, visible }) {



  return (
    <div className={"theater-meta" + (visible ? " visible" : "")}>
      <TheaterMetaContent theaterController={theaterController} />
    </div>
  );
}

function TheaterControls({ theaterController, visible }) {

  const {
    queue,
    setQueueStatus,
    cursorIndex,
    setCurrentProgress,
    setDuration,
    hasNextContent,
    setSubCursorIndex,
		playbackVolume,
    currentDuration,
  } = theaterController;


  const history = useHistory();

  const [playerCanPlay, setPlayerCanPlay] = useState(false);



  const currentItem = queue[cursorIndex] || null;
  useEffect(() => {
    if(!currentItem) return;
    setPlayerCanPlay(false);
    const slug = currentItem?.slug || null;
    const title = `${currentItem?.heading} • ${currentItem?.parent_page?.title}`;
    document.title = `${title}`;
    history.push(`/theater/${slug}`);

  }, [currentItem]);


  useEffect(() => {
    const player = document.getElementById("theater-audio-player");
    if (!player || !visible) return;
    player.playbackRate = theaterController.playbackRate;
    playAudioElement("theater-audio-player");
  }, [playerCanPlay,visible]);

  if (!currentItem) return <Loader />;
  const [num, pageslug] = currentItem?.slug.split("/").reverse();
  const media_path = `${pageslug}-${num}`;
  const lang = determineLanguage() || "en";
  const url = `${assetUrl}/audio/${lang}/${media_path}`;


  const onCanPlay = e => {
    setDuration(e.target.duration);
    setPlayerCanPlay(true);
  };


  const onListen = e => {
    const progress = (e / currentDuration) * 100;
    setCurrentProgress(progress);
    const player = document.getElementById("theater-audio-player");
    if(!player) return;
    player.playbackRate = theaterController.playbackRate;

    //if progress is 60%  log item, but only once!
    if (progress > 85 && !currentItem?.updated) {
      currentItem.updated = true;
      updateQueueStatus();
    }
  };

  const updateQueueStatus = async () => {

    //get updated status
    const token = theaterController.appController.states.user.token;
    const queueitems = loadQueueItemsFromQueue(queue);
    const { queuestatus } = await BoMOnlineAPI(
      { queuestatus: { token, items: queueitems } },
      { useCache: false }
    );
    if (!queuestatus?.map) return false;
    const newStatus = queuestatus?.map(item => item?.status) || null;
    if(!newStatus) return;

    setQueueStatus(newStatus);


  }

  const logItem = async () => {
    const [number, slugEnd] = currentItem?.slug.split("/").reverse();
    const slug = `${slugEnd}/${number}`;
    const token = theaterController.appController.states.user.token;
    const progress = await BoMOnlineAPI(
      {
        log: {
          token,
          key: "block",
          val: slug
        }
      },
      { useCache: false }
    );
    await updateQueueStatus();
    BoMOnlineAPI( {  userprogress: token, }, { useCache: false } ).then((r) => {
      let saveMe = r.userprogress?.[token];
      let summary = saveMe.summary;
      const pagetitle = currentItem?.parent_page?.title || null;
      const heading = currentItem?.heading || null;
      const slug = currentItem?.slug || null;
      if (saveMe)
        theaterController.appController.functions.updateUserSummary({
          ...saveMe,
          ...{ slug, pagetitle, heading },
        });
        window.clicky?.goal("watch");
      // if 100% then show confetti
      if(summary?.completed >= 100)
      {
        //pause theater
        theaterController.controls.pause();
        document.getElementById(`theater-music-player-a`)?.pause();
        document.getElementById(`theater-music-player-b`)?.pause();
        theaterController.appController.functions.setPopUp({
          type: "victory",
          popupData: summary,
          vhtop: 10
        });
      }
    });
    

  };
  const isLastItem = cursorIndex === queue.length - 1;

  return (
    <div className={"theater-controls"+(visible ? " visible" : "")}>
      <TheaterProgressBar theaterController={theaterController} />
      <ReactAudioPlayer
        id="theater-audio-player"
        src={url}
				volume={playbackVolume}
        controls
        playbackRate={theaterController.playbackRate}
        onPause={() => theaterController.setIsPlaying(false)}
        onPlay={() => {
          theaterController.setIsPlaying(true);
          theaterController.setIsScrollingPanel(true);
          logItem();
        }}
        listenInterval={50}
        onListen={onListen}
        onCanPlay={onCanPlay}
        onEnded={() => theaterController.next("auto",(hasNextContent || isLastItem) ? setSubCursorIndex : null)}
      />
    </div>
  );
}

function TheatherMusicPlayer({ theaterController }) {

  const { queue, cursorIndex,playbackVolume,isMuted } = theaterController;
  const currentItem = queue[cursorIndex] || null;
  const nextItem = queue[cursorIndex + 1] || null;
  const currentSection = currentItem?.parent_section?.title || null;
  const previousSection = queue[cursorIndex - 1]?.parent_section?.title || null;
  const nextSection = nextItem?.parent_section?.title || null;
  const currentSectionIsNew = currentSection !== previousSection;
  const nextSectionIsNew = currentSection !== nextSection;
  const isFirst = cursorIndex === 0;

  const makeSelection = (section) => {
    //TODO: Load based on ambien value
    return (Math.floor(Math.random() * 300) + 1).toString().padStart(3, '0');
  }

  const [activeSide, setActiveSide] = useState("a");
  const [trackA, setTrackA] = useState(makeSelection(currentSection));
  const [trackB, setTrackB] = useState(makeSelection(nextSection));

  // Init Player A on load
  const initPlayerA = () => {
    const player = document.getElementById(`theater-music-player-a`);
    playAudioElement("theater-music-player-a");
    player.removeEventListener("canplay",initPlayerA);
  }
  useEffect(()=>{
    const player = document.getElementById(`theater-music-player-a`);
    player.addEventListener("canplay",initPlayerA);
  },[])


  //If the next section is new, preload the next track on the quiet side
  useEffect(()=>{
    if(!nextSectionIsNew) return;
    const newTrack = makeSelection(nextSection);
    if(activeSide==="a"){
      document.getElementById(`theater-music-player-b`).volume = 0;
      setTrackB(newTrack);
    }else{
      document.getElementById(`theater-music-player-a`).volume = 0;
      setTrackA(newTrack);
    }

  },[nextSection])

  // Kick off the crossfade process by setting the preloaded active side
  useEffect(()=>{
    if(currentSectionIsNew && !isFirst){
      setActiveSide(activeSide==="a" ? "b" : "a");
    }
  },[cursorIndex])

  // once the active side is set, start the crossfade
  useEffect(()=>{
    crossfade();
  },[activeSide])

  
  // The active side just changed, so it first needs to be faded in
  // And the previously active side needs to be faded out
  // Fade duration = 3 seconds
  const crossfade = () => {
		if(isMuted) return;
    const playerToFadeIn = document.getElementById(`theater-music-player-${activeSide}`);
    playAudioElement(`theater-music-player-${activeSide}`);
    const playerToFadeOut = document.getElementById(`theater-music-player-${activeSide==="a" ? "b" : "a"}`);
    const targetVolume = Math.max(playerToFadeIn.volume,playerToFadeOut.volume);
    const fadeDuration = 3;
    const fadeInterval = 50;
    const fadeSteps = fadeDuration*1000/fadeInterval;
    let fadeStep = 0;
    const fadeOut = setInterval(()=>{
      fadeStep++;
      const fadeInVolume = fadeStep/fadeSteps*targetVolume;
      const fadeOutVolume = targetVolume - fadeInVolume;
      playerToFadeIn.volume = fadeInVolume;
      playerToFadeOut.volume = fadeOutVolume;
      if(fadeStep>=fadeSteps){
        playerToFadeOut.pause();
        clearInterval(fadeOut);
      }
    },fadeInterval);


  }

  const volA = document.getElementById(`theater-music-player-a`)?.volume;
  const volB = document.getElementById(`theater-music-player-b`)?.volume;
  const timeA = document.getElementById(`theater-music-player-a`)?.currentTime;
  const timeB = document.getElementById(`theater-music-player-b`)?.currentTime;

  return (
    <>
    <ReactAudioPlayer
      id="theater-music-player-a"
      src={`${assetUrl}/audio/music/${trackA}`}
      volume={0.1}
			muted={isMuted}
      onCanPlay={()=>{
        const isPLaying = document.getElementById(`theater-music-player-a`)?.paused;
        if(isPLaying) return;
        const isActive = activeSide==="a";
        if(isActive) return;
        playAudioElement("theater-music-player-a");
      }}
    />
    <ReactAudioPlayer
      id="theater-music-player-b"
      src={`${assetUrl}/audio/music/${trackB}`}
      volume={0.1}
			muted={isMuted}
      onCanPlay={()=>{
        const isPLaying = document.getElementById(`theater-music-player-a`)?.paused;
        if(isPLaying) return;
        const isActive = activeSide==="a";
        if(isActive) return;
        playAudioElement("theater-music-player-a");
      }}
    />
    </>
  );
}

function TheaterNarration({ theaterController }) {
  const { queue, cursorIndex } = theaterController;
  const currentItem = queue[cursorIndex] || null;

  const replacer = (string)=>{
      return string.replace(/[{\[](.*?)[}\]]/g, (match, inner) => {
        return "<b>" + inner.split("|")[0] + "</b>";
      });
  }

  const allNarrations = (queue||[]).map(item => item?.narration?.description || null);
  const uniqueNarrations = [...new Set(allNarrations)];
  const narrationMap = {};
  allNarrations.forEach((_,i)=>{
    const matchIndex = uniqueNarrations.indexOf(allNarrations[i]);
    narrationMap[i] = matchIndex;
  });

  const narrationIndex = narrationMap[cursorIndex];


  let narrationUL = <ul>  {uniqueNarrations.map((narration, index) => {
     const queue_index = allNarrations.indexOf(narration);
     const narrationValue = Parser(replacer(narration))
      return <li
      onClick={()=>theaterController.goto(queue_index,"manual")}
      key={index}className={narrationIndex===index ? "active" : ""}>{narrationValue}</li>
    })}</ul>;

    useEffect(()=>{
      //scrollto smooth
      const narrationEl = document.querySelector(".theater-meta-content-narration");
      const activeEl = narrationEl.querySelector(".active");
      if(!activeEl) return;
      const top = activeEl.offsetTop;
      //scroll to vertical center -minus half height of li
      const scrollTo = top - narrationEl.offsetHeight/2 + activeEl.offsetHeight/2;
      narrationEl.scrollTo({top:scrollTo, behavior:"smooth"});

    },[narrationIndex])


    if (!currentItem) return null;
  return (
    <div className="theater-meta-content-narration">{narrationUL}</div>
  );
}

const prepareContent = (content)=>{

 return  content
  ?.replace(/\[[civaquote]+\][0-9a-z]+\[\/[civaquote]+\]/g, "")
  .replace(/[_]/g, "<span class='spacer'></span>")
  .replace(/\s+/g, " ") || "";

}

function TheaterContent({ theaterController }) {
  const {
    queue,
    cursorIndex,
    currentProgress,
    currentDuration
  } = theaterController;
  const playerPosition = document.getElementById("theater-audio-player")
    ?.currentTime;
  const playerIsPaused = document.getElementById("theater-audio-player")
    ?.paused;

  const state = playerPosition && !playerIsPaused ? "playing" : "paused";

  const currentItem = queue[cursorIndex] || null;
  let { content } = currentItem || {};

  content = prepareContent(content);

  
  useLayoutEffect(() => {
    setTransitioning(true);
  },[cursorIndex]);

  //stip comment and image blocks: [c]1234[/c] and [i]1234[/i]

  const computePosition = progress => {
    return progress;
  };

  const yPosition = computePosition(currentProgress);

  const [transitioning, setTransitioning] = useState(true);
  useEffect(() => {
    if(transitioning && currentProgress>0) setTransitioning(false);
  },[currentProgress])


  

  let opacity = 1;
  const timeElapsed = (currentProgress / 100) * currentDuration;

  //fade in and out in first and last 3 seconds
  const secondsBuffer = 2;
  if (timeElapsed < secondsBuffer) opacity = timeElapsed / secondsBuffer;
  if (timeElapsed > currentDuration - secondsBuffer)
    opacity = (currentDuration - timeElapsed) / secondsBuffer;

    const isPlaying = !document.getElementById(`theater-audio-player`)?.ended
    && !document.getElementById(`theater-audio-player`)?.seeking
    && document.getElementById(`theater-audio-player`)?.currentTime > 0;
  
    if(!isPlaying || transitioning) opacity = 0;

  const isFirst = cursorIndex === 0;
  const isLast = cursorIndex === queue.length - 1;
  const backgroundImage = `theater/gold-1`;

  return (
    <div className={`theater-content-frame ${state}`} 
    style={{backgroundImage:`url(${assetUrl}/${backgroundImage})`}}>
      <TheaterMobileControls theaterController={theaterController} />
      <div
        className={`theater-content-slider ${state}`}
        style={{ transform: `translateY(-${yPosition}%)`, opacity }}
      >
        {Parser(content)}
      </div>
      <div className="theater-content-top-visor"></div>
      <div className="theater-content-bottom-visor"></div>
      <div className={"theater-content-prev" + (isFirst ? " hidden" : "")}>
        <img
          src={prev}
          onClick={()=>theaterController.previous("manual")}
          className="player-ui"
        />
      </div>
      <div className={"theater-content-next" + (isLast ? " hidden" : "")}>
        <img
          src={next}
          onClick={()=>theaterController.next("manual")}
          className="player-ui"
        />
      </div>
    </div>
  );
}

function TheaterMetaContent({ theaterController }) {
  const { queue, cursorIndex, queueStatus } = theaterController;
  const currentItem = queue[cursorIndex] || null;
  if (!currentItem) return null;
  //page, section, narration, heading
  const {
    parent_page: { title: page },
    parent_section: { title: section },
    heading
  } = currentItem;
  const narration = currentItem?.narration?.description || "Sub Item...";

  const StudyButton = <Link className="studylink" to={`/${currentItem?.slug}`}><img src={studyimg} />{label("menu_study")}</Link>

  return (
    <div className="theater-meta-contents">
      <div className="theater-meta-content-left">
        <div className="theater-meta-content-heading">{heading}{StudyButton}</div>
        <div className="theater-meta-content-section">{section}</div>
        <div className="theater-super-title">{page}</div>
      </div>
      <div className="theater-meta-content-right">
        <TheaterNarration theaterController={theaterController} />
      </div>
    </div>
  );
}

function TheaterQueueIndicator({ theaterController }) {
  let { queue, cursorIndex, queueStatus } = theaterController;
  queue = Array.isArray(queue) ? queue : [];
  return (
    <div className="theater-queue-indicator"
      style={{
        gap: `min(1ex,${30/queue.length}vw)`,
      }}
    >

      <ReactTooltip effect="solid" id="dotToolTip" type="dark" place="bottom"  offset="{'top':-10}" className="theater-queue-indicator-tooltip" />

      {(queue||[]).map((_, index) => {
        const status = queueStatus[index] || queue[index]?.status || null;

        const nextSection = queue[index + 1]?.parent_section?.title || null;
        const thisSection = queue[index]?.parent_section?.title || null;
        const isLastInSection = nextSection !== thisSection;
        const heading = queue[index]?.heading || null;
        return (
					<>
					<div
            onClick={() => theaterController.goto(index, "manual")}
            className={`theater-queue-indicator-item ${status || ""} ${
              index === cursorIndex ? "active" : ""
            } ${isLastInSection ? "last-in-section" : ""
            }`}
            key={index}
						data-html={true}
						data-tip={"<b>" + thisSection + "</b> <br/>" + heading + "<br/>" + status}
            data-for="dotToolTip"
          ></div>
					</>
        );
      })}
    </div>
  );
}

function TheaterProgressBar({ theaterController }) {
  const {
    currentProgress,
    currentDuration,
    isPlaying,
    playbackRate,
    cyclePlaybackSpeed
  } = theaterController;
  const seekTo = e => {
    const barElement = document.querySelector(".theater-progress-bar");
    const percent = e.nativeEvent.offsetX / e.target.offsetWidth;
    document.getElementById("theater-audio-player").currentTime =
      percent * currentDuration;
  };

  const playpause = !isPlaying ? play : pause;
  const playpauseFN = !isPlaying
    ? theaterController.play
    : theaterController.pause;
  const rateString = (playbackRate||1).toFixed(1) + " ×";
	const [showPlaybackSettings,setShowPlaybackSettings] = useState(false);
  return (
    <div className="theater-progress-bar-container">
      <div className="theater-progress-bar-buttons left">
        <img src={playpause} className="player-ui" onClick={playpauseFN} />
      </div>
      <div className="theater-progress-bar" onClick={seekTo}>
        <ProgressBar percent={currentProgress} />
      </div>
      <div className="theater-progress-bar-buttons right">
				{showPlaybackSettings && <PlaybackSettings setShowPlaybackSettings={setShowPlaybackSettings} theaterController={theaterController}/>}
        <div>
          <div className="playbackRateIcon" onClick={cyclePlaybackSpeed}>
            {rateString}
          </div>
        </div>
        <img src={menu} className="player-ui" onClick={()=>setShowPlaybackSettings(prev=>!prev)} />
      </div>
    </div>
  );
}

function PlaybackSettings({setShowPlaybackSettings,theaterController}){
	const {playbackRate,setPlaybackRate,playbackVolume,setPlaybackVolume,toggleMusic,isMuted}=theaterController;
	const inputRef = useRef(null);
	const handleInput = (e)=>{
			if(e.target.id === 'speedInput'){
				setPlaybackRate(() => {
					localStorage.setItem("playbackRate", +e.target.value);
					if(!document.getElementById("theater-audio-player")) return;
					document.getElementById("theater-audio-player").playbackRate = +e.target.value;
					return parseFloat((+e.target.value||1).toFixed(1)); // keeping it in float with one decimal point
				});
			}else{
				setPlaybackVolume(() => {
					localStorage.setItem("playbackVolume", +e.target.value);
					if(!document.getElementById("theater-audio-player")) return;
					document.getElementById("theater-audio-player").volume = +e.target.value;
					return parseFloat((+e.target.value).toFixed(1)); // keeping it in float with one decimal point
				});
			}
	}
	const handleKeyInput = (e)=>{
		if(e.code === 'Escape' || e.code === 'Enter' || e.code === "NumpadEnter") setShowPlaybackSettings(false);
	}

	useEffect(()=>{
		inputRef.current.focus();
	},[])
  
  const decimalPaddedRate = (playbackRate||1).toFixed(1);

	return(
    <div className="theater-config" onKeyDown={handleKeyInput}>
    <div className="theater-config-container">
        <div className="playback-rate-label">{label("playback_rate")}:</div>
        <div className="theater-config-value">{decimalPaddedRate} ×</div>
    </div>

    <div className="playback-rate-input">
            <input ref={inputRef} type="range" id="speedInput" min="0.8" max="2.0" value={playbackRate} step="0.2" onChange={handleInput}/>
        </div>

        <hr/>
    <div className="theater-config-container">
        <div className="playback-volume-label">{label("playback_volume")}:</div>
        <div className="theater-config-value">{playbackVolume*100}%</div>
    </div>

    <div className="playback-volume-input">
            <input type="range" id="volumeInput" min="0" max="1.0" value={playbackVolume} step="0.2" onChange={handleInput}/>
        </div>
    <hr/>
    <div className="theater-config-container">
        <div className="background-music-label">{label("background_music")}:</div>
        <div><Switch 
                            id="audioSwitch"
                            onText={label("on")}
                            offText={label("off")}
                            onChange={toggleMusic}
                            value={!isMuted}
                            onColor="default"
                            offColor="default" /></div>
    </div>

</div>
	)
}

function ProgressBar({ percent }) {
  //console.log(percent);

  return (
    <div className="progress-bar">
      <div
        className="progress-bar-inner"
        style={{ width: `${percent}%` }}
      ></div>
    </div>
  );
}

function TheaterPeoplePlacePanel({ theaterController }) {
  const {
    queue,
    cursorIndex,
    isScrollingPanel,
    currentProgress,
		currentDuration,
    appController
  } = theaterController;
  const people =
    queue[cursorIndex]?.people?.map(i => ({ ...i, type: "people" })) || [];
  const places =
    queue[cursorIndex]?.places?.map(i => ({ ...i, type: "places" })) || [];
  const peoplePlace = [...people, ...places];

  const classHide = !peoplePlace.length ? "hidden" : "";
  const currentItemIndex = Math.floor(
    ((currentProgress * 2) / 100) * peoplePlace.length
  );

  const popUpItem = (type, id) => {
    theaterController.pause();
    appController.functions.setPopUp({
      type,
      ids: [id]
    });
  };

  const peoplePlaceEl = peoplePlace
    .map((item, index) => {
      const visibleClass = index <= currentItemIndex ? "visible" : "hidden";

      const { type } = item;

      const name = item?.name.replace(/[0-9]/g, "<sup>$&</sup>").split(",").reverse().join(" ").replace(/\s+/g, " ");
      let caption = item?.title || item.info || null;
      caption = caption?.replace(/[0-9]/g, "<sup>$&</sup>");
      const slug = item?.slug || null;
      const url = `${assetUrl}/${type}/${slug}`;

      return (
        <div
          className={"theater-people-place-item " + visibleClass}
          key={index}
          onClick={() => popUpItem(type, slug)}
        >
          <div className="theater-people-place-item-name">{Parser(name)}</div>
          <img src={url} />
          <div className="theater-people-place-item-caption">
            {Parser(caption)}
          </div>
        </div>
      );
    })
    .reverse();

  const visibleItemCount = peoplePlaceEl.filter(item =>
    item.props.className.includes("visible")
  ).length;

	let opacity = 1;
  const currentTime = -0.5 +( (currentProgress / 100) *( currentDuration +1));
  //fade in and out in first and last 3 seconds
  const secondsBuffer = 1.5;
  if (currentTime < secondsBuffer) opacity = currentTime / secondsBuffer;
  if (currentTime > currentDuration - secondsBuffer)
    opacity = (currentDuration - currentTime) / secondsBuffer;

  if(!currentTime || !isScrollingPanel) opacity = 0;
    useLayoutEffect(() => {
      setTransitioning(true);
    },[cursorIndex]);

  const [transitioning, setTransitioning] = useState(true);
  useEffect(() => {
    if(transitioning && currentProgress>0) setTransitioning(false);
  },[currentProgress])


  const isPlaying = !document.getElementById(`theater-audio-player`)?.ended
  && !document.getElementById(`theater-audio-player`)?.seeking
  && document.getElementById(`theater-audio-player`)?.currentTime > 0;

  const backgroundImage = `${assetUrl}/theater/people-1`;

  if(!isPlaying || !isScrollingPanel) opacity = 0;
  return (
    <div
      className={
        `theater-people-place-panel ${classHide}`
      }
      style={{backgroundImage:`url(${backgroundImage})`}}
    >
      <h4>{label("people_and_places")}</h4>
      <div className="theater-people-place-items" style={{ opacity }}>
        <div className={"spacer itemCount" + visibleItemCount}/>
        {peoplePlaceEl}</div>
    </div>
  );
}

function TheaterImagePanel({ theaterController }) {
  const {
    queue,
    cursorIndex,
    currentProgress,
    currentDuration
  } = theaterController;
  const percentZoomPerSec = 0.4 / 30;
  const endZoom = percentZoomPerSec * currentDuration;
  const currentItem = queue[cursorIndex] || null;
  const images = currentItem?.imgs || [];

  useEffect(() => {
    //preload images
    images.forEach(img => {
      const image = new Image();
      image.src = `${assetUrl}/art/${img.id}`;
    });
  }, [currentItem?.imgs]);

  //pick image based on currentProgress
  const imageCount = images.length;
  const imageIndex = Math.floor((imageCount * currentProgress) / 100);
  const image = images[imageIndex] || null;
  const percentPerImage = 100 / imageCount;
  const progressOfCurrentImage =
    (currentProgress - percentPerImage * imageIndex) / percentPerImage;

  const classHide = !imageCount ? "hidden" : "";
  const scale = 1 + progressOfCurrentImage * (endZoom / imageCount);

  let opacity = 1;
  const currentTime = (currentProgress / 100) * currentDuration;
  //fade in and out in first and last 3 seconds
  const secondsBuffer = 2;
  if (currentTime < secondsBuffer) opacity = currentTime / secondsBuffer;
  if (currentTime > currentDuration - secondsBuffer)
    opacity = (currentDuration - currentTime) / secondsBuffer;

  const imgEl = image ? (
    <div className="img-element-container" 
    style={{
      transform: `scale(${scale}) `,
      opacity
    }}>
      <img
        src={`${assetUrl}/art/${image.id}`}
        style={{backgroundImage:`url(${assetUrl}/theater/canvas-1)`}}
      />
    </div>
  ) : null;

  return (
    <div className={"theater-image-panel " + classHide}>
      <h4>{label("art")}</h4>
      <div className="theater-image-container">{imgEl}</div>
      <div className="imageCaption" style={{ opacity }}>
        {(image|| {}).title}
      </div>
    </div>
  );
}

function TheaterCommentFeed({ theaterController }) {

  const filter = theaterController.appController.states.preferences.commentary.filter;
  const blacklist = (filter.type==="blacklist" ? filter?.sources : []) || [];
  const [comments, setComments] = useState(new Set());
  const secondsBetweenComments = 5;
  const {
    queue,
    cursorIndex,
    currentProgress,
    currentDuration,
		isPlaying
  } = theaterController;
  const currentItem = queue[cursorIndex] || null;
  const coms = currentItem?.coms || [];
  const filteredcoms = coms.filter(com => {
    const sourceId = com.id.toString().substr(5, 3);
    if (!com.preview?.trim()) return false;

    if ([...blacklist, 41, 161, 162, 163, 164, 165, 166].includes(parseInt(sourceId)))
      return false;
    return true;
  });
  const allowedMessageCount = currentDuration / secondsBetweenComments;
  const queuedMessages = filteredcoms.slice(0, allowedMessageCount); //randomized earlier
  const division = queuedMessages.length > 5 ? queuedMessages.length : 5; // this is for items with low comment count, so its coms dont'get skipped.
  const commentCursor = Math.floor(  (division * (currentProgress * 0.7)) / 100 );
  useEffect(async () => {
		if(!isPlaying) return;
    //wait 1-3 seconds
    await new Promise(resolve =>
      setTimeout(resolve, 1000 + Math.random() * 2000)
    );
    if (!queuedMessages.length) return;
    if (!queuedMessages[commentCursor]) return;
    const onDeckComment = queuedMessages.filter((_,index)=>index <= commentCursor);
    setComments(prev=>new Set([...prev, ...onDeckComment]));
  }, [commentCursor,isPlaying]);

  return (
    <div className="theater-comment-panel">
      <h4>{label("commentary")}</h4>
      <CommentFeed comments={[...comments]} theaterController={theaterController} />
    </div>
  );
}

const Comment = ({ com, theaterController }) => {
  const { appController } = theaterController;
  const [addedAt] = useState(Date.now());
  // size between 50% and 70%
  const [width] = useState(`${Math.floor(Math.random() * 20) + 60}%`);

  const isNew = Date.now() - addedAt < 1000;

  useEffect(() => {
    const commentFeed = document.querySelector(".theater-comment-feed");
    if (!commentFeed) return false;

    //if feed is hovered, don't scroll
    if (commentFeed.matches(":hover")) return false;

    commentFeed.scrollTo({ top: commentFeed.scrollHeight, behavior: "smooth" });
  }, [isNew]);

  const sourceId = com.id.toString().substr(5, 3);

  const popUpComment = () => {
    theaterController.pause();
    appController.functions.setPopUp({
      type: "commentary",
      ids: [com.id]
    });
  };

  return (
    <div
      className={`comment ${isNew ? "preloaded" : ""}`}
      onClick={popUpComment}
    >
      <img src={`${assetUrl}/source/square/${sourceId}`} className="avatar" />
      <div className="triangle">{"◀"}</div>
      <div className="comment-text" style={{ width }}>
        <strong>{com.title}</strong> {com.preview}
      </div>
    </div>
  );
};

const CommentFeed = ({ comments, theaterController }) => {
  if (!comments?.length) return null;
  return (
    <div className="theater-comment-feed">
      {comments.map((com, index) => (
        <Comment key={index} com={com} theaterController={theaterController} />
      ))}
    </div>
  );
};

export default TheaterWrapper;

