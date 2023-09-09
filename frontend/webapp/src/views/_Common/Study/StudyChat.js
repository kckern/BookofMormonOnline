import { useCallback, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  ImageInFeed,
  SectionInFeed,
  FaxInFeed,
  CommentaryInFeed,
} from "src/views/_Common/Study/StudyInFeed";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { breakCache, isMobile, label, ParseMessage, testJSON, timeAgoString } from "src/models/Utils";
import { LikeButton, CommentInput } from "./Study.js";
import ReactTooltip from "react-tooltip";
import crypto from "crypto-browserify";
import { TextInFeed } from "./StudyInFeed.js";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import sendicon from "src/views/_Common/Study/svg/send.svg";
import typing from "src/views/_Common/Study/svg/typing.svg";
import TagList from "./TagList.js";
import { getUsersFromTextInput } from "src/models/Utils";
import { formatText } from "src/models/Utils";

import {
  Button,
  ButtonGroup,
  Dropdown,
  DropdownItem,
  DropdownToggle,
  DropdownButton,
  DropdownMenu,
} from "reactstrap";

import Parser from "html-react-parser";
import Loader from "../Loader/index.js";


const modules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ["bold", "italic", "underline", "strike", "blockquote"],
    [
      { list: "ordered" },
      { list: "bullet" },
      { indent: "-1" },
      { indent: "+1" },
    ],
    ["link", "image"],
    ["clean"],
  ],
};

const formats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "blockquote",
  "list",
  "bullet",
  "indent",
  "link",
  "image",
];

