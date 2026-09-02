/**
 * MessengerContext — owns the messenger controller lifecycle.
 *
 * Step 1 of the appController→context migration (see
 * docs/specs/2026-06-11-messenger-context-provider.md). The provider creates
 * the controller when sign-in state appears, disconnects it on identity
 * change / sign-out / unmount, and assigns appController.messenger as a
 * compatibility bridge for existing consumers (including non-React code).
 * New code should consume useMessenger() instead of the bridge.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import MessengerController from "src/models/MessengerController";
import { isMessengerEnabled } from "src/models/featureFlags";

const USE_MESSENGER = isMessengerEnabled();

// Signed-out / messaging-disabled stub. Same surface the legacy
// createChatController no-op branch exposed; also the bridge's value after
// teardown — Main.js shows a Loader when messenger === null, so the bridge
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
  loadUnreadDMs: () => Promise.resolve({}),
  loadNotifications: () => Promise.resolve([]),
  loadNotificationUnreadCount: () => Promise.resolve(0),
  subscribePublicChannel: () => Promise.resolve(false),
  unsubscribePublicChannel: () => Promise.resolve(false),
  markNotificationRead: () => Promise.resolve(null),
  markAllNotificationsRead: () => Promise.resolve(null),
  disconnect: () => {},
  updatePagePosition: () => {},
  updateTypingLocation: () => {},
  loadThreadedMessages: () =>
    Promise.resolve({ parentMessage: null, threadedMessages: [] }),
  loadPageComments: () => Promise.resolve({ messages: [], counts: {} }),
  getCurrentUser: () => ({ userId, metaData: {} }),
  sb: { currentUser: { userId, metaData: {} } },
  _currentUser: { user_id: userId, nickname: "User" },
});

const defaultFactory = (userId, accessToken, appController) =>
  new MessengerController(
    process.env.REACT_APP_API_URL || window.location.origin,
    userId,
    accessToken,
    appController,
  );

export const MessengerContext = createContext(null);
export const useMessenger = () => useContext(MessengerContext);

export function MessengerProvider({ appController, children, createController = defaultFactory }) {
  const [controller, setController] = useState(null);

  // The appController object is recreated by spread on every dispatch; keep a
  // ref so the effect always bridges onto the live object without re-running.
  const appRef = useRef(appController);
  appRef.current = appController;

  const socialUserId = appController.states.user.social?.user_id || null;
  // Legacy parity: social sign-ins can carry only social.access_token before
  // a session token is minted — all three legacy call sites had this fallback.
  const token = appController.states.user.token || appController.states.user.social?.access_token || null;

  useEffect(() => {
    if (!socialUserId) return undefined;
    const app = appRef.current;

    if (!USE_MESSENGER) {
      app.messenger = noopController(socialUserId);
      app.functions.messengerBridgeChanged?.();
      return undefined;
    }

    let cancelled = false;

    const ctrl = createController(socialUserId, token, app);
    app.messenger = ctrl; // compatibility bridge for the non-React / above-provider references
    setController(ctrl);
    app.functions.messengerBridgeChanged?.();

    // Sign-in bootstrap, moved out of socialSignIn / setPreLoadData /
    // processSignIn — they are pure state updates now.
    ctrl
      .getStudyGroups()
      .then((list) => {
        if (cancelled) return; // teardown raced the bootstrap — drop stale groups
        appRef.current.functions.setStudyGroups(list);
      })
      .catch((e) => console.warn("Messenger: study-group bootstrap failed", e));

    // Seed the bell badge with the unread notification count (one fetch on
    // boot; thereafter the badge is patched in place by socket pushes — no
    // polling). The full feed is loaded lazily when the bell is opened.
    ctrl
      .loadNotificationUnreadCount()
      .then((count) => {
        if (cancelled) return;
        appRef.current.functions.setNotificationUnreadCount(count);
      })
      .catch((e) => console.warn("Messenger: notification count bootstrap failed", e));

    return () => {
      cancelled = true;
      try {
        ctrl.disconnect();
      } catch (e) {
        console.warn("Messenger: controller teardown failed", e);
      }
      // Never null: Main.js shows a Loader while user is set and
      // messenger === null.
      appRef.current.messenger = noopController(socialUserId);
      setController(null);
      appRef.current.functions.messengerBridgeChanged?.();
    };
    // createController is intentionally omitted: a stable factory is part of
    // the provider contract (tests pass a constant; prod uses defaultFactory).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialUserId, token]);

  return (
    <MessengerContext.Provider value={controller || noopController(socialUserId)}>
      {children}
    </MessengerContext.Provider>
  );
}
