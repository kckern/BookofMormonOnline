import React, { useState, useEffect, useRef } from "react";
import Parser from "html-react-parser";
import Loader from "../_Common/Loader";
import { useRouteMatch, useHistory, Link } from "react-router-dom";
import { label } from "src/models/Utils";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { toast } from "react-toastify";
import "./Theater.css";
import ReactAudioPlayer from "react-audio-player";
import canAutoplay from 'can-autoplay';

import logo from "src/views/_Common/svg/logo.svg";
import menu from "src/views/User/svg/settings.svg";
import mute from "./svg/mute.svg";
import studyimg from "src/views/_Common/svg/study.svg";
import next from "./svg/next.svg";
import pause from "./svg/pause.svg";
import play from "./svg/play.svg";
import prev from "./svg/prev.svg";
import vol_hi from "./svg/vol_hi.svg";
import vol_lo from "./svg/vol_lo.svg";
import fast from "./svg/fast.svg";
import { determineLanguage, flattenDescription, playSound } from "../../models/Utils";

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



function TheaterWrapper({ appController }) {
  const [queue, setQueue] = useState([]);
  const [queueStatus, setQueueStatus] = useState([]);
  const [cursorIndexArray, setCursorIndexArray] = useState((prev, current) => {
    const [index] = Array.isArray(current) ? current : [0];
    if (!queue.length) return [0, false];
    if (!queue[index]) return prev;
  });
  const [cursorIndex, cursorChangeWasManual] = cursorIndexArray;

  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentDuration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(
    parseFloat(localStorage.getItem("playbackRate")) || 1
  );

  const controls = {
    pause: () => {
      document.getElementById("theater-audio-player")?.pause();
    },
    play: () => {
      document.getElementById("theater-audio-player")?.play();
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
    }
  };

  const theaterController = {
    appController,
    ...controls,
    queue,
    setQueueStatus,
    queueStatus,
    cursorIndex,
    currentProgress,
    currentDuration,
    setCurrentProgress,
    setDuration,
    setIsPlaying,
    isPlaying,
    playbackRate,
    cursorChangeWasManual,
    setPlaybackRate
  };

  useEffect(async () => {
    const items = null//[{slug:"ammon",blocks:[9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25]}];
    const token = localStorage.getItem("token");
    let { queue } = await BoMOnlineAPI(
      { queue: { token, items } },
      { useCache: false }
    );
    queue = (queue||[]).map(item => {
      item.coms = (item?.coms || []).sort((a, b) => {
        //random
        return Math.random() - 0.5;
      });
      return item;
    });
    setQueue(queue);
    setQueueStatus((queue||[]).map(item => item?.status));
  }, []);

  useEffect(() => {
    //determine cursor
    const firstIncompleteItem = queue.findIndex(
      item => item?.status !== "completed"
    );
    theaterController.goto(firstIncompleteItem || 0, "auto");
  }, [queue]);

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

  if (!queue.length) return <Loader />;

  return (
    <div className="theater-wrapper">
      <TheaterMainPanel theaterController={theaterController} />
      <TheaterSidePanel theaterController={theaterController} />
    </div>
  );
}

function TheaterMainPanel({ theaterController }) {
  const { queue, cursorIndex,cursorChangeWasManual } = theaterController;
  const currentItem = queue[cursorIndex] || null;

  const [canAutoPlayState, setCanAutoPlay] = useState(false);

  const thisSection = currentItem?.parent_section?.title || null;
  const prevSection = queue[cursorIndex - 1]?.parent_section?.title || null;
  const isNewSection =  thisSection !== prevSection;
  const isFirstItem = cursorIndex === 0;
  const isLastItem = cursorIndex === queue.length - 1;
  const hasNextContent = !!currentItem?.next;
  const pretype = isFirstItem
    ? "intro"
    : isNewSection
    ? "section"
    : null;
  const posttype = isLastItem ? "outro" : hasNextContent ? "crossroads" : null;

  const initSubCursorIndex = cursorChangeWasManual ? 0 : isNewSection || isFirstItem ? -1 : 0;
  const [subCursorIndex, setSubCursorIndex] = useState(initSubCursorIndex);
  useEffect(()=>{
      setSubCursorIndex(initSubCursorIndex);
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
          <TheaterHeader theaterController={theaterController} />
          <TheaterControls theaterController={theaterController} />
        </>
      )}

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

  return <div className="theater-content-frame theater-queue-intro">

<p style={{
  opacity:0.2,
  /* vertical center */
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  padding: "10%",
  fontStyle: "italic",
  
  }}>{currentItemText}</p>
    <div className={"theater-intro-slide"}>
    <button className="playbutton" onClick={()=>setCanAutoPlay(true)}>
      <img src={play} />
    </button>
      <p>Play</p>
    </div>
  </div>;

}

