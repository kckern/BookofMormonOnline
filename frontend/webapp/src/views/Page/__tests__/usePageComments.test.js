import React from "react";
import { render } from "@testing-library/react";
import { usePageComments } from "../usePageComments";

jest.mock("src/contexts/MessengerContext", () => ({
  useMessenger: () => null, // disconnected: hook must still register listeners & settle
}));

const makePageController = () => ({
  pageData: { slug: "lehites" },
  pageComments: null,
  states: { pageSlug: "lehites", commentGroupId: null },
  functions: {
    setPageComments: jest.fn(),
    addToPageComments: jest.fn(),
    updateToPageComment: jest.fn(),
    moveStudyBuddies: jest.fn(),
  },
  appController: {
    states: {
      user: { user: "kc", social: { user_id: "kc" } },
      studyGroup: { studyModeOn: true, activeGroup: { url: "group-1" } },
    },
    functions: { setTypingLocations: jest.fn() },
  },
});

function Probe({ pageController }) {
  usePageComments(pageController);
  return null;
}

test("registers page-scoped window listeners and removes the SAME handlers on unmount", () => {
  const added = [];
  const removed = [];
  const origAdd = window.addEventListener;
  const origRemove = window.removeEventListener;
  window.addEventListener = (name, fn) => { added.push([name, fn]); origAdd.call(window, name, fn); };
  window.removeEventListener = (name, fn) => { removed.push([name, fn]); origRemove.call(window, name, fn); };

  const { unmount } = render(<Probe pageController={makePageController()} />);
  const names = added.map(([n]) => n);
  expect(names).toContain("addMessageToPage-lehites");
  expect(names).toContain("updateMessageToPage-lehites");
  expect(names).toContain("fireStudyGroupAction");

  unmount();
  for (const [name, fn] of added.filter(([n]) => n.includes("MessageToPage") || n === "fireStudyGroupAction")) {
    expect(removed).toContainEqual([name, fn]); // identical function reference
  }

  window.addEventListener = origAdd;
  window.removeEventListener = origRemove;
});

test("incoming addMessageToPage events dispatch into the controller", () => {
  const pc = makePageController();
  render(<Probe pageController={pc} />);
  window.dispatchEvent(Object.assign(new Event("addMessageToPage-lehites"), { message: { data: "{}" } }));
  expect(pc.functions.addToPageComments).toHaveBeenCalled();
});