export function StudyGroupChatInput({ appController, channel }) {
  const [showTagList, setShowTagList] = useState(false);
  const [editorBounds, setEditorBounds] = useState(null);
  const inputRef = useRef(null);

  const sendMessage = () => {
    let textbox = document.querySelector(".StudyGroupChatInput textarea");
    let text = textbox.value;
    textbox.classList.add("sending");
    textbox.disabled = true;

    const params = new appController.sendbird.sb.UserMessageParams();
    params.message = text;
    params.customType = "comment";

    const mentionUsers = appController.states.editor.value
      ? getUsersFromTextInput(appController, appController.states.editor.value)
      : getUsersFromTextInput(appController, inputRef.current?.value);

    if (appController.states.editor.value) {
      params.message = appController.states.editor.value;
      params.customType = "formatted_comment";
    }

    if (mentionUsers.length > 0) {
      params.mentionType = "users"; // Either 'users' or 'channel'
      params.mentionedUserIds = mentionUsers;
    }

    if (!params.message) return false;

  
    setTimeout(channel.endTyping,1000);
    channel.sendUserMessage(params, function (message, error) {
      if (error) {
        // Handle error.
        console.log({ error });
        return false;
      }
      window.clicky?.goal("comment");
      textbox.value = "";
      textbox.classList.remove("sending");
      auto_grow(textbox);
      textbox.disabled = false;
      textbox.focus();

      const studyGroupChatEvent = document.querySelector(".StudyGroupChat");
      if (studyGroupChatEvent) studyGroupChatEvent.scrollTop = "100%";

      let event = new CustomEvent("addMessage");
      event.message = message;
      window.dispatchEvent(event);
      if (appController.states.editor.value) {
        return appController.functions.openEditor({
          isOpen: false,
          value: "",
        });
      }
    });
  };

  const [isOpen, setOpen] = useState(false);

  const [timeoutIds, setTimeoutIds] = useState([]);
  const [typing, setTyping] = useState(false);
  const typingIndicator = () => {
    //if (typing) return false;
    channel.startTyping();
    setTyping(true);
    timeoutIds.map(id=>clearTimeout(id));
    let newId = setTimeout(() => {
      channel.endTyping();
      setTimeoutIds([]);
      setTyping(false);}, 5000);
    setTimeoutIds(prevIds=>[newId,...prevIds])
  };
  const auto_grow = (element) => {
    if (element.scrollHeight < 40) return false;
    element.style.height = `8px`;
    element.style.height = `calc(${element.scrollHeight}px + 8px)`;
    document.querySelector(
      ".StudyGroupChat"
    ).style.height = `calc(100% - ${element.scrollHeight}px - 2.7rem)`;
    document.querySelector(
      ".StudyGroupChatInput"
    ).style.height = `calc(${element.scrollHeight}px + 2.7rem)`;
  };
  return (
    <div className={"StudyGroupChatInput"}>
      <div className="topRow">
        <textarea
          disabled={appController.states.editor.isEditorOpen ? true : false}
          autoFocus={!isMobile()}
          type="text"
          id="inputGroupChat"
          ref={inputRef}
          placeholder={label("say_something")}
          onKeyDown={(e) => {
            if (e.key === "Backspace" || e.key === "Escape") {
              if (showTagList) setShowTagList(false);
            }
          }}
          onKeyPress={(e) => {
            if (showTagList) {
              return setShowTagList(false);
            }
            if (e.key === "@") {
              setShowTagList(true);
            }
            auto_grow(e.target);
            typingIndicator();

            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              setTyping(false);
              sendMessage(e.target);
            }
          }}
          onClick={(e) => {
            showTagList && setShowTagList(false);
          }}
        />
        {!appController.states.editor.isEditorOpen && showTagList && (
          <TagList
            appController={appController}
            setShowTagList={setShowTagList}
            inputRef={inputRef}
          />
        )}
        <Dropdown
          className="noselect"
          isOpen={isOpen}
          toggle={() => setOpen(!isOpen)}
        >
          <ButtonGroup className="send-btn-group">
            <Button onClick={sendMessage}>
              <img src={sendicon} />
            </Button>
            <DropdownToggle caret className="carret" />
          </ButtonGroup>
          <DropdownMenu right>
            <DropdownItem
              onClick={() => {
                if (!appController.states.editor.isEditorOpen) {
                  if (
                    document.querySelector(".ql-editor").innerHTML ===
                    "<p><br></p>"
                  )
                    document.querySelector(".ql-editor").innerHTML = " ";

                  return appController.functions.openEditor({
                    isOpen: true,
                    value: document
                      .querySelector("#inputGroupChat")
                      .value.trim(),
                  });
                }
              }}
            >
              {label("advanced_editor")}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
      <div
        className={`div-editor ${
          appController.states.editor.isEditorOpen ? "maxi" : "mini"
        }`}
      >
        <ReactQuill
          placeholder=""
          value={appController.states.editor.value || ""}
          onKeyDown={(e) => {
            if (e.key === "Backspace" || e.key === "Escape") {
              if (showTagList) setShowTagList(false);
            }
          }}
          onKeyPress={(e) => {
            if (showTagList) {
              return setShowTagList(false);
            }
            if (e.key === "@") {
              if (appController.states.editor.value) {
                setShowTagList(true);
              } else {
                setTimeout(() => {
                  setShowTagList(true);
                }, []);
              }
            }
          }}
          onChange={(content) => {
            if (appController.states.editor.isEditorOpen) {
              appController.functions.openEditor({
                isOpen: true,
                value: content,
              });
            }
          }}
          onChangeSelection={(range, source, editor) => {
            if (range?.index) {
              setEditorBounds(editor.getBounds(range.index, range.length));
            }
          }}
          theme="snow"
          modules={modules}
          formats={formats}
          style={{
            backgroundColor: "white",
          }}
        />
        {appController.states.editor.isEditorOpen && showTagList && (
          <TagList
            appController={appController}
            setShowTagList={setShowTagList}
            editorBounds={editorBounds}
            isEditor={true}
          />
        )}
        <div className="advancedButtons">
          <Button
            className="advancedExit"
            onClick={() => {
              let text = document.querySelector(".ql-editor").innerText.trim();
              setTimeout(
                () => (document.querySelector("#inputGroupChat").value = text),
                100
              );
              return appController.functions.openEditor({
                isOpen: false,
                value: "",
              });
            }}
          >
            <div>{label("Cancel")} ×</div>
          </Button>
          <Button className="advancedSend" onClick={sendMessage}>
            <div>{label("send")}</div> <img src={sendicon} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function prepareQuery(messages) {
  //Preload Content, etc
  //Loop, get all data, return query
  let query = {};
  let slug = null;
  for (let i in messages) {
    let message = messages[i];
    let key,val = null;
    if(message.link){
      key = message.link.key
      val = message.link.val;
    }else{

      if (!testJSON(message.data)) continue;
      let data = JSON.parse(message.data);
      if (data.links === undefined) continue;
      key = Object.keys(data.links).shift();
      val = data.links[key];
    }

    let baseUrl = message.customType && message.customType + "/" || "";

    switch (key) {
      case "fax":
        if (!query.textInFeed) query.textInFeed = [];
        if (!val || typeof val !== "string") break;
        slug = baseUrl + val.replace(/\..+/, "");
        if (query.textInFeed.indexOf(slug) < 0) query.textInFeed.push(slug);
        break;
      case "text":
        if (!query.textInFeed) query.textInFeed = [];
        if (!val) break;
        slug = baseUrl + val;
        if (query.textInFeed.indexOf(slug) < 0) query.textInFeed.push(slug);
        break;
      case "img":
        if (!query.imageInFeed) query.imageInFeed = [];
        if (!val) break;
        if (query.imageInFeed.indexOf(val) < 0)
          query.imageInFeed.push(String(val));
        break;
      case "com":
        if (!query.commentaryInFeed) query.commentaryInFeed = [];
        if (!val) break;
        if (query.commentaryInFeed.indexOf(val) < 0)
          query.commentaryInFeed.push(String(val));
        break;
      case "section":
        if (!query.sectionInFeed) query.sectionInFeed = [];
        if (!val) break;
        if (query.sectionInFeed.indexOf(val) < 0) query.sectionInFeed.push(val);
        break;
      default:
        break;
    }
  }

  //do some grouping by speaker, threads, etc.
  return query;
}

export function StudyGroupChat({
  appController,
  setThreadMessage,
  linkedContent,
  setPrevLoader,
  parentMessage,
  channel,
  setPanel,
}) {
  const [loading, setLoading] = useState(true);
  const [lastMessageId, setLastMessageId] = useState(0);
  const [firstMessageId, setFirstMessageId] = useState(0);
  const [messages, setMessages] = useState([]);
  const [lastElement, setLastElement] = useState(null);
  const [myLastRead, setMyLastRead] = useState(channel.myLastRead);
  const history = useHistory();
  useEffect(() => {
    if (lastElement === null) return;
    const callback = (entries, observer) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          setPrevLoader(true);
          appController.sendbird?.loadPreviousMessages({
              group: channel,
              id: messages[messages.length - 1].messageId,
            })
            .then((data) => {
              const messageList = data.slice(1, data.length - 1);
              setMessages((prev) => [...prev, ...messageList]);
              setLastElement(document.querySelector(".last"));
              setPrevLoader(false);
              appController.sendbird?.loadUnreadDMs()
                .then((unreadCounts) =>
                  appController.functions.setUnreadDMs(unreadCounts)
                );
            });
          observer.unobserve(lastElement);
        }
      });
    };

    let observer = new IntersectionObserver(callback, {
      threshold: 0,
    });
    observer.observe(lastElement);
    channel.markAsRead();
    return () => {
      observer.disconnect();
      history.push(appController.states.studyGroup.slug);
    };
  }, [lastElement]);

  useEffect(() => setMyLastRead(channel.myLastRead), [channel.url]);

  useEffect(() => {
    setLoading(false);
    setPrevLoader(false);
    // Add Listeners
    window.addEventListener("addMessage", appendMessage, false);
    window.addEventListener("updateMessage", updateMessage, false);
    window.addEventListener("deleteChatMessage", deleteChatMessage, false);
    // Load Previous Messages
    appController.sendbird.loadGroupMessages(channel).then((loadedMessages) => {
      setMessages(loadedMessages);
      setLastElement(document.querySelector(".last"));
    });
    return () => {
      // Remove Listeners
      window.removeEventListener("addMessage", appendMessage, false);
      window.removeEventListener("updateMessage", updateMessage, false);
      window.removeEventListener("deleteChatMessage", deleteChatMessage, false);
    };
  }, [parentMessage]);

  const appendMessage = (e) => {
    setMessages((messages) => [e.message, ...messages]);
  };

  const deleteChatMessage = (e) => {
    setMessages((messages) => {
      messages.splice(e.index, 1);
      return [...messages];
    });
  };

  const updateMessage = (e) => {
    setMessages((messages) => {
      messages[e.index] = e.message;
      return [...messages];
    });
  };

  //Load Chat Linked Content
  if (
    !loading &&
    messages.length > 0 &&
    (!linkedContent.chatLinkedContent ||
      messages[0]?.messageId > lastMessageId ||
      messages[messages.length - 1].messageId < firstMessageId)
  ) {
    // setLoading(true);
    let query = prepareQuery(messages);
    setLastMessageId(messages[0].messageId);
    setFirstMessageId(messages[messages.length - 1].messageId);
    BoMOnlineAPI(query).then((r) => {
      setLoading(false);
      let newContent = { ...linkedContent.chatLinkedContent };
      for (let kind in r) {
        if (!newContent[kind]) newContent[kind] = {};
        for (let key in r[kind]) newContent[kind][key] = r[kind][key];
      }
      linkedContent.setChatLinkedContent(newContent);
    });
  }

  useEffect(() => {
    if (channel.myMemberState === "invited") channel.acceptInvitation();
  }, []);

  let isSameSender = false;
  let max_i = messages.length - 1;
  return (
    <div className={"StudyGroupChat"}>
      <TypingIndicators appController={appController} channel={channel} />
      {loading ? (
        <Loader />
      ) : (
        messages.map((message, i) => {
          if (message && messages[i + 1] && messages[i + 1]?._sender)
            isSameSender =
              messages[i + 1]?._sender?.userId === message?._sender?.userId;
          if (i === max_i) isSameSender = false;
          let classes = [];
          classes.push(messages.length - 1 === i ? "last" : "");
          if (
            message.createdAt > myLastRead &&
            messages[i + 1]?.createdAt <= myLastRead
          )
            classes.push("unreadMsg");
          return (
            <div
              messageid={messages.length - 1 === i ? message.messageId : null}
              className={classes.join(" ")}
              key={messages.messageId}
            >
              <BaseMessage
                isSameSender={isSameSender}
                key={message.messageId}
                index={i}
                inThread={false}
                id={message.messageId}
                setThreadMessage={setThreadMessage}
                appController={appController}
                message={message}
                inStudyGroupChat={true}
                chatLinkedContent={linkedContent.chatLinkedContent}
                channel={channel}
                setPanel={setPanel}
              />
            </div>
          );
        })
      )}
    </div>
  );
}

