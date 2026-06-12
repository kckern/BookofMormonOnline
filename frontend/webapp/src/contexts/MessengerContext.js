/**
 * MessengerContext — owns the messenger controller lifecycle.
 *
 * Step 1 of the appController→context migration (see
 * docs/specs/2026-06-11-messenger-context-provider.md). The provider creates
 * the controller when sign-in state appears, disconnects it on identity
 * change / sign-out / unmount, and assigns appController.sendbird as a
 * compatibility bridge for existing consumers (including non-React code).
 * New code should consume useMessenger() instead of the bridge.
 */
import React, { createContext, useContext, useRef, useState } from "react"; // eslint-disable-line no-unused-vars
import MessengerController from "src/models/MessengerController";
import { isMessengerEnabled } from "src/models/featureFlags";

// eslint-disable-next-line no-unused-vars
const USE_MESSENGER = isMessengerEnabled(); // used in Task 2

// Signed-out / messaging-disabled stub. Same surface the legacy
// createChatController no-op branch exposed; also the bridge's value after
// teardown — Main.js shows a Loader when sendbird === null, so the bridge
// must never be null.
export const noopController = (userId) => ({
  connect: () => Promise.resolve({ user_id: userId, nickname: "User" }),
  getStudyGroups: () => Promise.resolve([]),
  loadGroupMessages: () => Promise.resolve([]),
  loadPreviousMessages: () => Promise.resolve([]),
  sendUserMessage: () => Promise.reject(new Error("Messaging unavailable")),
  updateUserState: () => {},
  updateUserSummary: () => {},
  fireStudyGroupAction: () => {},
  fetchRoomFromGroup: () => Promise.resolve(null),
  loadUnreadDMs: () => Promise.resolve({}),
  disconnect: () => {},
  updatePagePosition: () => {},
  updateTypingLocation: () => {},
  loadThreadedMessages: () =>
    Promise.resolve({ parentMessage: null, threadedMessages: [] }),
  getCurrentUser: () => ({ userId, metaData: {} }),
  sb: { currentUser: { userId, metaData: {} } },
  _currentUser: { user_id: userId, nickname: "User" },
});

// eslint-disable-next-line no-unused-vars
const defaultFactory = (userId, accessToken, appController) => // used in Task 2
  new MessengerController(
    process.env.REACT_APP_API_URL || window.location.origin,
    userId,
    accessToken,
    appController,
  );

export const MessengerContext = createContext(null);
export const useMessenger = () => useContext(MessengerContext);

export function MessengerProvider({ appController, children, createController = defaultFactory }) {
  const [controller, setController] = useState(null); // eslint-disable-line no-unused-vars

  // The appController object is recreated by spread on every dispatch; keep a
  // ref so the effect always bridges onto the live object without re-running.
  const appRef = useRef(appController); // eslint-disable-line no-unused-vars
  appRef.current = appController;

  // eslint-disable-next-line no-unused-vars
  const socialUserId = appController.states.user.social?.user_id || null; // used in Task 2
  // eslint-disable-next-line no-unused-vars
  const token = appController.states.user.token || null; // used in Task 2

  // Lifecycle effect added in Task 2.

  return (
    <MessengerContext.Provider value={controller}>
      {children}
    </MessengerContext.Provider>
  );
}
