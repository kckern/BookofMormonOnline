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