function TypingIndicators({ appController, channel }) {
  let groupUrl = channel.url;
  let typerIds = appController.states.studyGroup?.typers?.[groupUrl];
  let lastMessageTime = appController.states.studyGroup.activeGroup.lastMessage?.createdAt || 0;
  let timeSince = new Date().getTime() - lastMessageTime;

  if (!typerIds || typerIds?.length === 0 || timeSince < 5000) return null;


  
  let typers = typerIds.map(
    (id) => appController.states.studyGroup.activeGroup.memberMap[id]
  );
  if (typers.length === 0) return null;
  let image = typers.map((user) => (
    <img
      src={
        user?.plainProfileUrl 
      }
      alt={user?.nickname} onError={breakCache}
    />
  ));

  // return <><pre>{JSON.stringify(appController.states.studyGroup.typers,null,2)}</pre><br/><br/><br/><br/></>
  return (
    <div className={"messageContainer"}>
      {image}
      <div className={"messageContent"}>
        <span className="senderName">
          {typers.map((user) => user.nickname).join(", ")}
        </span>
        <div className={`messageBody typing`}>
          <img src={typing} />
        </div>
      </div>
    </div>
  );

  return null;
}

export function StudyGroupThread({
  appController,
  setThreadMessage,
  parentMessage,
  linkedContent,
  channel,
  setPanel,
}) {
  
  const inputRef = useRef(null);
  useEffect(() => {
    window.addEventListener("updateMessage", updateParentMessage, false);
    return () => {
      window.removeEventListener("updateMessage", updateParentMessage, false);
    };
  }, []);
  const updateParentMessage = (e) => {
    setThreadMessage(e.message);
  };
  const sendMessage = (textbox) => {
    if (!textbox) return null;
    let text = textbox.value;
    textbox.classList.add("sending");
    textbox.disabled = true;

    const params = new appController.sendbird.sb.UserMessageParams();

    ///appController.functions.newMessage({message:text, channelUrl:channel.url})

    const mentionUsers = getUsersFromTextInput(
      appController,
      inputRef.current?.value
    );
    if (mentionUsers.length > 0) {
      params.mentionType = "users"; // Either 'users' or 'channel'
      params.mentionedUserIds = mentionUsers;
    }

    params.message = text;
    params.parentMessageId = parentMessage.messageId;
    //params.mentionType = 'users';                       // Either 'users' or 'channel'
    //params.mentionedUserIds = ['Jeff', 'Julia'];        // Or mentionedUsers = Array<User>;
    //params.metaArrays = [   // A pair of key-value
    //    new sendBirds.me.MessageMetaArray('itemType', ['tablet']),
    //    new sendBirds.me.MessageMetaArray('quality', ['best', 'good'])
    //];
    setTimeout(channel.endTyping,8000);
    channel.sendUserMessage(params, function (message, error) {
      if (error) {
        // Handle error.
      }
      window.clicky?.goal("comment");
      textbox.value = "";
      textbox.classList.remove("sending");
      textbox.disabled = false;
      textbox.focus();

      const threadEvent = document.querySelector(".thread");
      if (threadEvent) threadEvent.scrollTop = "100%";

      let event = new CustomEvent("updateReplyCount" + message.parentMessageId);
      event.message = message;
      event.increaseCount = true;
      window.dispatchEvent(event);

      event = new CustomEvent("addMessageToThread");
      event.message = message;
      window.dispatchEvent(event);
    });
  };

  const closeThreadMessage = () => {
    setThreadMessage(false);
    const event = new CustomEvent("removeThreadCountListener");
    window.dispatchEvent(event);
  };

  let close = (
    <span className="close" onClick={closeThreadMessage}>
      ✕
    </span>
  );

  const [threadHash] = useState(
    crypto
      .createHash("md5")
      .update(crypto.randomBytes(20).toString("hex"))
      .digest("hex")
  );

  const [threadInputVal, setThreadInputVal] = useState(null);

  return (
    <div className={"thread"}>
      <h3 className={"threadHeader"}>
        {label("message_thread")} {close}
      </h3>
      <ThreadMessages
        appController={appController}
        parentMessage={parentMessage}
        setThreadMessage={setThreadMessage}
        chatLinkedContent={linkedContent.chatLinkedContent}
        channel={channel}
        setPanel={setPanel}
      />
      <div className="threadCommentInput">
        <CommentInput
          sendMessage={sendMessage}
          parentMessage={parentMessage}
          threadHash={threadHash}
          threadInputVal={threadInputVal}
          setThreadInputVal={setThreadInputVal}
          channel={channel}
          appController={appController}
          inputRef={inputRef}
        />
        <img
          src={
            appController.states.user.social.profile_url 
          } onError={breakCache}
          className={"threadAvatar"}
        />
      </div>
    </div>
  );
}

