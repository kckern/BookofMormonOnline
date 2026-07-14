import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import Textarea from "react-expanding-textarea";
import { Button } from "reactstrap";
import crypto from "crypto-browserify";
import ReactTooltip from "react-tooltip";
import TagList from "./TagList";
import "views/_Common/Study/Study.css";
import UserAvatar from "src/components/UserAvatar";
import { shapeReacters } from "src/models/messengerShapes";
import {
  timeAgoString,
  moveCaretToEnd,
  label,
  objectFlip,
  getUsersFromTextInput,
  formatText,
  breakCache,
  isMobile,
  ParseMessage,
  MAX_MESSAGE_LENGTH,
} from "src/models/Utils";
import Parser from "html-react-parser";
import { useAppController } from "src/contexts/AppControllerContext";

// Fire a click-equivalent handler on Enter/Space so role="button" divs are
// operable by keyboard. preventDefault on Space stops the page from scrolling.
const activateOnKey = (handler) => (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
    handler(e);
  }
};

export default function Comments({
  isOpen,
  pageController,
  linkData,
  highlights,
  removeHighlight,
  setCommentHighlights,
  isQuote = false,
}) {
  const appController = useAppController();
  const inputRef = useRef(null);
  useEffect(() => {
    if ((!highlights || highlights.length) === 0 && setAddComments)
      setAddComments(false);
  }, [highlights]);
  const [threadInputVal, setThreadInputVal] = useState(null);
  const [addComments, setAddComments] = useState(false);
  const [threadHash] = useState(
    crypto
      .createHash("md5")
      .update(crypto.randomBytes(20).toString("hex"))
      .digest("hex"),
  );
  const [locationHash] = useState(
    crypto
      .createHash("md5")
      .update(crypto.randomBytes(20).toString("hex"))
      .digest("hex"),
  );

  useEffect(() => {
    if (document.getElementById(threadHash)?.value.length || 0 > 0)
      setAddComments(true);
  }, [document.getElementById(threadHash)?.value.length]);

  if (!appController?.states?.studyGroup?.studyModeOn) return null;

  let firstComment = loadFirstMessage(pageController, linkData);

  if (linkData?.text && !isOpen && !firstComment) return null;

  let pageSlug = pageController.pageData.slug;

  if (!appController?.sendbird?.sb?.currentUser) return null;
  if (!appController?.states?.studyGroup?.activeGroup) return null;

  const sendMessage = async (textbox, parentMessageId) => {
    let text = textbox.value;
    // Cap message length (abuse/robustness — DB column is TEXT but we never want
    // to accept walls of text). Truncate rather than silently drop so the user
    // keeps their content; the composer also enforces maxLength on the textarea.
    if (typeof text === "string" && text.length > MAX_MESSAGE_LENGTH) {
      text = text.slice(0, MAX_MESSAGE_LENGTH);
      textbox.value = text;
    }
    textbox.classList.add("sending");
    textbox.disabled = true;
    let channel = appController?.states?.studyGroup?.activeGroup;
    ///appController.functions.newMessage({message:text, channelUrl:channel.url})
    let data = {};
    if (linkData) data.links = linkData;
    if (highlights) data.highlights = highlights;
    if (text === "" && highlights && highlights.length > 0) {
      text = "•";
      textbox.innerText = label("saving");
      data.description = label(
        "x_added_y_highlight" + (highlights.length > 1 ? "s" : ""),
        [appController.sendbird.sb.currentUser.nickname, highlights.length],
      );
    }
    if (text === "" && linkData.img) {
      text = "•";
      textbox.innerText = "⭐ " + label("highlighting");
      data.description = label("x_highlighted_image", [
        appController.sendbird.sb.currentUser.nickname,
      ]);
    }
    if (text === "" && linkData.fax) {
      text = "•";
      textbox.innerText = "⭐ " + label("highlighting");
      data.description = label("x_highlighted_facsimile", [
        appController.sendbird.sb.currentUser.nickname,
      ]);
    }
    const params = {};

    const mentionUsers = getUsersFromTextInput(
      appController,
      inputRef.current?.value,
    );
    if (mentionUsers.length > 0) {
      params.mentionType = "users"; // Either 'users' or 'channel'
      params.mentionedUserIds = mentionUsers;
    }
    params.data = JSON.stringify(data);
    params.message = text;
    if (parentMessageId) params.parentMessageId = parentMessageId;
    else params.customType = pageSlug;

    try {
      channel.sendUserMessage(params).onSucceeded(async (message) => {
        window.clicky?.goal("comment");
        textbox.value = "";
        textbox.classList.remove("sending");
        textbox.disabled = false;
        textbox.focus();

        if (text === "" && linkData.img) {
          textbox.remove();
        }

        if (removeHighlight) removeHighlight(-1, isQuote);

        if (parentMessageId) {
          let event = new CustomEvent(
            "addMessageToThread" + message.parentMessageId,
          );
          event.message = message;
          window.dispatchEvent(event);
        } else {
          let event = new CustomEvent("addMessage");
          event.message = message;
          window.dispatchEvent(event);
          pageController.functions.addToPageComments(message);
          if (appController.states.popUp.activeId === "" + linkData.com)
            appController.functions.markPopUpComments(true);
        }
      });
    } catch (error) {
      console.log({ error });
      return false;
    }
    channel.endTyping();
  };

  const replyToMessage = (e) => {
    let textarea = e.target.parentNode.parentNode?.parentNode?.querySelector(
      "textarea",
    );
    let author =
      e.target?.parentNode?.parentNode?.attributes?.author?.value || "";
    if (!textarea) return false;
    if (!isMobile()) textarea.focus();
    textarea.value = `${author}: `;
  };

  let parentMessageId = firstComment ? firstComment.messageId : null;
  let channel = appController?.states?.studyGroup?.activeGroup;
  let bottomItem = (
    <>
      <InputHighlights
        highlights={highlights}
        removeHighlight={removeHighlight}
        isQuote={isQuote}
      />
      <CommentInput
        sendMessage={sendMessage}
        threadHash={threadHash}
        parentMessage={firstComment}
        channel={channel}
        locationHash={locationHash}
        pageController={pageController}
        threadInputVal={threadInputVal}
        setThreadInputVal={setThreadInputVal}
        inputRef={inputRef}
      />
    </>
  );

  if (highlights && highlights.length > 0 && !addComments) {
    bottomItem = (
      <>
        <InputHighlights
          highlights={highlights}
          removeHighlight={removeHighlight}
          isQuote={isQuote}
        />
        <div className="highlightButtons">
          <Button
            className={"send"}
            onClick={(e) => {
              sendMessage(e.target, parentMessageId);
            }}
          >
            {highlights.length > 1
              ? label("save_highlight_plural")
              : label("save_highlight_singular")}
          </Button>
          <Button
            onClick={() => {
              setAddComments(!addComments);
            }}
          >
            {label("add_a_comment")}
          </Button>
        </div>
      </>
    );
  }

  let highlightButton = null;

  let myHighlights = [];

  if (linkData.img) {
    //TODO: Lookup highlights from thread too
    myHighlights =
      [firstComment].filter(
        (m) =>
          m?.message === "•" &&
          m?.sender?.userId === appController.states.user.social?.user_id,
      ) || null;
    if (myHighlights.length === 0)
      highlightButton = (
        <Button onClick={(e) => sendMessage(e.target, parentMessageId)}>
          ⭐ {label("highlight_image")}
        </Button>
      );
  }

  if (linkData.fax) {
    //TODO: Lookup highlights from thread too
    myHighlights =
      [firstComment].filter(
        (m) =>
          m?.message === "•" &&
          m?.sender?.userId === appController.states.user.social?.user_id,
      ) || null;
    if (myHighlights.length === 0)
      highlightButton = (
        <Button onClick={(e) => sendMessage(e.target, parentMessageId)}>
          ⭐ {label("highlight_facsimile")}
        </Button>
      );
  }

  return (
    <div className="study">
      {highlightButton}
      <MessageList
        parentMessage={firstComment}
        pageController={pageController}
        replyToMessage={replyToMessage}
        threadHash={threadHash}
        isQuote={isQuote}
        removeHighlight={removeHighlight}
        setCommentHighlights={setCommentHighlights}
      />
      <MyComment
        highlights={highlights}
        removeHighlight={removeHighlight}
        threadHash={threadHash}
        isQuote={isQuote}
        channel={channel}
        locationHash={locationHash}
        bottomItem={bottomItem}
        inputRef={inputRef}
      />
    </div>
  );
}

