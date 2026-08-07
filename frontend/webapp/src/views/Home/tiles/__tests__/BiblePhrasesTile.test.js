import React from "react";
import { markShared } from "../BiblePhrasesTile";

// A <mark> element vs a plain string: React elements are objects with a `type`.
const isMark = (node) => React.isValidElement(node) && node.type === "mark";
const markedText = (nodes) =>
  nodes.filter(isMark).map((n) => n.props.children).join("|");

describe("markShared", () => {
  test("marks a 4+ word verbatim run in both passages", () => {
    const [a, b] = markShared(
      "and it came to pass that Nephi went up",
      "and it came to pass that Lehi departed"
    );
    // the shared opening clause is >= 4 words → marked on both sides
    expect(markedText(a).toLowerCase()).toContain("and it came to pass");
    expect(markedText(b).toLowerCase()).toContain("and it came to pass");
  });

  test("does not mark an overlap shorter than four words", () => {
    const [a] = markShared("the ark of God", "the temple of Solomon");
    // only "the" (and "of") overlap — never a 4-word run → nothing marked
    expect(a.some(isMark)).toBe(false);
  });

  test("preserves the original casing of the marked fragment", () => {
    const [a] = markShared(
      "And It Came To Pass that they journeyed",
      "and it came to pass that they rested"
    );
    // matching is case-insensitive but the emitted text keeps side A's casing
    expect(markedText(a)).toMatch(/And It Came To Pass/);
  });

  test("returns two node arrays even when nothing is shared", () => {
    const result = markShared("alpha beta", "gamma delta");
    expect(Array.isArray(result[0])).toBe(true);
    expect(Array.isArray(result[1])).toBe(true);
  });
});