function ThreadMessages({
  appController,
  parentMessage,
  setThreadMessage,
  chatLinkedContent,
  channel,
  setPanel,
}) {
  useEffect(() => {
    document.querySelector(".thread textarea").value = "";
    document.querySelector(".thread textarea").focus();
  }, [parentMessage.messageId]);

  const [highlights, setHighlights] = useState(
    testJSON(parentMessage.data)
      ? JSON.parse(parentMessage.data).highlights
      : []
  );

  const [messagesCount, setMessageCount] = useState(null);
  if (!parentMessage) {
    //Load from API
    return <Loader />;
  }

  let count = parentMessage.threadInfo.replyCount;
  //TODO: Keep count current with realtime updates;
  let messages = (
    <ThreadedMessages
      appController={appController}
      parentMessage={parentMessage}
      setHighlights={setHighlights}
      chatLinkedContent={chatLinkedContent}
      setMessageCount={setMessageCount}
      channel={channel}
      setPanel={setPanel}
    />
  );

  return (
    <div>
      <BaseMessage
        inThread={true}
        isParent={true}
        setThreadMessage={setThreadMessage}
        appController={appController}
        message={parentMessage}
        highlights={highlights}
        chatLinkedContent={chatLinkedContent}
        messagesCount={messagesCount}
        channel={channel}
        setPanel={setPanel}
      />
      {messages}
    </div>
  );
}

function ThreadedMessages({
  appController,
  parentMessage,
  chatLinkedContent,
  setHighlights,
  setMessageCount,
  channel,
  setPanel,
}) {
  const [needsToLoad, setNeedsToLoad] = useState(true);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    window.addEventListener("deleteThreadChatMessage", deleteMessage, false);
    window.addEventListener("addMessageToThread", addMessage, false);
    window.addEventListener("updateMessageToThread", updateMessage, false);
    return () => {
      window.removeEventListener(
        "deleteThreadChatMessage",
        deleteMessage,
        false
      );
      window.removeEventListener("addMessageToThread", addMessage, false);
      window.removeEventListener("updateMessageToThread", updateMessage, false);
    };
  }, []);

  useEffect(() => {
    document.querySelector(".thread textarea").scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
    document.querySelector(".thread textarea").value = "";
    document.querySelector(".thread textarea").focus();
    setMessageCount(messages.length);
  }, [messages.length]);

  useEffect(() => {
    setNeedsToLoad(true);
  }, [parentMessage.messageId]);

  const addMessage = ({ message }) => {
    if (parentMessage.messageId === message.parentMessageId)
      setMessages((messages) => [...messages, message]);
  };

  const updateMessage = (e) => {
    setMessages((messages) => {
      messages[e.index] = e.message;
      return [...messages];
    });
  };

  const deleteMessage = useCallback((e) => {
    setMessages((messages) => {
      messages.splice(e.index, 1);
      return [...messages];
    });
  }, []);

  // ** COMMENT BY ME
  // //Append New Messages
  // window.addEventListener('addMessageToThread' + parentMessage.messageId, (e) => {
  //     setMessages(messages => [...messages, e.message]);
  // }, false);

  const loadThreadedMessages = useCallback(
    (needsToLoad) => {
      appController.sendbird.loadThreadedMessages(parentMessage).then((r) => {
        setMessages([...r.threadedReplies]);
      });
    },
    [needsToLoad]
  );

  //Load Previous Messages
  if (needsToLoad) {
    setNeedsToLoad(false);
    setMessages([]);
    loadThreadedMessages(needsToLoad);
  }

  //TODO: placeholde for loading
  return messages.map((message, i) => {
    let isSameSender = false;
    if (messages[i - 1])
      isSameSender =
        messages[i - 1]?._sender?.userId === message?._sender?.userId;
    return (
      <BaseMessage
        key={message.messageId}
        index={i}
        isSameSender={isSameSender}
        inThread={true}
        isParent={false}
        appController={appController}
        message={message}
        chatLinkedContent={chatLinkedContent}
        setHighlights={setHighlights}
        channel={channel}
        setPanel={setPanel}
      />
    );
  });
}

