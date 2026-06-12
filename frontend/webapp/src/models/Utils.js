import React, { useState, useEffect, useCallback } from "react";
import crypto from "crypto-browserify";
import date from "date-and-time";
import axios from "axios";
import Parser, {domToReact} from "html-react-parser";
import moment from "moment";
import "moment/locale/ko";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { getCache, setCache } from "./Cache";
import {Spinner} from "../views/_Common/Loader";
import { ScripturePanelSingle } from "../views/Page/Narration";
import { detectReferences, lookupReference, generateReference } from 'scripture-guide';
import { generateAvatarUrl } from "src/components/UserAvatar";



export function determineLanguage() {
  const isLocalhost = window.location.host.includes("localhost");
  if(isLocalhost) return "en";
  let subdomain = window.location.host.split(".").shift();
  let tld = window.location.host.split(".").pop();
  
  let aliases = {
    ko: ["kr", "kor"],
    fr: ["fra", "fre"],
    de: ["ger", "deu"],
    es: ["spa","lat"],
    hi: ["hin"],
    eo: ["epo"],
    vn: ["vina", "viet", "vie"],
    swe: ["se", "sv", "swe"],
    pt: ["por"],
    jp: ["jpn"],
    tgl: ["phil", "ph"],
    tr: ["tur", "trk"],
    ru: ["rus","рф","xn--p1ai"],
    slv: ["slv","slo","si"],

    //english editions
    rlds: ["coc","rlds"],
    covoc: ["covoc","cc"],
    str: ["street","streetlegal"],
    plain: ["plain","plainenglish"],
    easy: ["easy","easytoread","erb"],
    concise: ["concise","ctb"],

  };
  let index = {};
  Object.keys(aliases).forEach(i => { index[i] = i; Object.keys(aliases[i]).forEach(j => index[aliases[i][j]] = i); });

  // If subdomain is "app", use browser language preferences
  if(subdomain === "app") {
    const browserLang = navigator.language || navigator.languages?.[0] || "en";
    const langCode = browserLang.split("-")[0].toLowerCase(); // Extract language code (e.g., "en" from "en-US")
    return index[langCode] || langCode || "en"; // Map through aliases, fallback to original code, then "en"
  }
  subdomain = index[subdomain] || null;
  tld = index[tld] || null;
  return tld || subdomain || "en";
}
const pickOneRamdomly = (arr) => {

  const selectedIndex = Array.from(Array(arr.length).keys()).sort(() => Math.random() - 0.5).pop();
  return arr[selectedIndex];
}

// Single avatar generator — canonical implementation lives in
// components/UserAvatar.js (mirrored by backend/src/messaging/avatarAssets.ts).
export function genUserAvatar(user_id) {
  return generateAvatarUrl(user_id);
}



export function tokenImage() {
  const token = localStorage.getItem("token");
  return genUserAvatar(token);
}

export function chronoLabel(string) {
  if (!string) return null;
  //split the tailing digits
  let [label_id, num, info] = string.split("|");
  if (!label_id) return null;
  if (info) return label(label_id, [num, info]);
  if (num) return label(label_id, [num]);
}

export function label(key, inserts) {
  if (inserts && !Array.isArray(inserts)) inserts = [inserts];
  if (!inserts) inserts = [];
  if (!global.dictionary) return " ";
  if (!global.dictionary[key] && inserts[0] === -1) return "";
  if (!global.dictionary[key]) return key;
  let parts = global.dictionary[key].split(/\$(\d+)/);
  let results = [];
  for (let x in parts) {
    let part = parts[x];
    let i = parseInt(part);
    if (i && inserts?.[i - 1]) results.push(inserts?.[i - 1]);
    else results.push(part);
  }
  if (results.length === 1) return results.shift();
  results = results.filter((x) => !!x);
  let allstrings = results.every((i) => typeof i === "string" || typeof i === "number");
  if (allstrings) return results.join("");
  return results.filter((x) => !!x);
}

export function getUsersFromTextInput(appController, text) {
  if (!text) return [];
  let findedUsers = [];
  appController.states.studyGroup.activeGroup.members.forEach((member) => {
    text.includes(member.nickname) && findedUsers.push(member.userId);
  });
  return findedUsers;
}

