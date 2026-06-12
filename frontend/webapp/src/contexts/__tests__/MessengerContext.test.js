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
  functions: { setStudyGroups: jest.fn() },
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
});

const makeController = () => ({
  disconnect: jest.fn(),
  getStudyGroups: jest.fn().mockResolvedValue([{ url: "g1" }]),
});

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
  expect(signedIn.sendbird).toBe(ctrl);
});