function BaseMessage({
  appController,
  message,
  index,
  chatLinkedContent,
  isSameSender,
  setThreadMessage,
  isParent,
  inThread,
  highlights,
  setHighlights,
  inStudyGroupChat,
  messagesCount,
  channel,
  setPanel,
}) {
  const [isEdit, setIsEdit] = useState(false);
  const inputRef = useRef(null);
  const [tooltip_id] = useState(crypto.randomBytes(20).toString("hex"));
  const [replies, setReplies] = useState(() => {
    if (message.threadInfo && message.threadInfo.replyCount) {
      let replyCount = message.threadInfo.replyCount;
      let faces = message.threadInfo.mostRepliedUsers.map((u, i) => (
        <img
          key={i}
          src={
            u.plainProfileUrl 
          } onError={breakCache}
        />
      ));
      let names = message.threadInfo.mostRepliedUsers.map((u) => u.nickname);
      return { replyCount, faces, names, messageId: message.messageId };
    }
    return null;
  });
  useEffect(() => {
    if (!inThread && message.messageId) {
      window.addEventListener(
        "updateReplyCount" + message.messageId,
        updateReplyCount,
        false
      );
      window.addEventListener(
        "addMessageToThread" + message.messageId,
        addMessageToThread,
        false
      );
      return () => {
        window.removeEventListener(
          "updateReplyCount" + message.messageId,
          updateReplyCount,
          false
        );
        window.removeEventListener(
          "addMessageToThread" + message.messageId,
          addMessageToThread,
          false
        );
      };
    }
  }, [message.messageId]);

  let timestamp = timeAgoString(message.createdAt / 1000);
  
  const addMessageToThread = (e) => {
    setReplies((prevState) => {
      let replyCount =
        prevState && prevState.replyCount ? prevState.replyCount + 1 : 1;
      let names = prevState && prevState.names ? prevState.names : [];
      let faces = prevState && prevState.faces ? prevState.faces : [];
      if (names.indexOf(e.message?._sender?.nickname) < 0) {
        names.push(e.message?._sender?.nickname);
        faces.push(<img src={e.message?._sender?.plainProfileUrl} />);
      }
      return { ...prevState, replyCount, faces, names };
    });
    let event = new CustomEvent("addMessageToThread");
    event.message = e.message;
    window.dispatchEvent(event);
  };

  const updateReplyCount = ({ message, increaseCount, resetReplyCount }) => {
    setReplies((prevState) => {
      if (resetReplyCount) {
        if (message.threadInfo && message.threadInfo.replyCount) {
          let replyCount = message.threadInfo.replyCount;
          let faces = message.threadInfo.mostRepliedUsers.map((u) => (
            <img src={u.plainProfileUrl} />
          ));
          let names = message.threadInfo.mostRepliedUsers.map(
            (u) => u.nickname
          );
          return { replyCount, faces, names, messageId: message.messageId };
        }
        return null;
      } else if (!increaseCount) {
        // decrease reply count
        let replyCount = prevState.replyCount - 1;
        if (replyCount <= 0) return null; // empty count is there is no reply
        return { ...prevState, replyCount };
      }
      let replyCount =
        prevState && prevState.replyCount ? prevState.replyCount + 1 : 1;
      let names = prevState && prevState.names ? prevState.names : [];
      let faces = prevState && prevState.faces ? prevState.faces : [];
      if (names.indexOf(message?._sender?.nickname) < 0) {
        names.push(message?._sender?.nickname);
        faces.push(
          <img
            src={
              message?._sender?.plainProfileUrl 
            } onError={breakCache}
          />
        );
      }
      return { ...prevState, replyCount, faces, names };
    });
  };

  if (message.channelUrl !== channel.url) return null;

  if (message.messageType === "admin") return null;
  let isSelf =
    message?._sender?.userId === appController.states.user.social?.user_id;
  let image = (
    <img
      src={
        message?._sender?.plainProfileUrl 
      }
      alt={message?._sender?.nickname}  onError={breakCache}
    />
  );

  const handleReply = () => {
    if(isMobile()) return   appController.functions.setPopUp({
      type: `group/${message.channelUrl}`,
      ids: [`${message.messageId}`],
      popUpData: message,
      underSlug: `group/${message.channelUrl}`
    });

    appController.functions.setSlug(
      "group/" + message.channelUrl + "/" + message.messageId
    );
    if (typeof setThreadMessage !== "function") return false;
    updateReplyCount({ message, resetReplyCount: true });
    setThreadMessage(message);
  };

  let replyBubble = (
    <span className="replyBubble" onClick={handleReply}>
      💬{label("action_reply")}
    </span>
  );

  let replyVal = "💬 " + label("action_reply") + " ►";
  if (replies) {
    replyVal = (
      <span data-tip={replies.names.join(", ")} data-for={tooltip_id}>
        {replies.faces} 
        {replies.replyCount === 1
          ? label("reply_count_singular")
          : label("reply_count_plural",[replies.replyCount])}{" "}
        ►
        <ReactTooltip id={tooltip_id} effect="solid" />
      </span>
    );
  }

  if (message.data || inThread || replies) replyBubble = null;

  let likes = (
    <>
      <LikeButton type="chat" message={message} appController={appController} />
      {replyBubble}
    </>
  );

  let repliesLink =
    inThread || replyBubble ? null : (
      <div className="messageResponses" onClick={handleReply}>
        {replyVal}
      </div>
    );

  const handleCancelEdit = () => {
    setIsEdit(false);
    window.removeEventListener("closeEdit", handleCancelEdit, false);
    window.removeEventListener(
      "handleUpdateMessage",
      handleUpdateMessage,
      false
    );
  };
  const handleEdit = (e) => {
    setIsEdit(true);
    window.addEventListener("closeEdit", handleCancelEdit, false);
    window.addEventListener("handleUpdateMessage", handleUpdateMessage, false);
  };
  const handleDelete = () => {
    let event = new CustomEvent("showDeleteAlert");
    window.dispatchEvent(event);
    window.addEventListener("deleteMessage", deleteMessage, false);
  };
  const deleteMessage = (e) => {
    window.removeEventListener("deleteMessage", deleteMessage, false);
    if (!e.isDelete) return true; // remove listiner if message model is cancled
    channel.deleteMessage(message, function (response, error) {
      e.hideDeleteMessageAlert(); // hide delete modal
      if (error) {
        return false;
      }
      let event = null;
      if (inThread) {
        event = new CustomEvent("updateReplyCount" + message.parentMessageId);
        event.message = message;
        event.increaseCount = false;
        window.dispatchEvent(event);

        event = !isParent
          ? new CustomEvent("deleteThreadChatMessage")
          : new CustomEvent("deleteChatMessage");
        event.index = index;
        window.dispatchEvent(event);
        isParent &&
          event.type === "deleteChatMessage" &&
          setThreadMessage(false);
        return;
      }
      event = new CustomEvent("deleteChatMessage");
      event.index = index;
      window.dispatchEvent(event);
    });
  };
  const handleUpdateMessage = (e) => {
    let textbox = document.querySelector(".edit .StudyGroupChatInput input");

    if (textbox === null) return null;

    let text = textbox.value;
    if (text.includes) textbox.classList.add("sending");
    textbox.disabled = true;

    const params = new appController.sendbird.sb.UserMessageParams();
    params.message = text;
    params.customType = "comment";

    const mentionUsers = e.message
      ? getUsersFromTextInput(appController, e.message)
      : getUsersFromTextInput(appController, inputRef.current?.value);

    if (mentionUsers.length > 0) {
      params.mentionType = "users"; // Either 'users' or 'channel'
      params.mentionedUserIds = mentionUsers;
    }

    if (e.message) {
      params.message = e.message;
      params.customType = "formatted_comment";
    }

    channel.updateUserMessage(
      message.messageId,
      params,
      function (message, error) {
        if (error) {
          return;
        }

        window.removeEventListener(
          "handleUpdateMessage",
          handleUpdateMessage,
          false
        );

        textbox.value = "";
        textbox.classList.remove("sending");
        textbox.disabled = false;
        textbox.focus();

        // UPDATE MESSAGE
        let event = new CustomEvent(
          inThread && !isParent ? "updateMessageToThread" : "updateMessage"
        );

        event.message = message;
        event.index = index;

        window.dispatchEvent(event);
        // CLOSE INPUT
        event = new CustomEvent("closeEdit");
        window.dispatchEvent(event);
      }
    );
  };
  let messageActions = null;
  let counter = 0;
  if (isEdit) {
    messageActions = (
      <span className="edit" onClick={handleCancelEdit}>
        {" "}
        • Cancel
      </span>
    );
  } else {
    if (inThread) {
      counter = isParent ? messagesCount : message.threadInfo.replyCount;
    } else {
      counter = replies?.replyCount === undefined ? 0 : replies.replyCount;
    }
    let deleteActions =
      counter <= 0 ? (
        <span className="delete" onClick={handleDelete}>
          {" "}
          • {label("action_delete")}
        </span>
      ) : (
        <></>
      );
    messageActions = (
      <>
        {" "}
        {message.data !== "" ? (
          deleteActions
        ) : (
          <>
            {" "}
            <span className="edit" onClick={handleEdit}>
              {" "}
              • {label("action_edit")}
            </span>
            {deleteActions}
          </>
        )}
      </>
    );
  }

  const isBot = !!message?._sender?.metaData?.isBot;

  const botBadge = isBot ? <span className="botBadge">BOT</span> : null;

  return (
    <div
      className={
        "messageContainer" +
        (isSelf ? " self" : "") +
        (isSameSender && !message.data && !inStudyGroupChat ? " same" : "")
      }
    >
      {image}
      <div className={"messageContent"}>
        <span className="senderName">{message?._sender?.nickname} {botBadge}</span>
        <span className="timeStamp">
          {" "}
          •{" "}
          <a
            href={"group/" + channel.url + "/" + message.messageId}
            onClick={(e) => {
              e.preventDefault();
              handleReply();
            }}
          >
            {timestamp}
          </a>
        </span>
        {messageActions}
        <div className={`messageBody ${isEdit && "edit"}`}>
          <MessageTypes
            appController={appController}
            index={index}
            isEdit={isEdit}
            inThread={inThread}
            message={message}
            chatLinkedContent={chatLinkedContent}
            likes={likes}
            highlights={highlights}
            setHighlights={setHighlights}
            setPanel={setPanel}
            inputRef={inputRef}
          />
        </div>
        {repliesLink}
      </div>
      {/* {repliesLink} */}
      {/* </div> */}
    </div>
  );
}

