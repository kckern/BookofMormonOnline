import { useCallback, useEffect, useRef, useState } from "react";
import { position } from "caret-pos";
import "./TagList.css";

export default function TagList({
  appController,
  setShowTagList,
  setCommentMessage,
  inputRef,
  editorBounds,
  isEditor,
  editorData,
  setEditorData,
  inThread,
}) {
  console.log("InThread", inThread ? true : false);
  const textbox = isEditor
    ? document.querySelector(`${inThread ? ".editThread " : ""}.ql-editor`)
    : inputRef.current;

  console.log("textBox", textbox);
  const members = appController.states.studyGroup.activeGroup.members.filter(
    (member) => member.userId !== appController.states.user.user
  );

  const pos = isEditor ? editorBounds : position(textbox);

  const coords = textbox.getBoundingClientRect();

  const insertName = (textbox, member) => {
    let textboxValue = isEditor
      ? editorData
        ? editorData
        : appController.states.editor.value
      : textbox.value;
    const changedText = textboxValue.replace(/@/gi, (match, offset, input) => {
      if (isEditor) {
        return input[offset + 1] === "<" ? "@" + member.nickname : match;
      } else {
        return input[offset + 1] === undefined ? "@" + member.nickname : match;
      }
    });
    if (isEditor) {
      if (editorData) {
        setEditorData(changedText);
      } else {
        appController.functions.openEditor({
          isOpen: true,
          value: changedText,
        });
      }
    } else if (setCommentMessage) {
      setCommentMessage(changedText);
    } else {
      textbox.value = changedText;
    }

    return setShowTagList(false);
  };

  const list = members.map((member) => (
    <li className="tagListItem" onClick={() => insertName(textbox, member)}>
      {member.nickname}
    </li>
  ));

  useEffect(() => {
    const ulRef = document.querySelector(".tagList");
    const leftDistance = coords.left + 10 + pos.left;
    const topDistance = coords.top - ulRef.offsetHeight + pos.top;
    ulRef.style.left = `${leftDistance}px`;
    ulRef.style.top = `${topDistance}px`;
  }, []);
  return <ul className="tagList">{list}</ul>;
}