export function MyComment({
  highlights,
  removeHighlight,
  isQuote,
  channel,
  locationHash,
  bottomItem,
  inputRef,
}) {
  const appController = useAppController();
  let realtime = null;
  let typingLocations = channel.typingLocations || {};
  if (Object.values(typingLocations).includes(locationHash)) {
    let dict = objectFlip(typingLocations);
    let username = dict[locationHash];
    let member = channel.memberMap[username];
    if (
      member?.metaData.activeGroup ===
      appController.states.studyGroup.activeGroup.url
    ) {
      realtime = (
        <div className="mycomment form-group">
          <div className="avatar" style={{ float: "left" }}>
            <UserAvatar
              userId={member.userId}
              profileUrl={member.plainProfileUrl}
              size={40}
              className="img-circle img-no-padding img-responsive"
            />
          </div>
          <Textarea
            ref={inputRef}
            disabled={"true"}
            placeHolder={label("x_is_writing", [member.nickname])}
            className="form-control textarea"
          />
        </div>
      );
    }
  }

  return (
    <>
      {realtime}
      <div className="mycomment form-group">
        <div className="avatar" style={{ float: "left" }}>
          <UserAvatar
            userId={appController.states?.user?.user}
            profileUrl={appController.states?.user?.social?.profile_url}
            size={40}
            className="img-circle img-no-padding img-responsive"
          />
        </div>
        {bottomItem}
      </div>
    </>
  );
}

