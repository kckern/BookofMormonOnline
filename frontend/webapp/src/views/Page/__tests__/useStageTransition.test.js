import { runStageTransition } from "../useStageTransition";

const instant = () => Promise.resolve();

test("runs the class choreography and clears after ready", async () => {
  const calls = [];
  let ready = false;
  const navigate = () => { ready = true; };
  await runStageTransition({
    setStageClass: (c) => calls.push(c),
    navigate,
    isReady: () => ready,
    waitFn: instant,
  });
  expect(calls).toEqual(["stageLeft", "stageRight stageLeft", "stageRight", null]);
});

test("back direction swaps the class order", async () => {
  const calls = [];
  await runStageTransition({
    setStageClass: (c) => calls.push(c),
    navigate: () => {},
    isReady: () => true,
    direction: "back",
    waitFn: instant,
  });
  expect(calls[0]).toBe("stageRight");
});

test("gives up and clears the stage class when ready never comes", async () => {
  const calls = [];
  let fakeNow = 0;
  await runStageTransition({
    setStageClass: (c) => calls.push(c),
    navigate: () => {},
    isReady: () => false,
    waitFn: (ms) => { fakeNow += ms; return Promise.resolve(); },
    now: () => fakeNow,
    timeoutMs: 1000,
  });
  expect(calls[calls.length - 1]).toBeNull(); // no longer an infinite loop
});
