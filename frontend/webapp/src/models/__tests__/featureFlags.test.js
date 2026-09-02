import { isMessengerEnabled, isMessengerNavigationEnabled, isUnlistedMessengerPath } from "../featureFlags";

const setHost = (host) => {
  delete window.location;
  window.location = { host, pathname: "/" };
};

afterEach(() => {
  delete window.location;
  window.location = { host: "localhost", pathname: "/" };
});

test("production apex enables messenger only on the exact unlisted beta path", () => {
  delete window.location;
  window.location = { host: "bookofmormon.online", pathname: "/home/feed" };
  expect(isUnlistedMessengerPath()).toBe(true);
  expect(isMessengerEnabled()).toBe(true);
  expect(isMessengerNavigationEnabled()).toBe(false);
  window.location.pathname = "/home/feedback";
  expect(isUnlistedMessengerPath()).toBe(false);
  expect(isMessengerEnabled()).toBe(false);
});

describe("isMessengerEnabled host matching", () => {
  test.each([
    "localhost:8200",
    "127.0.0.1:8200",
    "10.0.0.10:8200",
    "192.168.1.50:8200",
    "172.16.0.2:8200",
    "172.31.255.254",
    "[::1]:8200",
  ])("on for local/private host %s", (host) => {
    setHost(host);
    expect(isMessengerEnabled()).toBe(true);
    expect(isMessengerNavigationEnabled()).toBe(true);
  });

  test.each([
    "staging.bookofmormon.online",
    "staging-ko.bookofmormon.online",
    "bom.kckern.net",
  ])("on for enabled subdomain %s", (host) => {
    setHost(host);
    expect(isMessengerEnabled()).toBe(true);
  });

  test.each([
    "bookofmormon.online", // prod apex stays off
    "www.bookofmormon.online",
    "172.32.0.1", // outside the 172.16/12 private block
    "11.0.0.10", // public, despite resembling 10/8
  ])("off for public host %s", (host) => {
    setHost(host);
    expect(isMessengerEnabled()).toBe(false);
  });
});