export function CommentInput({
  sendMessage,
  threadHash,
  parentMessage,
  channel,
  pageController,
  locationHash,
  setThreadInputVal,
  threadInputVal,
  inputRef,
}) {
  const appController = useAppController();
  //useEffect(()=>document.getElementById(threadHash).focus(),[]);
  const [showTagList, setShowTagList] = useState(false);
  let parentMessageId = parentMessage?.messageId || null;
  const [typing, setTyping] = useState(false);
  const [timer, setTimer] = useState(false);
  const typingIndicator = () => {
    if (typing || channel === -1) return false;
    channel.startTyping();
    setTyping(true);
    clearTimeout(timer);
    setTimer(
      setTimeout(() => {
        channel.endTyping();
        setTyping(false);
      }, 5000),
    );
  };

  const setTypingLocation = (action) => {
    pageController?.appController.sendbird.updateTypingLocation({
      channel,
      action,
      username: pageController.appController.states.user.user,
    });
  };

  if (
    threadInputVal &&
    document.getElementById(threadHash) &&
    !document.getElementById(threadHash)?.value
  ) {
    document.getElementById(threadHash).value = threadInputVal;
  }

  useEffect(() => {
    const tx = document.querySelector(".commentInput");
    for (let i = 0; i < tx.length; i++) {
      tx[i].setAttribute(
        "style",
        "height:" + tx[i].scrollHeight + "px;overflow-y:hidden;",
      );
      tx[i].addEventListener("input", OnInput, false);
    }

    function OnInput() {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    }
  }, []);


  const items = [
    'study_question_about',
    'study_question_main',
    'study_question_detail',
    'study_question_understanding',
    'study_question_scene',
    'study_question_simpler',
    'study_question_explanation',
    'study_question_meaning',
    'study_question_context',
  ];

    
  const [responses] = useState(items.sort(() => Math.random() - 0.5).slice(0, 3));

  const [unSent, setUnsent] = useState(true);

  let cannedResponses = null;
  const hasBot = channel?.members?.find((m) => m?.metaData?.isBot);
  const hasPref = Object.keys(appController?.states?.preferences).includes('canned_responses');
  const preference = hasPref ? appController?.states?.preferences?.canned_responses : true;
  if(hasBot && !parentMessage && unSent && preference)
  {
    cannedResponses = (
      <div className="cannedResponses">
        {responses.map((item, i) => {
          return (
            <div
              key={i}
              className="cannedResponse"
              onClick={() => {
                const textarea = inputRef.current;
                textarea.value = label(item);
                textarea.focus();
                setUnsent(false);
                sendMessage(textarea, parentMessageId);
              }}
            >
              {label(item)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <Textarea
        id={threadHash}
        ref={inputRef}
        maxLength={MAX_MESSAGE_LENGTH}
        className="form-control textarea commentInput"
        aria-label={label("say_something")}
        placeholder={label("say_something")}
        onChange={(e) => {
          setTypingLocation({ fn: "add", locationHash });
          setThreadInputVal(e.target.value);
        }}
        onBlur={() => setTypingLocation({ fn: "remove", locationHash })}
        onKeyDown={(e) => {
          // While the @mention list is open, TagList owns the navigation keys
          // (Arrow/Enter/Tab/Esc) via a capture-phase listener and will have
          // already stopped propagation; let typing fall through to filter.
          typingIndicator();
          if (e.key === "@") {
            setShowTagList(true);
          }
          if (!showTagList && e.key === "Enter" && !e.shiftKey) {
            sendMessage(e.target, parentMessageId);
            e.preventDefault();
            setThreadInputVal("");
          }
        }}
        onClick={(e) => {
          showTagList && setShowTagList(false);
        }}
      />
      {cannedResponses}
      {showTagList && (
        <TagList
          setShowTagList={setShowTagList}
          inputRef={inputRef}
        />
      )}
    </>
  );
}

function InputHighlights({ highlights, removeHighlight, isQuote }) {
  if (!Array.isArray(highlights)) return null;
  if (highlights.length === 0) return null;
  return (
    <>
      <div className="highlightTags">
        {highlights.map((h, i) => (
          <div key={"highlightTag" + i} className="highlightTag">
            <span
              className="remove"
              onClick={() => removeHighlight(i, isQuote)}
            >
              ×
            </span>
            “{h}”
          </div>
        ))}
      </div>
    </>
  );
}

function loadFirstMessage(pageController, linkData) {
  let appController = pageController.appController;
  if (!appController.states.studyGroup.activeGroup) return null;
  if (
    pageController.states.commentGroupId !==
    appController.states.studyGroup.activeGroup.url
  )
    return null;
  if (pageController.pageComments === null) return null;
  let key = Object.keys(linkData)[0];
  return locateMessageData(pageController, key, linkData[key]);
}

function locateMessageData(pageController, key, val) {
  if (pageController.pageComments[key] === undefined) return null;
  if (pageController.pageComments[key][val] === undefined) return null;
  return pageController.pageComments[key][val];
}

function MessageList({
  parentMessage,
  replyToMessage,
  threadHash,
  setCommentHighlights,
  pageController,
  removeHighlight,
  isQuote,
}) {
  if (!parentMessage) return null;

  return (
    <>
      <SingleComment
        key={parentMessage.messageId}
        pageController={pageController}
        message={parentMessage}
        threadHash={threadHash}
        removeHighlight={removeHighlight}
        setCommentHighlights={setCommentHighlights}
        replyToMessage={replyToMessage}
        isQuote={isQuote}
      />
      <>
        <ThreadedMessages
          parentMessage={parentMessage}
          pageController={pageController}
          threadHash={threadHash}
          replyToMessage={replyToMessage}
          setCommentHighlights={setCommentHighlights}
        />
      </>
    </>
  );
}

function ThreadedMessages({
  parentMessage,
  replyToMessage,
  threadHash,
  setCommentHighlights,
  pageController,
}) {
  const appController = useAppController();
  const [expanded, expand] = useState(false);
  const [threadedMessages, setThreadMessages] = useState([]);
  // one-shot guard for the initial thread load; a ref (not state) so flipping it
  // does not re-trigger / self-cancel the load effect.
  const hasFetchedRef = useRef(false);

  //Listener Callbacks
  // Plain add (optimistic post + socket echo): append the ONE new message in
  // place, deduped by messageId. Do NOT refetch the whole thread — refetching
  // re-maps every reply into fresh objects and tears the list down (the
  // commentAdds/removes:19 flash). Dedup is done inside the functional updater
  // against the latest list so the optimistic append and the socket echo of the
  // same messageId can't both land (stale-closure double-append → duplicate keys).
  const addMessageToThread = (e) => {
    setThreadMessages((messages) => {
      if (messages.find((x) => x.messageId === e.message.messageId))
        return messages;
      return [...messages, e.message];
    });
  };
  const updateMessageInThread = (e) => {
    !expanded && expand(true);
    const messageData = e.message.data ? JSON.parse(e.message.data) : {};
    if (messageData.index >= 0)
      setThreadMessages((messages) => {
        messages[messageData.index] = e.message;
        return [...messages];
      });
  };
  const deleteMessageFromThread = (e) => {
    !expanded && expand(true);
    appController.sendbird.loadThreadedMessages(parentMessage).then((r) => {
      pageController.functions.addToPageComments(r.parentMessage);
      setThreadMessages(r.threadedMessages);
    });
  };

  useEffect(() => {
    if (parentMessage.messageId === undefined) return false;
    window.addEventListener(
      "addMessageToThread" + parentMessage.messageId,
      addMessageToThread,
      false,
    );
    window.addEventListener(
      "updateMessageInThread" + parentMessage.messageId,
      updateMessageInThread,
      false,
    );
    window.addEventListener(
      "deleteMessageFromThread" + parentMessage.messageId,
      deleteMessageFromThread,
      false,
    );
    return () => {
      window.removeEventListener(
        "addMessageToThread" + parentMessage.messageId,
        addMessageToThread,
        false,
      );
      window.removeEventListener(
        "updateMessageInThread" + parentMessage.messageId,
        updateMessageInThread,
        false,
      );
      window.removeEventListener(
        "deleteMessageFromThread" + parentMessage.messageId,
        deleteMessageFromThread,
        false,
      );
    };
  }, [parentMessage.messageId]);

  // Auto-expand short threads (was a render-body `expand(true)`; moved into an
  // effect so it is render-safe).
  const renderReplyCount =
    threadedMessages.length || parentMessage.threadInfo?.replyCount || 0;
  useEffect(() => {
    if (renderReplyCount && renderReplyCount < 3 && !expanded) expand(true);
  }, [renderReplyCount, expanded]);

  // One-time initial thread load: runs once, when the thread is first expanded.
  // Merges the fetched replies into whatever is already in state (deduped by
  // messageId) rather than replacing the array, so an optimistic append that
  // landed before this resolved isn't clobbered or duplicated. After this load,
  // new replies are appended in place by addMessageToThread — we never refetch
  // the whole thread on a plain add (this was a render-body fetch that, by
  // re-mapping every reply into fresh objects, caused the teardown/rebuild flash).
  useEffect(() => {
    if (!expanded || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    let cancelled = false;
    appController.sendbird.loadThreadedMessages(parentMessage).then((r) => {
      if (cancelled) return;
      const fetched = r.threadedMessages || [];
      setThreadMessages((messages) => {
        const seen = new Set(fetched.map((m) => m.messageId));
        // keep any optimistic/echoed message not in the fetched set, in order
        const extras = messages.filter((m) => !seen.has(m.messageId));
        return [...fetched, ...extras];
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  if (!parentMessage.threadInfo) return null;

  let replyCount = parentMessage.threadInfo.replyCount;
  let faces = parentMessage.threadInfo.mostRepliedUsers.map((u, i) => (
    <UserAvatar
      key={i}
      userId={u.userId}
      profileUrl={u.plainProfileUrl}
      size={24}
    />
  ));
  // let names = parentMessage.threadInfo.mostRepliedUsers.map(u => [u.nickname]);
  if (threadedMessages.length > 0) {
    replyCount = threadedMessages.length;
    //TODO: Link faces and names
    faces = [];
    // names = [];
  }

  if (!replyCount) return null;

  if (expanded) {
    if (threadedMessages.length > 0) {
      const messages = threadedMessages.map((m, index) => {
        // key must live on the outermost node the map returns; the redundant
        // <></> wrapper swallowed it, leaving the list keyless (React warning).
        return (
          <SingleComment
            key={m.messageId}
            message={m}
            index={index}
            pageController={pageController}
            replyToMessage={replyToMessage}
            threadHash={threadHash}
            setCommentHighlights={setCommentHighlights}
          />
        );
      });
      return messages;
    }

    // Initial load is kicked off by the fetch-once effect above (render-safe).
    return (
      <div className="viewMoreComments">
        {faces} <div>💬 {label("loading_x_more_comments", [replyCount])}</div>
      </div>
    );
  }

  return (
    <div className="viewMoreComments" onClick={() => expand(true)}>
      {faces} <div>💬 {label("view_x_more_comments", [replyCount])}</div>
    </div>
  );
}

function SingleComment({
  message,
  index,
  replyToMessage,
  threadHash,
  pageController,
  isQuote,
}) {
  const appController = useAppController();
  let data = useMemo(() => {
    return message.data ? JSON.parse(message.data) : { links: {} };
  }, [message.data]);

  const [isEditMessage, setEditMessage] = useState(false);
  const [highlights, setCommentHighlights] = useState(data && data.highlights);

  const removeHighlight = (i) => {
    if (i === -1) return setCommentHighlights([]);
    highlights.splice(i, 1);
    setCommentHighlights([...highlights]);
  };

  useEffect(() => {
    if (
      data &&
      data.links &&
      (data.links.img || data.links.fax) &&
      data.description
    ) {
      let classname = data.links.img
        ? "i" + data.links.img
        : "fax" + data.links.fax.replace(".", "_");
      document
        .querySelector(".panel." + classname)
        .classList.add("highlighted");
    }
  }, [data]);

  const handleEditComment = () => {
    setEditMessage(!isEditMessage);
  };

  let highlightTags = null;
  if (data.highlights?.length > 0)
    highlightTags = (
      <div className="commentHighlightTags">
        {data.highlights.map((h, i) => (
          <span key={h + i} className="commentHighlightTag">
            “{h}”
          </span>
        ))}
      </div>
    );

  if (
    data &&
    data.links &&
    (data.links.img || data.links.fax) &&
    data.description
  ) {
    highlightTags = (
      <div className="commentDescription">⭐ {data.description}</div>
    );
  }
  let messageText = formatText(message, appController, true);

  let content = <div className="contenttext">{ParseMessage(messageText)}</div>;
  if (message.message === "•") content = null;

  const handleMouseEnter = () => {
    if (!setCommentHighlights) return false;
    if (data && data.highlights && data.highlights.length > 0) {
      setCommentHighlights([...data.highlights]);
    }
  };

  const handleMouseLeave = () => {
    if (!setCommentHighlights) return false;
    setCommentHighlights([]);
  };

  if (message.length === 0) return false;
  // Guard: socket-normalized messages can arrive without sender.metaData;
  // an unguarded destructure here threw a pageerror.
  const { isBot } = message?.sender?.metaData || {};

  return (
    <div
      className={"comment" + (isBot ? " botComment" : "")}
      author={message?.sender?.nickname}
      id={message.messageId}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="avatar" style={{ float: "left" }}>
        <UserAvatar
          userId={message?.sender?.userId}
          profileUrl={message?.sender?.plainProfileUrl}
          size={40}
          className="img-circle img-no-padding img-responsive"
        />
      </div>
      {isEditMessage ? (
        <EditComment
          message={message}
          index={index}
          handleEditComment={handleEditComment}
          removeHighlight={removeHighlight}
          highlights={highlights}
          setCommentHighlights={setCommentHighlights}
          pageController={pageController}
          editComment={true}
          isQuote={isQuote}
        />
      ) : (
        <div className="commentcontainer">
          <div className="commentcontent">
            <div className="name">
              {message?.sender?.nickname} {isBot && <span>BOT</span>}
            </div>
            {highlightTags}
            {content}
          </div>
        </div>
      )}
      <MessageFooter
        message={message}
        index={index}
        threadHash={threadHash}
        replyToMessage={replyToMessage}
        isEdit={isEditMessage}
        handleEditComment={handleEditComment}
      />
    </div>
  );
}

export function EditComment({
  message,
  index,
  handleEditComment,
  pageController,
  linkData,
  isQuote,
}) {
  const appController = useAppController();
  const [showTagList, setShowTagList] = useState(false);
  const inputRef = useRef(null);
  const [commentMessage, setCommentMessage] = useState(message.message);

  const [highlights, setHighlights] = useState(
    JSON.parse(message.data)?.highlights || [],
  );

  const removeHighlight = (i) => {
    if (i === -1) return setHighlights([]);
    highlights.splice(i, 1);
    setHighlights([...highlights]);
  };

  useEffect(
    () =>
      moveCaretToEnd(
        document.querySelector(".editMessage" + message.messageId),
      ),
    [message.messageId],
  );

  const updateComment = async (textbox) => {
    try {
      let text = commentMessage;
      textbox.classList.add("sending");
      textbox.disabled = true;
      let channel = pageController.appController.states.studyGroup.activeGroup;

      const params = {};
      const mentionUsers = getUsersFromTextInput(
        appController,
        inputRef.current?.value,
      );

      if (mentionUsers.length > 0) {
        params.mentionType = "users"; // Either 'users' or 'channel'
        params.mentionedUserIds = mentionUsers;
      }
      params.customType = message.customType;
      let data = {};

      if (message.data) data = JSON.parse(message.data);

      if (text === "" && highlights.length > 0) {
        text = "•";
        textbox.innerText = label("saving");
        data.description =
          pageController.appController.sendbird.sb.currentUser.nickname +
          " added " +
          highlights.length +
          " highlight" +
          (highlights.length > 1 ? "s." : ".");
      }
      if (text === "" && linkData.img) {
        text = "•";
        textbox.innerText = label("highlighting");
        data.description =
          pageController.appController.sendbird.sb.currentUser.nickname +
          " highlighted this image.";
      }

      params.data = JSON.stringify({ ...data, index });
      params.message = text;

      channel.updateUserMessage(message.messageId, params).then((message) => {
        textbox.classList.remove("sending");
        textbox.disabled = false;
        textbox.focus();

        if (text === "" && linkData.img) {
          textbox.remove();
        }

        if (message.parentMessageId) {
          let event = new CustomEvent(
            "updateMessageInThread" + message.parentMessageId,
          );
          event.message = message;
          window.dispatchEvent(event);
        } else {
          pageController.functions.updateToPageComment(message);
        }
        // if (removeHighlight) removeHighlight(-1);
        handleEditComment();
      });
    } catch (err) {
      console.log("Update User Message ....", err);
      throw new Error(err);
    }
  };

  return (
    <div className="edit-commment study">
      <InputHighlights
        highlights={highlights}
        removeHighlight={removeHighlight}
        isQuote={isQuote}
      />
      <div className="mycomment form-group">
        <Textarea
          className={"form-control textarea editMessage" + message.messageId}
          autoFocus={!isMobile()}
          ref={inputRef}
          aria-label={label("action_edit")}
          placeholder={label("say_something")}
          onKeyDown={(e) => {
            // TagList owns nav keys (Arrow/Enter/Tab/Esc) while open; let
            // other keystrokes through so the user can keep typing to filter.
            if (e.key === "@") {
              setShowTagList(true);
            }
          }}
          onClick={() => setShowTagList(false)}
          onKeyPress={(e) => {
            if (!showTagList && e.key === "Enter" && !e.shiftKey) {
              updateComment(e.target);
              e.preventDefault();
            }
          }}
          value={commentMessage}
          onChange={({ target }) => setCommentMessage(target.value)}
        />
        {showTagList && (
          <TagList
            setShowTagList={setShowTagList}
            setCommentMessage={setCommentMessage}
            inputRef={inputRef}
          />
        )}
      </div>
    </div>
  );
}

function MessageFooter({
  message,
  index,
  replyToMessage,
  threadHash,
  handleEditComment,
  isEdit,
}) {
  const appController = useAppController();
  let isSelf =
    appController.states.user.social?.user_id === message?.sender?.userId;

  let timestamp = timeAgoString(message.createdAt / 1000);
  let link = "/group/" + message.channelUrl + "/" + message.messageId;

  let likeObj = LikeButton({ type: "page", message });

  const deleteMessage = async (e) => {
    window.removeEventListener("deleteMessage", deleteMessage, false);
    if (!e.isDelete) return true; // remove listener if message model is canceled
    try {
      await appController.states.studyGroup.activeGroup.deleteMessage(message);
      e.hideDeleteMessageAlert();
      if (message.parentMessageId) {
        let event = new CustomEvent(
          "deleteMessageFromThread" + message.parentMessageId,
        );
        event.message = message;
        window.dispatchEvent(event);
      } else {
        if (appController.activeLeafCursorController === null) return false;
        appController.activeLeafCursorController.functions.deleteToPageComments(
          message,
        );
      }
    } catch (error) {
      console.log({ error });
      return false;
    }
  };

  const onClickDelete = () => {
    let event = new CustomEvent("showDeleteAlert");
    window.dispatchEvent(event);
    window.addEventListener("deleteMessage", deleteMessage, false);
  };
  //   let messageData = testJSON(message.data) ? JSON.parse(message.data) : {};
  let messageActions = null;
  if (isEdit) {
    messageActions = (
      <>
        <div
          className="edit"
          role="button"
          tabIndex={0}
          onClick={handleEditComment}
          onKeyDown={activateOnKey(handleEditComment)}
        >
          {label("action_cancel")}
        </div>
      </>
    );
  } else if (isSelf) {
    let deleteActions = true ? ( // message.parentMessageId
      <>
        <div
          className="delete"
          role="button"
          tabIndex={0}
          onClick={onClickDelete}
          onKeyDown={activateOnKey(onClickDelete)}
        >
          {label("action_delete")}
        </div>
        <div className="dot" aria-hidden="true">
          •
        </div>
      </>
    ) : null;

    messageActions = (
      <>
        <div
          className="edit"
          role="button"
          tabIndex={0}
          onClick={handleEditComment}
          onKeyDown={activateOnKey(handleEditComment)}
        >
          {label("action_edit")}
        </div>
        <div className="dot" aria-hidden="true">
          •
        </div>
        {deleteActions}
      </>
    );
  } else {
    messageActions = (
      <>
        {likeObj.button}
        <div className="dot" aria-hidden="true">
          •
        </div>
        <div
          className="reply"
          role="button"
          tabIndex={0}
          onClick={replyToMessage}
          onKeyDown={activateOnKey(replyToMessage)}
        >
          {label("action_reply")}
        </div>
        <div className="dot" aria-hidden="true">
          •
        </div>
      </>
    );
  }

  return (
    <>
      {likeObj.reactions}
      <div className="commentfooter">
        {messageActions}
        {!isEdit ? (
          <div className="timestamp">
            <a href={link}>{timestamp}</a>
          </div>
        ) : (
          <></>
        )}
      </div>
    </>
  );
}

function messageReacters(message, members) {
  return shapeReacters(message.reactions, members);
}

export function LikeButton({ type, message }) {
  const appController = useAppController();
  let memberMap = appController.states.studyGroup.activeGroup.members;

  const [reacters, updateReacters] = useState(
    messageReacters(message, memberMap),
  );

  const [tooltip_id] = useState(crypto.randomBytes(20).toString("hex"));

  // Live reaction updates. Registered in an effect (NOT the render body — the
  // old render-body pattern stacked a fresh duplicate listener on every render
  // and never removed any of them on unmount). Keyed on memberMap too so the
  // handler re-binds with fresh members after a channel refresh.
  useEffect(() => {
    const eventName = "reactTo" + message.messageId;
    const reactToMessage = (e) => {
      message.applyReactionEvent(e.reactionEvent);
      updateReacters(messageReacters(message, memberMap));
    };
    window.addEventListener(eventName, reactToMessage, false);
    return () => window.removeEventListener(eventName, reactToMessage, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.messageId, memberMap]);

  let reactions = null;
  let liked = false;
  //   let myId = appController.states.user.social?.sbUserID;

  if (reacters.like && reacters.like.length > 0) {
    reactions = (
      <div className="commentreactions">
        <span className="reactionEmoji">👍</span>
        <span className="reactionFaces">
          {reacters.like.map((u) => (
            <span
              key={u.userId}
              className="reactionFaceWrap"
              title={u.nickname}
            >
              <UserAvatar
                userId={u.userId}
                profileUrl={u.profileUrl}
                size={20}
                className="reactionFace"
              />
            </span>
          ))}
        </span>
        <span className="reactionCount">{reacters.like.length}</span>
      </div>
    );
  }

  //Determine if self liked
  if (reacters.like)
    reacters.like
      .map((u) => u.userId)
      .forEach((r) => {
        if (r === appController.states.user.social?.user_id) liked = true;
      });

  const toggleReaction = async (emojiKey) => {
    let channel = await appController.sendbird.sb.groupChannel.getChannel(
      message.channelUrl,
    );
    if (!liked) {
      let tmp = { ...reacters };
      if (tmp.like === undefined) tmp.like = [];
      tmp.like = tmp.like.filter(
        (u) => appController.states.user.social?.user_id !== u.userId,
      );
      liked = true;
      updateReacters(tmp);
      channel.addReaction(message, emojiKey).then((reactionEvent) => {
        message.applyReactionEvent(reactionEvent);
        updateReacters(messageReacters(message, memberMap));
      });
    } else {
      channel.deleteReaction(message, emojiKey).then((reactionEvent) => {
        message.applyReactionEvent(reactionEvent);
        updateReacters(messageReacters(message, memberMap));
      });
    }
  };

  let likeCount = reacters.like ? reacters.like.length : 0;

  let selfLiked =
    likeCount &&
    reacters.like
      .map((u) => u.userId)
      .indexOf(appController.states.user.social?.userId) >= 0;

  if (type === "page") {
    return {
      reactions: reactions,
      button: (
        <div
          className="response"
          role="button"
          tabIndex={0}
          aria-pressed={liked}
          onClick={() => toggleReaction("like")}
          onKeyDown={activateOnKey(() => toggleReaction("like"))}
        >
          {liked ? label("action_unlike") : label("action_like")}
        </div>
      ),
    };
  }
  if (type === "chat") {
    if (likeCount === 0)
      return (
        <span
          className="likeCount"
          role="button"
          tabIndex={0}
          aria-label={label("action_like")}
          aria-pressed={false}
          onClick={() => toggleReaction("like")}
          onKeyDown={activateOnKey(() => toggleReaction("like"))}
        >
          👍 {label("action_like")}
        </span>
      );
    return (
      <>
        <span
          className={"likeCount hasCount " + (selfLiked ? "self" : "")}
          role="button"
          tabIndex={0}
          aria-label={label("action_like")}
          aria-pressed={selfLiked ? true : false}
          data-tip={reacters.like.map((u) => u.nickname).join(", ")}
          data-for={tooltip_id}
          onClick={() => toggleReaction("like")}
          onKeyDown={activateOnKey(() => toggleReaction("like"))}
        >
          👍 {likeCount}
        </span>
        <ReactTooltip id={tooltip_id} effect="solid" />
      </>
    );
  }
  return null;
}