function MessageTypes({
  appController,
  message,
  index,
  chatLinkedContent,
  likes,
  highlights,
  setHighlights,
  isEdit,
  setPanel,
  inputRef,
  inThread,
}) {
  if (!testJSON(message.data) || message.parentMessageId)
    return (
      <Message
        appController={appController}
        isEdit={isEdit}
        message={message}
        likes={likes}
        setHighlights={setHighlights}
        setPanel={setPanel}
        inputRef={inputRef}
        inThread={inThread}
      />
    );
  let data = JSON.parse(message.data);
  let key = null;
  if (data.links !== undefined) [key] = Object.keys(data.links);
  switch (key) {
    case "img":
      return (
        <ImageComment
          appController={appController}
          message={message}
          likes={likes}
          chatLinkedContent={chatLinkedContent}
          setPanel={setPanel}
        />
      );
    case "com":
      return (
        <CommentaryComment
          appController={appController}
          message={message}
          likes={likes}
          chatLinkedContent={chatLinkedContent}
          highlights={highlights}
          setPanel={setPanel}
        />
      );
    case "fax":
      return (
        <FaxComment
          appController={appController}
          message={message}
          likes={likes}
          chatLinkedContent={chatLinkedContent}
          setPanel={setPanel}
        />
      );
    case "text":
      return (
        <TextComment
          appController={appController}
          isEdit={isEdit}
          message={message}
          likes={likes}
          chatLinkedContent={chatLinkedContent}
          highlights={highlights}
          setPanel={setPanel}
        />
      );
    case "section":
      return (
        <SectionComment
          appController={appController}
          isEdit={isEdit}
          message={message}
          likes={likes}
          chatLinkedContent={chatLinkedContent}
          highlights={highlights}
          setPanel={setPanel}
        />
      );
    default:
      return (
        <Message
          appController={appController}
          isEdit={isEdit}
          message={message}
          likes={likes}
          setPanel={setPanel}
          inputRef={inputRef}
          inThread={inThread}
        />
      );
  }
}