export function makeLabelDictionary(r, fromCache = false) {
  if (!r.labels || r.labels?.length === 0) return r;
  let labelData = r.labels;
  const isKeyVal = labelData?.[0]?.key && labelData?.[0]?.val;
  let dictionary = !isKeyVal
    ? labelData
    : Object.values(labelData).reduce((obj, item) => {
        obj[item.key] = item.val;
        return obj;
      }, {});

  r.labels = dictionary;
  //save dictionary to indexedDB as json array, key label.dictionary
  if (!fromCache) setCache({ "label.dictionary": dictionary });
  global.dictionary = dictionary;
  return r;
}

export function md5() {
  return crypto
    .createHash("md5")
    .update(crypto.randomBytes(20).toString("hex"))
    .digest("hex");
}
export function md5hash(string) {
  return crypto
    .createHash("md5")
    .update(string)
    .digest("hex");
}

export function moveCaretToEnd(el) {
  if (typeof el.selectionStart == "number") {
    el.selectionStart = el.selectionEnd = el.value.length;
  } else if (typeof el.createTextRange != "undefined") {
    el.focus();
    var range = el.createTextRange();
    range.collapse(false);
    range.select();
  }
}

export function processName(name) {
  return replaceNumbers(
    name
      ?.split(",")
      .reverse()
      .join(" "),
  );
}

export function replaceNumbers(str) {
  if (!str) return "";
  var reps = {
    1: "¹",
    2: "²",
    3: "³",
    4: "⁴",
  };

  return str.replace(/[1-4]/g, (s) => reps[s] || s);
}

export function testJSON(text) {
  if (typeof text !== "string") {
    return false;
  }
  try {
    let r = JSON.parse(text);
    return r;
  } catch (error) {
    return false;
  }
}

export function flattenDescription(text, highlights) {
  if (!text) return null;
  text = text.replace(/{(.*?)\|(.*?)}/g, "$1");
  text = text.replace(/\[(.*?)\|(.*?)\]/g, "$1");
  return renderHTMLContentInFeed(text, highlights);
}

export function renderHTMLContentInFeed(content, highlights) {
  if (!content) content = "";
  content = content.replace(/\[([a-z])\]([0-9]+?)\[\/[a-z]\]/g, "");
  content = content.replace(/\[quote\](.*?)\[\/quote\]/g, " ");
  if (!highlights) highlights = [];

  highlights = highlights.map((string) => {
    return { class: "highlightInFeed", string: string };
  });

  //Process Highlights
  let highlighted = "";
  for (var i in highlights) {
    let highlight = highlights[i];
    let string = highlight.string.replace(/[()]/gi, ".");
    var re = [];

    //sanitize string for regex
    string = string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

    re.push(new RegExp("\\b(" + string + ")\\b", "gi"));
    for (let i = 4; i >= 1; i--) {
      let start = string
        .match(new RegExp(`^(\\S+\\s){${i}}`, "gi"))
        ?.shift()
        .trim();
      let end = string
        .match(new RegExp(`(\\s\\S+){${i}}\\s*$`, "gi"))
        ?.shift()
        .trim();
      if (start && end)
        re.push(new RegExp("(" + `${start}.*?${end}` + ")", "gi"));
    }
    if (highlighted.match(re)) continue;
    highlighted += highlight.string;
    let regex = null;
    for (let i in re) {
      regex = re[i];
      if (regex.test(content)) break;
    }
    content = content.replace(regex, (string) => {
      return (
        '<span class="highlight ' +
        highlight.class +
        '">' +
        string.trim() +
        "</span>"
      );
    });
  }

  content = content.replace(/_/g, '<span class="indent"></span>');
  content = content.replace(/\s+/g, " ");
  if(/bl<span/.test(content)) return content;
  try{
    return Parser(content);
  }
  catch(e){
    return content;
  }
    
}

export function BlankWord() {
  const [key] = useState(crypto.randomBytes(20).toString("hex"));
  const [width] = useState(Math.round(1 + Math.random() * 8));

  return (
    <span key={key} className="blankWord" style={{ width: width + "em" }}>
      °
    </span>
  );
}

