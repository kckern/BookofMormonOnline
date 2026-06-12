import React from "react";
import { render, act } from "@testing-library/react";
import {
  MessengerProvider,
  useMessenger,
  noopController,
} from "../MessengerContext";

// Minimal appController fixture. social: null = guest.
const makeApp = ({ social = null, token = "tok-1", user = null } = {}) => ({
  states: { user: { user, token, social } },
  functions: { setStudyGroups: jest.fn(), messengerBridgeChanged: jest.fn() },
});

// Probe component records what useMessenger() returns each render.
let lastCtx;
function Probe() {
  lastCtx = useMessenger();
  return null;
}

const renderProvider = (app, factory) =>
  render(
    <MessengerProvider appController={app} createController={factory}>
      <Probe />
    </MessengerProvider>,
  );

beforeEach(() => {
  lastCtx = undefined;
});

test("guest mount: no controller created, context is null, bridge untouched", () => {
  const app = makeApp();
  const factory = jest.fn();
  renderProvider(app, factory);
  expect(factory).not.toHaveBeenCalled();
  expect(lastCtx).toBeNull();
  expect(app.sendbird).toBeUndefined();
});

test("noopController has the legacy stub surface", async () => {
  const stub = noopController("u1");
  expect(stub.disconnect).toBeInstanceOf(Function);
  expect(stub.updateUserState).toBeInstanceOf(Function);
  expect(stub.getCurrentUser()).toMatchObject({ userId: "u1" });
  expect(stub.sb.currentUser.userId).toBe("u1");
  await expect(stub.getStudyGroups()).resolves.toEqual([]);
  await expect(stub.loadUnreadDMs()).resolves.toEqual({});
  await expect(stub.loadThreadedMessages()).resolves.toEqual({
    parentMessage: null,
    threadedMessages: [],
  });
  await expect(stub.loadPageComments()).resolves.toEqual({ messages: [], counts: {} });
});

const makeController = () => ({
  disconnect: jest.fn(),
  getStudyGroups: jest.fn().mockResolvedValue([{ url: "g1" }]),
});

const rerenderWith = (rerender, app, factory) =>
  rerender(
    <MessengerProvider appController={app} createController={factory}>
      <Probe />
    </MessengerProvider>,
  );

test("sign-in: creates controller, bridges appController.sendbird, bootstraps groups", async () => {
  const app = makeApp({ social: { user_id: "abc123" }, user: "kc" });
  const ctrl = makeController();
  const factory = jest.fn(() => ctrl);
  renderProvider(app, factory);

  expect(factory).toHaveBeenCalledWith("abc123", "tok-1", app);
  expect(app.sendbird).toBe(ctrl);
  expect(lastCtx).toBe(ctrl);
  // bootstrap (getStudyGroups → setStudyGroups) moved here from the dispatch fns
  await act(async () => {});
  expect(ctrl.getStudyGroups).toHaveBeenCalled();
  expect(app.functions.setStudyGroups).toHaveBeenCalledWith([{ url: "g1" }]);
});

test("guest → sign-in transition creates the controller", () => {
  const app = makeApp();
  const ctrl = makeController();
  const factory = jest.fn(() => ctrl);
  const { rerender } = renderProvider(app, factory);
  expect(factory).not.toHaveBeenCalled();

  const signedIn = makeApp({ social: { user_id: "abc123" }, user: "kc" });
  rerender(
    <MessengerProvider appController={signedIn} createController={factory}>
      <Probe />
    </MessengerProvider>,
  );
  expect(factory).toHaveBeenCalledTimes(1);
  expect(factory).toHaveBeenCalledWith("abc123", "tok-1", signedIn);
  expect(signedIn.sendbird).toBe(ctrl);
});

test("falls back to social.access_token when user token is absent", () => {
  const app = makeApp({ social: { user_id: "abc123", access_token: "at-9" }, token: null });
  const factory = jest.fn(() => makeController());
  renderProvider(app, factory);
  expect(factory).toHaveBeenCalledWith("abc123", "at-9", app);
});

test("identity change: disconnect old, create new", () => {
  const appA = makeApp({ social: { user_id: "userA" }, user: "a" });
  const ctrlA = makeController();
  const ctrlB = makeController();
  const factory = jest.fn().mockReturnValueOnce(ctrlA).mockReturnValueOnce(ctrlB);
  const { rerender } = renderProvider(appA, factory);

  const appB = makeApp({ social: { user_id: "userB" }, user: "b" });
  rerenderWith(rerender, appB, factory);

  expect(ctrlA.disconnect).toHaveBeenCalledTimes(1);
  expect(factory).toHaveBeenCalledTimes(2);
  expect(appB.sendbird).toBe(ctrlB);
});

test("sign-out: disconnect, bridge resets to no-op stub (never null), context null", () => {
  const app = makeApp({ social: { user_id: "userA" }, user: "a" });
  const ctrl = makeController();
  const factory = jest.fn(() => ctrl);
  const { rerender } = renderProvider(app, factory);

  const guest = makeApp(); // processSignOut clears social
  rerenderWith(rerender, guest, factory);

  expect(ctrl.disconnect).toHaveBeenCalledTimes(1);
  expect(lastCtx).toBeNull();
  // cleanup bridges the stub onto the appController live at cleanup time
  expect(guest.sendbird).toBeDefined();
  expect(guest.sendbird).not.toBeNull();
  expect(guest.sendbird.disconnect).toBeInstanceOf(Function);
  // Teardown writes through appRef.current (the appController live at cleanup
  // time = guest); the original app keeps its bridged controller untouched.
  expect(app.sendbird).toBe(ctrl);
});

test("unmount disconnects", () => {
  const app = makeApp({ social: { user_id: "userA" }, user: "a" });
  const ctrl = makeController();
  const { unmount } = renderProvider(app, jest.fn(() => ctrl));
  unmount();
  expect(ctrl.disconnect).toHaveBeenCalledTimes(1);
});

test("bridge changes are announced via messengerBridgeChanged dispatch", () => {
  const app = makeApp({ social: { user_id: "abc123" }, user: "kc" });
  const factory = jest.fn(() => makeController());
  const { rerender } = renderProvider(app, factory);
  // create
  expect(app.functions.messengerBridgeChanged).toHaveBeenCalledTimes(1);

  const guest = makeApp(); // sign-out
  rerenderWith(rerender, guest, factory);
  // cleanup announces on the appController live at teardown
  expect(guest.functions.messengerBridgeChanged).toHaveBeenCalledTimes(1);
});