function TextComment({
  appController,
  isEdit,
  message,
  chatLinkedContent,
  likes,
  highlights,
  setPanel,
}) {
  let data = JSON.parse(message.data);
  useEffect(() => {
    if (isEdit) {
      let textbox = document.querySelector(".edit .StudyGroupChatInput input");
      if (textbox === null) return null;
      textbox.value =
        message.message === "•" ? data.description : message.message;
    }
  }, [isEdit]);

  let activeHighlights =
    highlights && highlights.length > 0 ? highlights : data.highlights;

  let textData =
    chatLinkedContent && chatLinkedContent.textInFeed
      ? chatLinkedContent.textInFeed[message.customType + "/" + data.links.text]
      : false;

  let messageText = formatText(message, setPanel);

  if (message.message === "•" && data.description)
    message.message = <span className={"desc"}>⭐ {data.description}</span>;

  const updateMessage = () => {
    let event = new CustomEvent("handleUpdateMessage");
    window.dispatchEvent(event);
  };

  return !isEdit ? (
    <div>
      {messageText} {likes}
      <TextInFeed
        textData={textData}
        hasStar={true}
        appController={appController}
        highlights={activeHighlights}
      />
    </div>
  ) : (
    <div className={"StudyGroupChatInput editText"}>
      <div className="topRow">
        <input
          type="text"
          placeholder="Update your comment"
          autoFocus={!isMobile()}
          onKeyUp={(e) => {
            if (e.key === "Enter" && !e.shiftKey) updateMessage();
          }}
        />
        <button className="btn btn-primary" onClick={updateMessage}>
          ✉️ Update
        </button>
      </div>
    </div>
  );
}

function CommentaryComment({
  appController,
  message,
  chatLinkedContent,
  likes,
  highlights,
  setPanel,
}) {
  let data = JSON.parse(message.data);

  let activeHighlights =
    highlights && highlights.length > 0 ? highlights : data.highlights;

  let comData =
    chatLinkedContent && chatLinkedContent.commentaryInFeed
      ? chatLinkedContent.commentaryInFeed[data.links.com]
      : false;

  let messageText = formatText(message, setPanel);

  if (message.message === "•" && data.description)
    message.message = <span className={"desc"}>⭐ {data.description}</span>;

  return (
    <div>
      {messageText} {likes}
      <CommentaryInFeed
        comData={comData}
        hasStar={true}
        appController={appController}
        highlights={activeHighlights}
      />
    </div>
  );
}

function SectionComment({
  appController,
  message,
  chatLinkedContent,
  likes,
  highlights,
  isEdit,
  setPanel,
}) {
  useEffect(() => {
    if (isEdit) {
      let textbox = document.querySelector(".edit .StudyGroupChatInput input");
      if (textbox === null) return null;
      textbox.value = message.message;
    }
  }, [isEdit]);

  let data = JSON.parse(message.data);
  let activeHighlights =
    highlights && highlights.length > 0 ? highlights : data.highlights;
  let sectionData =
    chatLinkedContent && chatLinkedContent.sectionInFeed
      ? chatLinkedContent.sectionInFeed[
          message.customType + "/" + data.links.section
        ]
      : false;

  const updateMessage = () => {
    let event = new CustomEvent("handleUpdateMessage");
    window.dispatchEvent(event);
  };

  let messageText = formatText(message, setPanel);

  if (message.message === "•" && data.description)
    message.message = <span className={"desc"}>⭐ {data.description}</span>;

  return !isEdit ? (
    <div>
      {messageText} {likes}
      <SectionInFeed
        sectionData={sectionData}
        hasStar={true}
        appController={appController}
        highlights={activeHighlights}
      />
    </div>
  ) : (
    <div className={"StudyGroupChatInput editText"}>
      <div className="topRow">
        <input
          type="text"
          placeholder="Update your comment"
          autoFocus={!isMobile()}
          onKeyUp={(e) => {
            if (e.key === "Enter" && !e.shiftKey) updateMessage();
          }}
        />
        <button className="btn btn-primary" onClick={updateMessage}>
          ✉️ Update
        </button>
      </div>
    </div>
  );
}

