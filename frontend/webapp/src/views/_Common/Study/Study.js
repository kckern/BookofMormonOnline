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
} from "src/models/Utils";
import Parser from "html-react-parser";

export default function Comments({
  isOpen,
  pageController,
  appController,
  linkData,
  highlights,
  removeHighlight,
  setCommentHighlights,
  isQuote = false,
}) {
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
      .digest("hex")
  );
  const [locationHash] = useState(
    crypto
      .createHash("md5")
      .update(crypto.randomBytes(20).toString("hex"))
      .digest("hex")
  );

  useEffect(() => {
    if (document.getElementById(threadHash)?.value.length || 0 > 0) setAddComments(true);
  }, [document.getElementById(threadHash)?.value.length])

  if (!appController) appController = pageController?.appController;
  if (!appController?.states?.studyGroup?.studyModeOn) return null;

  let firstComment = loadFirstMessage(pageController, linkData);

  if (linkData?.text && !isOpen && !firstComment) return null;

  let pageSlug = pageController.pageData.slug;

  if (!appController?.sendbird?.sb?.currentUser) return null;
  if (!appController?.states?.studyGroup?.activeGroup) return null;

  const sendMessage = (textbox, parentMessageId) => {
    let text = textbox.value;
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
      data.description = label("x_added_y_highlight" + (highlights.length > 1 ? "s" : ""), [
        appController.sendbird.sb.currentUser.nickname,
        highlights.length
      ]);
    }
    if (text === "" && linkData.img) {
      text = "•";
      textbox.innerText = "⭐ " + label("highlighting");
      data.description = label("x_highlighted_image", [appController.sendbird.sb.currentUser.nickname]);
    }
    if (text === "" && linkData.fax) {
      text = "•";
      textbox.innerText = "⭐ " + label("highlighting");
      data.description = label("x_highlighted_facsimile", [appController.sendbird.sb.currentUser.nickname]);
    }
    const params = new appController.sendbird.sb.UserMessageParams();

    const mentionUsers = getUsersFromTextInput(
      appController,
      inputRef.current?.value
    );
    if (mentionUsers.length > 0) {
      params.mentionType = "users"; // Either 'users' or 'channel'
      params.mentionedUserIds = mentionUsers;
    }
    params.data = JSON.stringify(data);
    params.message = text;
    if (parentMessageId) params.parentMessageId = parentMessageId;
    else params.customType = pageSlug;


    setTimeout(channel.endTyping, 1000);
    channel.sendUserMessage(params, function (message, error) {
      if (error) {
        // Handle error.
        console.log(error);
        return false;
      }
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
          "addMessageToThread" + message.parentMessageId
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
  };

  const replyToMessage = (e) => {
    let textarea =
      e.target.parentNode.parentNode?.parentNode?.querySelector("textarea");
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
        appController={appController}
        inputRef={inputRef}
      /></>
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
        </div></>
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
          m?._sender?.userId === appController.states.user.social?.user_id
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
          m?._sender?.userId === appController.states.user.social?.user_id
      ) || null;
    if (myHighlights.length === 0)
      highlightButton = (
        <Button onClick={(e) => sendMessage(e.target, parentMessageId)}>
          ⭐ {label("highlight_facsimile")}
        </Button>
      );
  }

  return (
    <div className="study" threadHash={threadHash}>
      {highlightButton}
      <MessageList
        parentMessage={firstComment}
        pageController={pageController}
        appController={appController}
        replyToMessage={replyToMessage}
        threadHash={threadHash}
        isQuote={isQuote}
        removeHighlight={removeHighlight}
        setCommentHighlights={setCommentHighlights}
      />
      <MyComment
        appController={appController}
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
  appController,
  highlights,
  removeHighlight,
  isQuote,
  channel,
  locationHash,
  bottomItem,
  inputRef,
}) {
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
            <img
              alt={member.nickname}
              src={
                member.plainProfileUrl
              }
              onError={breakCache}
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
          <img
            alt="avatar"
            src={
              appController.sendbird.sb.currentUser.plainProfileUrl
            } onError={breakCache}
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
  appController,
  inputRef,
}) {
  //useEffect(()=>document.getElementById(threadHash).focus(),[]);
  const [showTagList, setShowTagList] = useState(false);
  let parentMessageId = parentMessage?.messageId || null;
  const [typing, setTyping] = useState(false);
  const [timer, setTimer] = useState(false);
  const typingIndicator = () => {
    if (typing) return false;
    channel.startTyping();
    setTyping(true);
    clearTimeout(timer);
    setTimer(
      setTimeout(() => {
        channel.endTyping();
        setTyping(false);
      }, 5000)
    );
  };

  const setTypingLocation = (action) => {
    pageController?.appController.sendbird.updateTypingLocation({
      channel,
      action,
      username: pageController.appController.states.user.user,
    });
  };

  if (threadInputVal && document.getElementById(threadHash) && !document.getElementById(threadHash)?.value) {
    document.getElementById(threadHash).value = threadInputVal;
  }


  useEffect(() => {
    const tx = document.querySelector(".commentInput");
    for (let i = 0; i < tx.length; i++) {
      tx[i].setAttribute("style", "height:" + (tx[i].scrollHeight) + "px;overflow-y:hidden;");
      tx[i].addEventListener("input", OnInput, false);
    }

    function OnInput() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
    }
  }, []);

  return (
    <>
      <Textarea
        id={threadHash}
        ref={inputRef}
        className="form-control textarea commentInput"
        placeholder={label("say_something")}
        onChange={(e) => {
          setTypingLocation({ fn: "add", locationHash });
          setThreadInputVal(e.target.value);
        }}
        onBlur={() => setTypingLocation({ fn: "remove", locationHash })}
        onKeyDown={(e) => {
          if (showTagList) {
            return setShowTagList(false);
          }
          typingIndicator();
          if (e.key === "Backspace" || e.key === "Escape") {
            if (showTagList) setShowTagList(false);
          }
          if (e.key === "@") {
            setShowTagList(true);
          }
          if (e.key === "Enter" && !e.shiftKey) {
            sendMessage(e.target, parentMessageId);
            e.preventDefault();
            setThreadInputVal("");
          }
        }}
        onClick={(e) => {
          showTagList && setShowTagList(false);
        }}
      />
      {showTagList && (
        <TagList
          appController={appController}
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
  appController,
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
        appController={appController}
        removeHighlight={removeHighlight}
        setCommentHighlights={setCommentHighlights}
        replyToMessage={replyToMessage}
        isQuote={isQuote}
      />
      <ThreadedMessages
        parentMessage={parentMessage}
        pageController={pageController}
        threadHash={threadHash}
        appController={appController}
        replyToMessage={replyToMessage}
        setCommentHighlights={setCommentHighlights}
      />
    </>
  );
}

function ThreadedMessages({
  parentMessage,
  appController,
  replyToMessage,
  threadHash,
  setCommentHighlights,
  pageController,
}) {
  const [expanded, expand] = useState(false);
  const [needsToFetch, setNeedsToFetch] = useState(true);
  const [threadedMessages, setThreadMessages] = useState([]);
  const [listenerIsSet, setListener] = useState(false);

  //Listener Callbacks

  const addMessageToThread = (e) => {
    !expanded && expand(true);
    if (threadedMessages.find((x) => x.messageId === e.message.messageId)) return false;
    setThreadMessages((messages) => [...messages, e.message]);
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
  const deleteMessageFromThread = (messageId) => {
    !expanded && expand(true);
    setThreadMessages((messages) => {
      //  debugger;
      messages = messages.filter((x) => x.messageId !== messageId);
      return [...messages];
    });
  };

  if (!listenerIsSet) {
    setListener(true);
    //REMOVE
    window.removeEventListener(
      "addMessageToThread" + parentMessage.messageId,
      addMessageToThread,
      false
    );
    window.removeEventListener(
      "updateMessageInThread" + parentMessage.messageId,
      updateMessageInThread,
      false
    );
    window.removeEventListener(
      "deleteMessageFromThread" + parentMessage.messageId,
      deleteMessageFromThread,
      false
    );
    //ADD
    window.addEventListener(
      "addMessageToThread" + parentMessage.messageId,
      addMessageToThread,
      false
    );
    window.addEventListener(
      "updateMessageInThread" + parentMessage.messageId,
      updateMessageInThread,
      false
    );
    window.addEventListener(
      "deleteMessageFromThread" + parentMessage.messageId,
      deleteMessageFromThread,
      false
    );
  }

  if (!parentMessage.threadInfo) return null;

  let replyCount = parentMessage.threadInfo.replyCount;
  let faces = parentMessage.threadInfo.mostRepliedUsers.map((u, i) => (
    <img
      key={i}
      alt={u.nickname}
      onError={breakCache}
      src={u.plainProfileUrl}
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
  if (replyCount < 3 && !expanded) expand(true);

  if (expanded) {
    if (threadedMessages.length > 0)
      return threadedMessages.map((m, index) => {
        return (
          <SingleComment
            key={m.messageId}
            message={m}
            index={index}
            pageController={pageController}
            replyToMessage={replyToMessage}
            threadHash={threadHash}
            setCommentHighlights={setCommentHighlights}
            appController={appController}
          />
        );
      });

    if (needsToFetch) {
      setNeedsToFetch(false);
      appController.sendbird.loadThreadedMessages(parentMessage).then((r) => {
        setThreadMessages(r.threadedReplies);
      });
    }
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
  appController,
}) {
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

  const {isBot} = message._sender?.metaData;

  return (
    <div
      className={"comment" + (isBot ? " botComment" : "")}
      key={message.messageId}
      threadHash={threadHash}
      author={message?._sender?.nickname}
      id={message.messageId}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="avatar" style={{ float: "left" }}>
        <img
          src={message?._sender?.plainProfileUrl}
          alt={message?._sender?.nickname}
          className="img-circle img-no-padding img-responsive"
        />
      </div>
      {isEditMessage ? <EditComment
        message={message}
        index={index}
        handleEditComment={handleEditComment}
        removeHighlight={removeHighlight}
        highlights={highlights}
        setCommentHighlights={setCommentHighlights}
        pageController={pageController}
        editComment={true}
        isQuote={isQuote}
        appController={appController}
      /> : <div className="commentcontainer">
        <div className="commentcontent">
          <div className="name">{message?._sender?.nickname} {isBot && <span>BOT</span>}</div>
          
          {highlightTags}
          {content}
        </div>
      </div>}

      <MessageFooter
        message={message}
        index={index}
        threadHash={threadHash}
        appController={pageController.appController}
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
  appController,
  isQuote
}) {
  const [showTagList, setShowTagList] = useState(false);
  const inputRef = useRef(null);
  const [commentMessage, setCommentMessage] = useState(message.message);


  const [highlights, setHighlights] = useState(JSON.parse(message.data)?.highlights || []);


  const removeHighlight = (i) => {
    if (i === -1) return setHighlights([]);
    highlights.splice(i, 1);
    setHighlights([...highlights]);
  };


  useEffect(
    () =>
      moveCaretToEnd(
        document.querySelector(".editMessage" + message.messageId)
      ),
    [message.messageId]
  );

  const updateComment = (textbox) => {
    try {
      let text = commentMessage;
      textbox.classList.add("sending");
      textbox.disabled = true;
      let channel = pageController.appController.states.studyGroup.activeGroup;

      const params =
        new pageController.appController.sendbird.sb.UserMessageParams();
      const mentionUsers = getUsersFromTextInput(
        appController,
        inputRef.current?.value
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
      channel.updateUserMessage(
        message.messageId,
        params,
        function (message, error) {
          if (error) {
            console.log(error);
            return false;
          }
          textbox.classList.remove("sending");
          textbox.disabled = false;
          textbox.focus();

          if (text === "" && linkData.img) {
            textbox.remove();
          }

          if (message.parentMessageId) {
            let event = new CustomEvent(
              "updateMessageInThread" + message.parentMessageId
            );
            event.message = message;
            window.dispatchEvent(event);
          } else {
            pageController.functions.updateToPageComment(message);
          }
          // if (removeHighlight) removeHighlight(-1);
          handleEditComment();
        }
      );
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
          placeholder={label("say_something")}
          onKeyDown={(e) => {
            if (showTagList) {
              return setShowTagList(false);
            }
            if (e.key === "Backspace" || e.key === "Escape") {
              if (showTagList) setShowTagList(false);
            }
            if (e.key === "@") {
              setShowTagList(true);
            }
          }}
          onClick={() => setShowTagList(false)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              updateComment(e.target);
              e.preventDefault();
            }
          }}
          value={commentMessage}
          onChange={({ target }) => setCommentMessage(target.value)}
        />
        {showTagList && (
          <TagList
            appController={appController}
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
  appController,
  replyToMessage,
  threadHash,
  handleEditComment,
  isEdit,
}) {
  let isSelf =
    appController.states.user.social?.user_id === message?._sender?.userId;

  let timestamp = timeAgoString(message.createdAt / 1000);
  let link = "/group/" + message.channelUrl + "/" + message.messageId;

  let likeObj = LikeButton({ type: "page", message, appController });

  const deleteMessage = (e) => {
    window.removeEventListener("deleteMessage", deleteMessage, false);
    if (!e.isDelete) return true; // remove listiner if message model is cancled
    appController.states.studyGroup.activeGroup.deleteMessage(
      message,
      function (response, error) {
        e.hideDeleteMessageAlert();

        if (error) {
          console.log(error);
          return false;
        }
        if (message.parentMessageId) {
          let event = new CustomEvent(
            "deleteMessageFromThread" + message.parentMessageId
          );
          event.index = index;
          window.dispatchEvent(event);
        } else {
          appController.pageController.functions.deleteToPageComments(message);
        }
      }
    );
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
        <div className="edit" onClick={handleEditComment}>
          {label("action_cancel")}
        </div>
      </>
    );
  } else if (isSelf) {
    let deleteActions = true ? ( // message.parentMessageId
      <>
        <div className="delete" onClick={onClickDelete}>
          {label("action_delete")}
        </div>
        <div className="dot">•</div>
      </>
    ) : null;

    messageActions = (
      <>
        <div className="edit" onClick={handleEditComment}>
          {label("action_edit")}
        </div>
        <div className="dot">•</div>
        {deleteActions}
      </>
    );
  } else {
    messageActions = (
      <>
        {likeObj.button}
        <div className="dot">•</div>
        <div className="reply" onClick={replyToMessage}>
          {label("action_reply")}
        </div>
        <div className="dot">•</div>
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

function messageReacters(message, memberMap) {
  let reacters = {};
  for (let i in message.reactions) {
    let r = message.reactions[i];
    reacters[r.key] = r.userIds
      .map((id) => {
        return {
          userId: memberMap[id]?.userId,
          nickname: memberMap[id]?.nickname,
        };
      })
      .reverse();
  }
  return reacters;
}

export function LikeButton({ type, message, appController }) {
  let memberMap = appController.states.studyGroup.activeGroup.memberMap;
  const [reacters, updateReacters] = useState(
    messageReacters(message, memberMap)
  );

  const [init, setInit] = useState(false);
  const [tooltip_id] = useState(crypto.randomBytes(20).toString("hex"));

  const reactToMessage = (e) => {
    message.applyReactionEvent(e.reactionEvent);
    updateReacters(messageReacters(message, memberMap));
    setInit(true);
  };

  if (!init) {
    window.removeEventListener(
      "reactTo" + message.messageId,
      reactToMessage,
      false
    );
    window.addEventListener(
      "reactTo" + message.messageId,
      reactToMessage,
      false
    );
  }

  let reactions = null;
  let liked = false;
  //   let myId = appController.states.user.social.sbUserID;

  if (reacters.like && reacters.like.length > 0) {
    reactions = (
      <div className="commentreactions">
        <span>👍 {reacters.like.map((u) => u.nickname).join(", ")}</span>{" "}
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

  let channel = appController.states.studyGroup.activeGroup;
  const toggleReaction = (emojiKey) => {
    if (!liked) {
      let tmp = { ...reacters };
      if (tmp.like === undefined) tmp.like = [];
      tmp.like = tmp.like.filter(
        (u) => appController.states.user.social?.user_id !== u.userId
      );
      liked = true;
      updateReacters(tmp);
      channel.addReaction(message, emojiKey, function (reactionEvent, error) {
        if (error) {
        }
        message.applyReactionEvent(reactionEvent);
        updateReacters(messageReacters(message, memberMap));
      });
    } else {
      channel.deleteReaction(
        message,
        emojiKey,
        function (reactionEvent, error) {
          if (error) {
          }
          message.applyReactionEvent(reactionEvent);
          updateReacters(messageReacters(message, memberMap));
        }
      );
    }
  };

  let likeCount = reacters.like ? reacters.like.length : 0;

  let selfLiked =
    likeCount &&
    reacters.like
      .map((u) => u.userId)
      .indexOf(appController.states.user.social.userId) >= 0;

  if (type === "page") {
    return {
      reactions: reactions,
      button: (
        <div className="response" onClick={() => toggleReaction("like")}>
          {liked ? label("action_unlike") : label("action_like")}
        </div>
      ),
    };
  }
  if (type === "chat") {
    if (likeCount === 0)
      return (
        <span className="likeCount" onClick={() => toggleReaction("like")}>
          👍{" "}{label("action_like")}
        </span>
      );
    return (
      <>
        <span
          className={"likeCount hasCount " + (selfLiked ? "self" : "")}
          data-tip={reacters.like.map((u) => u.nickname).join(", ")}
          data-for={tooltip_id}
          onClick={() => toggleReaction("like")}
        >
          👍{" "}{likeCount}
        </span>
        <ReactTooltip id={tooltip_id} effect="solid" />
      </>
    );
  }
  return null;
}