export function BlankParagraph({ min, max }) {
  const [words] = useState(
    new Array(Math.round(min + Math.random() * (max - min))).fill(
      <BlankWord />,
    ),
  );

  return (
    <div className="blankP">
      {words.map((w, i) => (
        <React.Fragment key={i}>{w}</React.Fragment>
      ))}
    </div>
  );
}

export function timeAgoString(unixTimestamp) {
  if (unixTimestamp === 0) return label("never");

  let now = Math.round(Date.now() / 1000);
  moment.locale(label("moment_locale"));
  if (now - unixTimestamp < 60 * 60 * 25 * 5)
    return moment.unix(unixTimestamp).fromNow();

  let timestamp = date.format(
    new Date(unixTimestamp * 1000),
    label("time_ago_date_format"),
  ); //'ddd, DD MMM YYYY [at] h:mma'

  return timestamp;
}

export function snapSelectionToWord() {
  var sel;

  // Check for existence of window.getSelection() and that it has a
  // modify() method. IE 9 has both selection APIs but no modify() method.
  if (window.getSelection && (sel = window.getSelection()).modify) {
    sel = window.getSelection();
    if (!sel.isCollapsed) {
      // Detect if selection is backwards
      var range = document.createRange();
      range.setStart(sel.anchorNode, sel.anchorOffset);
      range.setEnd(sel.focusNode, sel.focusOffset);
      var backwards = range.collapsed;
      range.detach();

      // modify() works on the focus of the selection
      var endNode = sel.focusNode,
        endOffset = sel.focusOffset;
      sel.collapse(sel.anchorNode, sel.anchorOffset);
      if (backwards) {
        sel.modify("move", "backward", "character");
        sel.modify("move", "forward", "word");
        sel.extend(endNode, endOffset);
        sel.modify("extend", "forward", "character");
        sel.modify("extend", "backward", "word");
      } else {
        sel.modify("move", "forward", "character");
        sel.modify("move", "backward", "word");
        sel.extend(endNode, endOffset);
        sel.modify("extend", "backward", "character");
        sel.modify("extend", "forward", "word");
      }
    }
  } else if ((sel = document.selection) && sel.type !== "Control") {
    var textRange = sel.createRange();
    if (textRange.text) {
      textRange.expand("word");
      // Move the end back to not include the word's trailing space(s),
      // if necessary
      while (/\s$/.test(textRange.text)) {
        textRange.moveEnd("character", -1);
      }
      textRange.select();
    }
  }
}

export function findAncestor(el, sel) {
  while (
    (el = el?.parentElement) &&
    !(el?.matches || el?.matchesSelector).call(el, sel)
  );
  return el;
}

export function newPost(num) {
  //https://jenkins.kckern.info/buildByToken/buildWithParameters?job=BoMOnline_Posts&token=b97541afa471d&NUM=3

  axios.get(
    "https://jenkins.kckern.info/buildByToken/buildWithParameters?job=BoMOnline_Posts&token=b97541afa471d&NUM=" +
      num,
  );
}

export function replies() {
  axios.get(
    "https://jenkins.kckern.info/buildByToken/buildWithParameters?job=BoMOnline_Replies&token=b97541afa471d",
  );
}

export function getCoords(elem) {
  // crossbrowser version
  if (!elem) return { top: 0, left: 0 };
  var box = elem?.getBoundingClientRect();

  var body = document.body;
  var docEl = document.documentElement;

  var scrollTop = window.pageYOffset || docEl.scrollTop || body.scrollTop;
  var scrollLeft = window.pageXOffset || docEl.scrollLeft || body.scrollLeft;

  var clientTop = docEl.clientTop || body.clientTop || 0;
  var clientLeft = docEl.clientLeft || body.clientLeft || 0;

  var top = box.top + scrollTop - clientTop;
  var left = box.left + scrollLeft - clientLeft;

  return { top: Math.round(top), left: Math.round(left) };
}