function ImageComment({
  appController,
  message,
  chatLinkedContent,
  likes,
  setPanel,
}) {
  let data = JSON.parse(message.data);
  let imageData =
    chatLinkedContent && chatLinkedContent.imageInFeed
      ? chatLinkedContent.imageInFeed[data.links.img]
      : false;

  let messageText = formatText(message, setPanel);
  if (message.message === "•")
    message.message = <span className={"desc"}>⭐ {data.description}</span>;

  return (
    <div>
      {messageText} {likes}
      <ImageInFeed
        imageData={imageData}
        hasStar={true}
        appController={appController}
      />
    </div>
  );
}

function FaxComment({
  appController,
  message,
  chatLinkedContent,
  likes,
  setPanel,
}) {
  let data = JSON.parse(message.data);
  if (!data.links.fax || !data.links.fax.match) return null;

  let textNum = data.links.fax.match(/^\d+/)[0];
  let version = data.links.fax.match(/[^.]+$/)[0];

  let textData =
    chatLinkedContent && chatLinkedContent.textInFeed
      ? chatLinkedContent.textInFeed[message.customType + "/" + textNum]
      : false;

  let messageText = formatText(message, setPanel);
  if (message.message === "•")
    message.message = <span className={"desc"}>⭐ {data.description}</span>;

  return (
    <div>
      {messageText} {likes}
      <FaxInFeed
        textData={textData}
        version={version}
        hasStar={true}
        appController={appController}
      />
    </div>
  );
}

// function AdminMessage({ appController, message }) {

//     return <div className="AdminMessage">ADMIN: {JSON.stringify(message.data)}</div>

// }

function Message({
  appController,
  message,
  index,
  inThread,
  likes,
  setHighlights,
  isEdit,
  setPanel,
  inputRef,
}) {
  const [editorData, setEditorData] = useState("");
  const [showTagList, setShowTagList] = useState(false);
  const [editorBounds, setEditorBounds] = useState(null);
  useEffect(() => {
    if (isEdit) {
      if (message.customType === "formatted_comment")
        return setEditorData(message.message);
      let textbox = document.querySelector(".edit .StudyGroupChatInput input");
      if (textbox === null) return null;
      textbox.value = message.message;
    }
  }, [isEdit, message.message]);

  const handleMouseEnter = () => {
    if (data && data.highlights && data.highlights.length > 0) {
      setHighlights && setHighlights(data.highlights);
      document.querySelector(".thread .highlightInFeed")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
  };

  const handleMouseLeave = () => {
    setHighlights && setHighlights([]);
  };

  const updateMessage = () => {
    let event = new CustomEvent("handleUpdateMessage");
    event.message = editorData;
    window.dispatchEvent(event);
  };

  let data = testJSON(message.data) ? JSON.parse(message.data) : {};
  let highlightTags = null;
  if (data && data.highlights) {
    if (data.highlights.length > 0)
      highlightTags = (
        <div className="commentHighlightTags">
          {data.highlights.map((h, i) => (
            <span key={h + i} className="commentHighlightTag">
              “{h}”
            </span>
          ))}
        </div>
      );
  }

  let messageText = formatText(message, setPanel);

  if (message.customType === "formatted_comment") {
    if (typeof messageText !== "object") {
      messageText = ParseMessage(messageText);
    }
  }
  if (messageText === "•" && highlightTags) messageText = "";
  return !isEdit ? (
    <div
      className="Message"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {highlightTags}
      {ParseMessage(messageText)} {likes}
    </div>
  ) : message.customType === "formatted_comment" ? (
    <div
      className={`StudyGroupChatInput editText${inThread ? " editThread" : ""}`}
    >
      <ReactQuill
        value={editorData}
        onKeyDown={(e) => {
          if (e.key === "Backspace" || e.key === "Escape") {
            if (showTagList) setShowTagList(false);
          }
        }}
        onKeyPress={(e) => {
          if (showTagList) {
            return setShowTagList(false);
          }
          if (e.key === "@") {
            setShowTagList(true);
          }
        }}
        onChangeSelection={(range, source, editor) => {
          if (range?.index) {
            setEditorBounds(editor.getBounds(range.index, range.length));
          }
        }}
        onChange={(content) => {
          setEditorData(content);
        }}
        theme="snow"
        modules={modules}
        formats={formats}
        style={{
          backgroundColor: "white",
        }}
      />
      {showTagList && (
        <TagList
          appController={appController}
          setShowTagList={setShowTagList}
          editorBounds={editorBounds}
          isEditor={true}
          editorData={editorData}
          setEditorData={setEditorData}
          inThread={inThread}
        />
      )}
      <button className="btn btn-primary" onClick={updateMessage}>
        ✉️ Update
      </button>
    </div>
  ) : (
    <div className={"StudyGroupChatInput editText"}>
      <div className="topRow">
        <input
          type="text"
          className="updateInput"
          placeholder="Update your comment"
          autoFocus={!isMobile()}
          ref={inputRef}
          onKeyDown={(e) => {
            if (e.key === "Backspace" || e.key === "Escape") {
              if (showTagList) setShowTagList(false);
            }
          }}
          onKeyPress={(e) => {
            if (showTagList) {
              return setShowTagList(false);
            }
            if (e.key === "@") {
              setShowTagList(true);
            }
          }}
          onClick={(e) => {
            showTagList && setShowTagList(false);
          }}
          onKeyUp={(e) => {
            if (e.key === "Enter" && !e.shiftKey) updateMessage();
          }}
        />
        {showTagList && (
          <TagList
            appController={appController}
            setShowTagList={setShowTagList}
            inputRef={inputRef}
          />
        )}
        <button className="btn btn-primary" onClick={updateMessage}>
          ✉️ Update
        </button>
      </div>
    </div>
  );
}