function TheaterQueueOutro({ theaterController }) {
  const { queue, cursorIndex } = theaterController;
  const currentItem = queue[cursorIndex] || null;


  return <div className="theater-content-frame theater-queue-intro">
    <p>Thanks for studying the Book of Mormon with us!</p>
  </div>;

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
    .filter(item => item);
  const narrationString = flattenDescription(narrations.join(" • "));

  const [part,setPart] = useState(0);

  const pages = [...new Set(queue.map(item => item?.parent_page?.title || null))];
  const lastPage = pages.pop();
  const pageString = pages.length > 1 ? pages.join(", ") + "</em> and <em>" + lastPage : lastPage;

  const sections = [...new Set(queue.map(item => item?.parent_section?.title || null))];
  const sectionString = sections.length > 1 ? sections.slice(0,-1).join(", ") + "</em> and <em>" + sections.reverse()[0] : sections.reverse()[0];


  const passageCount = queue.length;

  return (
    <div className="theater-content-frame theater-queue-intro">
      <div className={"theater-intro-slide " + (part===1 ? "on" : "off") }>
      <p className="presents">Book of Mormon Online <small><em>presents</em></small></p>
      <img src={logo} className="logo" />
      <p>{passageCount} passages from {Parser(`<em>${pageString}</em>`)}</p>
      <p>covering {Parser(`<em>${sectionString}</em>`)}</p>
      </div>
      <div className={"theater-intro-slide section-intro " + (part===2 ? "on" : "off") }>
      <p><span className="pageTitle">{pageTitle}:</span><br/>{sectionTitle}</p>
      <small>{narrationString}</small>
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

  const sectionNarrations = queue
    .filter(
      item => item?.parent_section?.title === currentItem?.parent_section?.title
    )
    .map(item => item?.narration?.description || null)
    .filter(item => item)
    .map(item => flattenDescription(item));

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
        <p className="upnext">up next...</p>
      <p><span className="pageTitle">{pageTitle}:</span><br/>{sectionTitle}</p>
      <small>{narrationString}</small>
      </div>
    </div>
  );
}

function TheaterCrossRoads({ theaterController }) {
  const { queue, cursorIndex } = theaterController;
  const currentItem = queue[cursorIndex] || null;
  const { next } = currentItem || {};

  //add countdown from 10 sec
  const secondsToShow = 4;
  const [countdown, setCountdown] = useState(secondsToShow);
  const [startTimestamp] = useState(Date.now());

  useEffect(() => {

    //interval countdown
    const timer = setInterval(() => {
      const now = Date.now();
      const timePassed = now - startTimestamp;
      const timeLeft = secondsToShow - timePassed/1000;

      setCountdown(Math.round(timeLeft));  // Update countdown

      if(timeLeft <= 0){
        theaterController.goto(cursorIndex + 1,"auto");
        clearInterval(timer);  // Stop interval
      }
    }, 200);

    return () => clearInterval(timer);   // Clean up on unmount

  }, [startTimestamp, cursorIndex, theaterController]);


  return (
    <div className="theater-crossroads">
      <h1>Crossroads</h1>
      {countdown}
      <pre>{JSON.stringify(next)}</pre>
    </div>
  );
}

function TheaterSidePanel({ theaterController }) {
  return (
    <div className="theater-side-panel">
      <div className="theater-people-image-panel">
      <TheaterPeoplePlacePanel theaterController={theaterController} />
      <TheaterImagePanel theaterController={theaterController} />
      </div>
      <TheaterCommentFeed theaterController={theaterController} />
    </div>
  );
}