export function generateFakeProgressData(userIds) {
  return Promise.resolve("Success").then(
    function(value) {
      if (!Array.isArray(userIds)) return [];
      let startedDaysAgo = 20 + Math.floor(Math.random() * 100);
      return userIds.map((user_id) => {
        let current = Math.round(Math.random() * 10000) / 100;
        let cursor = new Date();
        cursor.setDate(cursor.getDate() - startedDaysAgo);

        let dateList = [];

        for (let i = startedDaysAgo; i >= 0; i--) {
          cursor.setDate(cursor.getDate() + 1);
          let dateString = cursor.getTime();
          dateList.push(dateString);
        }

        let progress = [];
        for (let i = 0; i < dateList.length; i++) {
          progress.push([
            dateList[dateList.length - i - 1],
            Math.round(current * 100) / 100,
          ]);
          current -= Math.round(Math.random() * 300) / 100;
          if (current < 0) current = 0;
        }
        return {
          user_id: user_id,
          progress: progress.reverse(),
        };
      });
    },
    () => {},
  );
}

// Hook
export function useWindowSize() {
  // Initialize state with undefined width/height so server and client renders match
  // Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
  const [windowSize, setWindowSize] = useState({
    width: undefined,
    height: undefined,
  });
  useEffect(() => {
    // Handler to call on window resize
    function handleResize() {
      // Set window width/height to state
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    // Add event listener
    window.addEventListener("resize", handleResize);
    // Call handler right away so state gets updated with initial window size
    handleResize();
    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Empty array ensures that effect is only run on mount
  return windowSize;
}

export async function channelAtAGlance(channel) {
  let room = channel.room;
  let onsite = [],
    ingroup = [],
    incall = [];
  channel.members.filter((m) => {
    if (m.connectionStatus === "online") {
      m.metaData.activeGroup && onsite.push(m);
      m.metaData.activeGroup === channel.url && ingroup.push(m);
      m.metaData.activeCall === room?.roomId && incall.push(m);
    }
    return true;
  });
  //console.log("channelAtAGlance",channel.name,{call:room?._participantCollection})
  let incallNum =
    (parseInt(room?._participantCollection?._remoteParticipants?.length) || 0) +
    (room?.localParticipant ? 1 : 0);
  return {
    unread: channel.unreadMessageCount,
    members: channel.joinedMemberCount,
    onsite: onsite.length,
    ingroup: ingroup.length,
    incall: incallNum,
    loaded: true,
  };
}

export function objectFlip(obj) {
  const ret = {};
  Object.keys(obj).forEach((key) => {
    ret[obj[key]] = key;
  });
  return ret;
}

export function getDaysArray(start, end) {
  for (
    var arr = [], dt = new Date(start);
    dt <= end;
    dt.setDate(dt.getDate() + 1)
  ) {
    arr.push(new Date(dt));
  }
  return arr;
}

export function diffMap(oldMap, newMap) {
  let oldKeys = Object.keys(oldMap);
  let newKeys = Object.keys(newMap);
  let keys = dedupeArray(oldKeys.concat(newKeys)).sort();

  let diff = {};
  for (let i in keys) {
    let key = keys[i];
    let oldVal = oldMap[key] || null;
    let newVal = newMap[key] || null;
    if (oldVal === newVal) continue;
    diff[key] = { oldVal, newVal };
  }
  return diff;
}

export function dedupeArray(a) {
  for (var i = 0; i < a.length; ++i) {
    for (var j = i + 1; j < a.length; ++j) {
      if (a[i] === a[j]) a.splice(j--, 1);
    }
  }

  return a;
}

export function truncate(text, startChars, endChars, maxLength) {
  if (text.length > maxLength) {
    var start = text.substring(0, startChars);
    var end = text.substring(text.length - endChars, text.length);

    return start.trim() + "⋯" + end.trim();
  }
  return text;
}

export function refreshChannel(channel, appController) {
  if (channel.memberCount === 0) return;
  return channel.refresh().then((fresh) => {
    try {
      appController.sendbird
        ?.fetchRoomFromGroup(fresh, "refreshChannel")
        .then((room) => {
          fresh.room = room;
          appController.functions.updateListedStudyGroup(fresh);
          return fresh;
        });
    } catch (e) {
      console.log("refreshChannel", e);
    }
  });
}

export function log({ appController, key, val }) {
  BoMOnlineAPI(
    {
      log: {
        token: appController.states.user.token,
        key: key,
        val: val,
      },
    },
    { useCache: false },
  );
}

export function playSound(sound) {
  if (!sound) return true;
  try {
    // sound.play()
    const promise = sound.play();

    if (promise !== undefined) {
      promise.then(() => {}).catch((error) => console.error);
    }
  } catch (err) {}
}

export function formatText(message, setPanel, appController, isSection) {
  if (message.length === 0) return false;
  if (message.mentionedUsers.length > 0) {
    let newText = message.message;
    message.mentionedUsers.forEach((mentionUser) => {
      newText = newText.replaceAll(
        "@" + mentionUser.nickname,
        `<a className="tagUser" id=${mentionUser.userId} nickName=${mentionUser.nickname}>${mentionUser.nickname}</a>`,
      );
    });

    return Parser(newText, {
      replace: (domNode) => {
        if (domNode.attribs && domNode.attribs.classname === "tagUser") {
          return (
            <a
              className={domNode.attribs.classname}
              onClick={() => {
                if (isSection) {
                  appController.functions.openGroupList(
                    !appController.states.studyGroup.isGroupListOpen,
                  );
                  appController.functions.openDrawer({
                    key: "message",
                    val: domNode.attribs.id,
                  });
                } else {
                  setPanel({ key: "message", val: domNode.attribs.id });
                }
              }}
            >
              {domNode.children[0].data}
            </a>
          );
        }
      },
    });
  } else {
    return ParseMessage(message.message);
  }
}

// Avatar load-failure fallback: when a profile image 404s (missing S3 upload,
// retired Sendbird/dicebear-v1 host, etc.) swap to the canonical neutral
// `thumbs` avatar (genUserAvatar) seeded by the user_id hash embedded in the
// failed URL (profiles/<user_id>.jpg, <hash>.svg, …). NOT personas — that style
// is gendered (facial hair/hairstyles). Idempotent + loop-guarded so a fallback
// failure can't re-fire.
export function breakCache({ currentTarget }) {
  if (!currentTarget || currentTarget.dataset.avatarFallback) return;
  currentTarget.dataset.avatarFallback = "1";
  const match = /([0-9a-f]{8,})(?:\.\w+)?(?:[?#].*)?$/i.exec(currentTarget.src || "");
  const seed = match ? match[1] : "user";
  currentTarget.src = genUserAvatar(seed);
}
export async function getFwdUrl(url) {
  console.log("Url", url);
  return fetch(url)
    .then((r) => r)
    .then((data) => data.url.replace(/\?.*?$/, ""))
    .catch((err) => {
      throw new Error(err);
    });
}

export function clickyUser(userData) {
  var clicky_custom = window.clicky_custom || {};
  clicky_custom.visitor = userData;
  window.clicky?.custom_data();
  window.clicky?.goal("signin");
}

export function isMobile() {
  return ((window.innerWidth <= 900));
}


export function ParseMessage(string,appController) {
  const [{ html, urls, scriptures }] = useState(replaceURLWithHTMLLinks(string,appController));
  const [activeRef, setActiveRef] = useState(null);
  if (typeof string !== "string") return string;
  const options = {
    replace: ({ name, attribs, children }) => {
      if (name === 'a' && attribs.classname === 'scripture_link') {
        const ref = domToReact(children, options);
        const refIndex = scriptures.indexOf(ref);
        //replace classname with class
        attribs.class = attribs.classname;
        delete attribs.classname;
        const isActive = activeRef === refIndex;
        if (isActive) attribs.class += " active";
        const activateRef = () => {
          setActiveRef(refIndex);
        }
        return <a {...attribs} onClick={activateRef}>{ref}</a>;
      }
    }
  };

  return (
    <>
      {Parser(html, options)}
      <ScripturesContainer scriptures={scriptures} setActiveRef={setActiveRef} activeRef={activeRef} />
      <LinkPreviewContainer urls={urls} appController={appController} />
    </>
  );
}

function ScripturesContainer({ scriptures, setActiveRef, activeRef }) {
  if(!scriptures?.length) return null;
  //normalize references
  const lang = determineLanguage();
  scriptures = scriptures.map(scripture => lookupReference(scripture, lang).verse_ids).map(verse_ids => generateReference(verse_ids, lang));
  scriptures = [...new Set(scriptures)];
  return <div className="scriptureContainerWrapper">
    {(scriptures.length > 1) && <div className="scripturePanel">
      {scriptures.map((scripture, i) =>
      <div key={i} className={"scriptureItem" + (activeRef === i ? " active" : "")} onClick={() => setActiveRef(i)}>{scripture}</div>)}
    </div>}
    <ScripturePanelSingle scriptureData={{ref:scriptures[activeRef]}}/>
  </div>
}

function LinkPreviewContainer({ urls,appController }) {
  if (!urls) return null;

  return urls.map((url) => <LinkPreview key={url} url={url} appController={appController}/>);
}


function CommentaryPreview({url,appController}){
  const commentaryId = url.split("/").pop();
  const [commentary, setCommentary] = useState(null);
  const [error,setError] = useState(null);
  useEffect(() => {
    if(!commentaryId) return;
    BoMOnlineAPI({commentary:commentaryId}).then(data => {
      setCommentary(data.commentary);
    }).catch(err => {
      setError(err?.message || JSON.stringify(err));
    });
  }, []);
  if(!commentary) return error ? <code>{commentaryId} | {error}</code> : <Spinner />;

  const source_id = commentaryId.toString().slice(-5).slice(0,3);
  const {title, reference, publication, location, text:html} = commentary[commentaryId] || {};
  const {source_title, source_name, source_short, source_url, source_year, source_publisher} = publication || {};
  const text = Parser(html);

  const popUpCommentary = () => {
    appController.functions.setPopUp({
      type: "commentary",
      underSlug: window.location.href.replace(/^.*?\/\/.*?\//, ""),
      ids: [commentaryId.toString()],
      popUpData: commentary});
  };


  return <div className="commentaryPreview" onClick={popUpCommentary}>
    <img src={`${assetUrl}/source/cover/${source_id}`} />
    <div className="commentaryPreviewContent">
      <div className="commentaryPreviewContentTitle">{title}</div>
      <div className="commentaryPreviewContentText">{text}</div>
      <div className="commentaryPreviewContentSource">{source_name}: {source_title}</div>
    </div>
  </div>
}


function LinkPreview({ url,appController }) {
  const fetcher = async (url) => {
    const apikey = "1ac77035736dd239dee7958f10930622";
    const hash = "link." + md5hash(url);
    const cached = await getCache({ [hash]: true });
    const found = cached.found;
    const key = Object.keys(found).shift();
    if (cached.found[key]) return cached.found[key];

    const response = await fetch("https://api.linkpreview.net", {
      method: "POST",
      body: `key=${apikey}&q=${url}`,
    });
    const json = await response.json();
    if (!json?.title) return null;
    const returnObj = [];
    returnObj[hash] = {
      title: json.title,
      description: json.description,
      image: json.image,
      hostname: json.url.split("/")[2].replace(/^www\./, ""),
      url: json.url,
    };

    setCache(returnObj);
    return returnObj[hash];
  };
  const [linkData, setLinkData] = useState(null);
  const [hasImage, setHasImage] = useState(true);
  useEffect(() => {
    fetcher(url).then((data) => setLinkData(data));
  }, []);

  //check if commentary. TODO: Check domain
  if(/commentary\/\d+$/.test(url)) return <CommentaryPreview url={url} appController={appController} />



  if (!linkData) return null;
  if (!linkData.title) return null;

  return (
    <a
      href={linkData.url}
      target="_blank"
      className="linkPreviewA"
      rel="noreferrer"
    >
      <div className="linkPreview">
        {linkData.image && hasImage && (
          <div className="linkPreviewImg">
            <img onError={() => setHasImage(false)} src={linkData.image} />
          </div>
        )}
        <div className="linkPreviewText">
          <h3>{linkData.title}</h3>
          <p>{linkData.description}</p>
          <div>
            <span>{linkData.siteName}</span>
            <span>{linkData.siteName && linkData.hostname && " • "}</span>
            <span>{linkData.hostname}</span>
          </div>
        </div>
      </div>
    </a>
  );
}

function replaceURLWithHTMLLinks(text) {
  if (typeof text.replace !== "function") return text;
  const exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;$]*[-A-Z0-9+&@#\/%=~_|])/gi;
  let html = text.replace(
    exp,
    (match) => urlHTML(match),
  );
  const urls = text.match(exp) || [];

  const lang = determineLanguage();

  let scriptures = [];
  html = detectReferences(html, (scripture) => {
    if (!scripture) return;
    scriptures.push(scripture);
    return `<a className="scripture_link">${scripture}</a>`
  }, lang,
  );
  //dedupe
  scriptures = [...new Set(scriptures)];

  return { html, urls, scriptures }



}


function urlHTML(url,force) {
  const isCommentary = /commentary\/\d+$/.test(url);
  if(isCommentary && !force) return "";
  return `<a target='_blank' href='${url}'>${friendlyUrl(url)}</a>`;
}


function friendlyUrl(url) {
  url = url.replace(/^.*?\/\//, "");
  url = url.replace(/^www./, "");
  url = decodeURI(url);
  url = start_and_end(url);
  return url;
}

function start_and_end(str) {
  if (str.length > 60) {
    return str.substr(0, 50) + "..." + str.substr(str.length - 10, str.length);
  }
  return str;
}


export function useSwipe(input){
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
      setTouchEnd(0); // otherwise the swipe is fired even with usual touch events
      setTouchStart(e.targetTouches[0].clientX);
  }

  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
      if (!touchStart || !touchEnd) return;
      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;
      if (isLeftSwipe) {
          input.onSwipedLeft();
      }
      if (isRightSwipe) {
          input.onSwipedRight();
      }
  }

  return {
      onTouchStart,
      onTouchMove,
      onTouchEnd
  }
}





export const convertRomanNumeralToInt = (num) => {
  const isAlreadyInt = typeof num === "number";
  if (isAlreadyInt) return num;
  const isAlreadyNumericString = /^\d+$/.test(num);
  if (isAlreadyNumericString) return parseInt(num);
  const romanNumeralMap = [
    { numeral: "M", value: 1000 },
    { numeral: "CM", value: 900 },
    { numeral: "D", value: 500 },
    { numeral: "CD", value: 400 },
    { numeral: "C", value: 100 },
    { numeral: "XC", value: 90 },
    { numeral: "L", value: 50 },
    { numeral: "XL", value: 40 },
    { numeral: "X", value: 10 },
    { numeral: "IX", value: 9 },
    { numeral: "V", value: 5 },
    { numeral: "IV", value: 4 },
    { numeral: "I", value: 1 },
  ];

  let result = 0;
  let number = num.toUpperCase();

  for (let i = 0; i < romanNumeralMap.length; i++) {
    const { numeral, value } = romanNumeralMap[i];
    while (number.indexOf(numeral) === 0) {
      result += value;
      number = number.replace(numeral, "");
    }
  }
  return result;

}


export const convertIntToRomanNumeral = (int, lowercase=false) => {
  int = Math.abs(int);
  const romanNumeralMap = [
    { numeral: "M", value: 1000 },
    { numeral: "CM", value: 900 },
    { numeral: "D", value: 500 },
    { numeral: "CD", value: 400 },
    { numeral: "C", value: 100 },
    { numeral: "XC", value: 90 },
    { numeral: "L", value: 50 },
    { numeral: "XL", value: 40 },
    { numeral: "X", value: 10 },
    { numeral: "IX", value: 9 },
    { numeral: "V", value: 5 },
    { numeral: "IV", value: 4 },
    { numeral: "I", value: 1 },
  ];

  let result = "";
  let number = int;

  for (let i = 0; i < romanNumeralMap.length; i++) {
    const { numeral, value } = romanNumeralMap[i];
    result += numeral.repeat(Math.floor(number / value));
    number %= value;
  }
  if(lowercase) result = result.toLowerCase();
  return result
}