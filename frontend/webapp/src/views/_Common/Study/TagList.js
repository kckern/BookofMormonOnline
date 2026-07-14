import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { position } from "caret-pos";
import { useAppController } from "src/contexts/AppControllerContext";
import "./TagList.css";

// Returns the active "@token" the caret is sitting in (for a plain textarea),
// or null if the caret is not currently inside an @mention token.
// `value` is the full text, `caret` is the caret offset (selectionStart).
function getActiveMentionToken(value, caret) {
  if (value == null) return null;
  // Walk back from the caret to find the nearest unbroken @… run.
  let start = caret;
  while (start > 0) {
    const ch = value[start - 1];
    if (ch === "@") {
      start -= 1;
      break;
    }
    // A whitespace before reaching an @ means the caret isn't in a mention.
    if (/\s/.test(ch)) return null;
    start -= 1;
  }
  if (value[start] !== "@") return null;
  // The token query is everything between the @ and the caret.
  return { start, end: caret, query: value.slice(start + 1, caret) };
}

export default function TagList({
  setShowTagList,
  setCommentMessage,
  inputRef,
  editorBounds,
  isEditor,
  editorData,
  setEditorData,
  inThread,
}) {
  const appController = useAppController();
  const textbox = isEditor
    ? document.querySelector(`${inThread ? ".editThread " : ""}.ql-editor`)
    : inputRef.current;

  const allMembers = appController.states.studyGroup.activeGroup.members.filter(
    (member) => member.userId !== appController.states.user.user
  );

  // Live filter query derived from the @token at the caret. `tick` forces a
  // re-read of the textbox value on every keystroke (the textbox is uncontrolled).
  const [tick, setTick] = useState(0);
  const [highlight, setHighlight] = useState(0);

  let query = "";
  if (textbox && !isEditor && typeof textbox.selectionStart === "number") {
    const token = getActiveMentionToken(textbox.value, textbox.selectionStart);
    if (token) query = token.query;
  } else if (isEditor) {
    // Editor: best-effort filter on text after the last "@".
    const raw =
      (editorData != null ? editorData : appController.states.editor.value) ||
      "";
    const plain = raw.replace(/<[^>]*>/g, "");
    const at = plain.lastIndexOf("@");
    if (at !== -1) query = plain.slice(at + 1);
  }

  const members = allMembers.filter((member) =>
    member.nickname.toLowerCase().startsWith(query.toLowerCase())
  );

  // Keep the highlighted index in range as the filtered list changes.
  useEffect(() => {
    setHighlight((h) => (h >= members.length ? 0 : h));
  }, [members.length]);

  const pos = isEditor ? editorBounds : textbox ? position(textbox) : null;
  const coords = textbox ? textbox.getBoundingClientRect() : null;

  const insertName = (member) => {
    if (isEditor) {
      // Editor stores HTML; replace the trailing "@query" placeholder.
      let textboxValue =
        editorData != null ? editorData : appController.states.editor.value;
      const changedText = (textboxValue || "").replace(/@(\S*)$/, (m, _q, off, input) => {
        // Only replace an "@…" that is the human-typed token, not inside markup.
        return input[off + 1] === "<" ? m : "@" + member.nickname;
      });
      if (editorData != null) {
        setEditorData(changedText);
      } else {
        appController.functions.openEditor({ isOpen: true, value: changedText });
      }
      return setShowTagList(false);
    }

    // Plain textarea: replace the @token at the caret regardless of position.
    const value = textbox.value;
    const caret =
      typeof textbox.selectionStart === "number"
        ? textbox.selectionStart
        : value.length;
    const token = getActiveMentionToken(value, caret);
    const start = token ? token.start : value.lastIndexOf("@");
    const end = token ? token.end : caret;
    const replacement = "@" + member.nickname;
    const safeStart = start === -1 ? value.length : start;
    const changedText =
      value.slice(0, safeStart) + replacement + value.slice(end);

    if (setCommentMessage) {
      setCommentMessage(changedText);
    } else {
      textbox.value = changedText;
    }
    // Restore the caret just after the inserted mention.
    const newCaret = safeStart + replacement.length;
    requestAnimationFrame(() => {
      try {
        textbox.focus();
        textbox.setSelectionRange(newCaret, newCaret);
      } catch (e) {
        /* setSelectionRange unsupported on some inputs */
      }
    });

    return setShowTagList(false);
  };

  // Keyboard navigation: listen on the textbox in the capture phase so the
  // composer's own keydown (send/close) never fires while the list is open.
  const membersRef = useRef(members);
  membersRef.current = members;
  const highlightRef = useRef(highlight);
  highlightRef.current = highlight;

  useEffect(() => {
    if (!textbox) return undefined;
    const onKeyDown = (e) => {
      const list = membersRef.current;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setHighlight((h) => (list.length ? (h + 1) % list.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setHighlight((h) =>
          list.length ? (h - 1 + list.length) % list.length : 0
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (list.length) {
          e.preventDefault();
          e.stopPropagation();
          insertName(list[highlightRef.current] || list[0]);
        } else {
          setShowTagList(false);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setShowTagList(false);
      }
      // Any other key (typing, Backspace, etc.) falls through to the textbox
      // so the user keeps editing; we re-read the value to update the filter.
    };
    // Re-filter after the keystroke has updated the textbox value.
    const onKeyUp = () => setTick((t) => t + 1);
    textbox.addEventListener("keydown", onKeyDown, true);
    textbox.addEventListener("keyup", onKeyUp, true);
    return () => {
      textbox.removeEventListener("keydown", onKeyDown, true);
      textbox.removeEventListener("keyup", onKeyUp, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textbox]);

  // If the filter empties the list, close the popup (the @token no longer
  // matches anyone / the caret left the token).
  useEffect(() => {
    if (textbox && !isEditor && typeof textbox.selectionStart === "number") {
      const token = getActiveMentionToken(textbox.value, textbox.selectionStart);
      if (!token) setShowTagList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const ulRef = useRef(null);
  useLayoutEffect(() => {
    if (!ulRef.current || !coords || !pos) return;
    const leftDistance = coords.left + 10 + pos.left;
    const topDistance = coords.top - ulRef.current.offsetHeight + pos.top;
    ulRef.current.style.left = `${leftDistance}px`;
    ulRef.current.style.top = `${topDistance}px`;
  });

  if (!textbox) return null;

  return (
    <ul
      className="tagList"
      ref={ulRef}
      role="listbox"
      aria-label="Mention a group member"
    >
      {members.map((member, i) => (
        <li
          key={member.userId}
          className={`tagListItem${i === highlight ? " active" : ""}`}
          role="option"
          aria-selected={i === highlight}
          onMouseEnter={() => setHighlight(i)}
          onMouseDown={(e) => {
            // mousedown (not click) so the textbox doesn't blur/close first.
            e.preventDefault();
            insertName(member);
          }}
        >
          {member.nickname}
        </li>
      ))}
    </ul>
  );
}