function TheaterHeader({ theaterController }) {

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(()=>setVisible(true),100);
  }, []);

  return (
    <div className={"theater-header" + (visible ? " visible" : "")}>
      <TheaterSuperTitles theaterController={theaterController} />
    </div>
  );
}

function TheaterControls({ theaterController }) {

  const {
    queue,
    setQueueStatus,
    cursorIndex,
    setCurrentProgress,
    setDuration,
    hasNextContent,
    setSubCursorIndex,
    currentDuration
  } = theaterController;



  const [playerCanPlay, setPlayerCanPlay] = useState(false);



  const currentItem = queue[cursorIndex] || null;
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if(!currentItem) return;
    setTimeout(() => setIsVisible(true), 100);

    setPlayerCanPlay(false);
  }, [currentItem]);


  useEffect(() => {
    const player = document.getElementById("theater-audio-player");
    if (!player) return;
    player.playbackRate = theaterController.playbackRate;
    player.play();
  }, [playerCanPlay]);

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
    if (progress > 85 && !currentItem?.logged) {
      currentItem.logged = true;
      logItem();
    }
  };

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

    //get updated status
    const queueitems = loadQueueItemsFromQueue(queue);
    const { queuestatus } = await BoMOnlineAPI(
      { queuestatus: { token, items: queueitems } },
      { useCache: false }
    );
    if (!queuestatus?.map) return false;
    const newStatus = queuestatus?.map(item => item?.status) || null;
    if(!newStatus) return;

    setQueueStatus(newStatus);
  };

  const isLastItem = cursorIndex === queue.length - 1;

  return (
    <div className={"theater-controls"+(isVisible ? " visible" : "")}>
      <TheaterProgressBar theaterController={theaterController} />
      <ReactAudioPlayer
        id="theater-audio-player"
        src={url}
        controls
        playbackRate={theaterController.playbackRate}
        onPause={() => theaterController.setIsPlaying(false)}
        onPlay={() => {
          theaterController.setIsPlaying(true);
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

  const { queue, cursorIndex } = theaterController;
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
    player.play();
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
    const playerToFadeIn = document.getElementById(`theater-music-player-${activeSide}`);
    playerToFadeIn.play();
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
      onCanPlay={()=>{
        const isPLaying = document.getElementById(`theater-music-player-a`)?.paused;
        if(isPLaying) return;
        const isActive = activeSide==="a";
        if(isActive) return;
        document.getElementById(`theater-music-player-a`)?.play();
      }}
    />
    <ReactAudioPlayer
      id="theater-music-player-b"
      src={`${assetUrl}/audio/music/${trackB}`}
      volume={0.1}
      onCanPlay={()=>{
        const isPLaying = document.getElementById(`theater-music-player-a`)?.paused;
        if(isPLaying) return;
        const isActive = activeSide==="a";
        if(isActive) return;
        document.getElementById(`theater-music-player-a`)?.play();
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
      const narrationEl = document.querySelector(".theater-super-title-narration");
      const activeEl = narrationEl.querySelector(".active");
      if(!activeEl) return;
      const top = activeEl.offsetTop;
      //scroll to vertical center -minus half height of li
      const scrollTo = top - narrationEl.offsetHeight/2 + activeEl.offsetHeight/2;
      narrationEl.scrollTo({top:scrollTo, behavior:"smooth"});

    },[narrationIndex])


    if (!currentItem) return null;
  return (
    <div className="theater-super-title-narration">{narrationUL}</div>
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
  //stip comment and image blocks: [c]1234[/c] and [i]1234[/i]
  content = prepareContent(content);

  const computePosition = progress => {
    return progress;
  };

  const yPosition = computePosition(currentProgress);

  let opacity = 1;

  const timeElapsed = (currentProgress / 100) * currentDuration;

  //fade in and out in first and last 3 seconds
  const secondsBuffer = 2;
  if (timeElapsed < secondsBuffer) opacity = timeElapsed / secondsBuffer;
  if (timeElapsed > currentDuration - secondsBuffer)
    opacity = (currentDuration - timeElapsed) / secondsBuffer;


  const isFirst = cursorIndex === 0;
  const isLast = cursorIndex === queue.length - 1;

  return (
    <div className={`theater-content-frame ${state}`}>
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

function TheaterSuperTitles({ theaterController }) {
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

  const StudyButton = <Link className="studylink" to={`/${currentItem?.slug}`}><img src={studyimg} />Study</Link>

  return (
    <div className="theater-super-titles">
      <div className="theater-super-title-left">
        <div className="theater-super-title-heading">{heading}{StudyButton}</div>
        <div className="theater-super-title-section">{section}</div>
        <div className="theater-super-title">{page}</div>
      </div>
      <div className="theater-super-title-right">
        <TheaterNarration theaterController={theaterController} />
      </div>
    </div>
  );
}

function TheaterQueueIndicator({ theaterController }) {
  let { queue, cursorIndex, queueStatus } = theaterController;
  queue = Array.isArray(queue) ? queue : [];
  return (
    <div className="theater-queue-indicator">
      {(queue||[]).map((_, index) => {
        const status = queueStatus[index] || queue[index]?.status || null;
        return (
          <div
            onClick={() => theaterController.goto(index, "manual")}
            className={`theater-queue-indicator-item ${status || ""} ${
              index === cursorIndex ? "active" : ""
            }`}
            key={index}
          ></div>
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
  return (
    <div className="theater-progress-bar-container">
      <div className="theater-progress-bar-buttons left">
        <img src={playpause} className="player-ui" onClick={playpauseFN} />
      </div>
      <div className="theater-progress-bar" onClick={seekTo}>
        <ProgressBar percent={currentProgress} />
      </div>
      <div className="theater-progress-bar-buttons right">
        <div>
          <div className="playbackRateIcon" onClick={cyclePlaybackSpeed}>
            {rateString}
          </div>
        </div>
        <img src={menu} className="player-ui" onClick={() => {}} />
      </div>
    </div>
  );
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
    currentProgress,
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

      const name = item?.name.replace(/[0-9]/g, "<sup>$&</sup>");
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

  return (
    <div
      className={
        `theater-people-place-panel ${classHide} item-count-` + visibleItemCount
      }
    >
      <h4>{label("people_and_places")}</h4>
      <div className="theater-people-place-items">{peoplePlaceEl}</div>
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
    <div>
      <img
        src={`${assetUrl}/art/${image.id}`}
        style={{
          transform: `scale(${scale})`,
          opacity
        }}
      />

      <div className="imageCaption" style={{ opacity }}>
        {image.title}
      </div>
    </div>
  ) : null;

  return (
    <div className={"theater-image-panel " + classHide}>
      <h4>{label("art")}</h4>
      <div className="theater-image-container">{imgEl}</div>
    </div>
  );
}

function TheaterCommentFeed({ theaterController }) {
  const [comments, setComments] = useState([]);
  const secondsBetweenComments = 5;
  const {
    queue,
    cursorIndex,
    currentProgress,
    currentDuration,
    cursorChangeWasManual
  } = theaterController;
  const currentItem = queue[cursorIndex] || null;
  const coms = currentItem?.coms || [];
  const filteredcoms = coms.filter(com => {
    const sourceId = com.id.toString().substr(5, 3);
    if (!com.preview?.trim()) return false;
    if ([41, 161, 162, 163, 164, 165, 166].includes(parseInt(sourceId)))
      return false;
    return true;
  });
  const allowedMessageCount = currentDuration / secondsBetweenComments;
  const queuedMessages = filteredcoms.slice(0, allowedMessageCount); //randomized earlier
  const commentCursor = Math.floor(
    (queuedMessages.length * currentProgress) / 100
  );

  useEffect(async () => {
    //wait 1-3 seconds
    await new Promise(resolve =>
      setTimeout(resolve, 1000 + Math.random() * 2000)
    );
    if (!queuedMessages.length) return;
    if (!queuedMessages[commentCursor]) return;
    const onDeckComment = queuedMessages[commentCursor];
    setComments([...comments, onDeckComment]);
  }, [commentCursor]);

  return (
    <div className="theater-comment-panel">
      <h4>{label("commentary")}</h4>
      <CommentFeed comments={comments} theaterController={theaterController} />
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