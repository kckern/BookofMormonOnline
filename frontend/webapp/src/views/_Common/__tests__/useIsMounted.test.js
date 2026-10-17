import React, { useEffect } from "react";
import { render } from "@testing-library/react";
import { useIsMounted } from "../ViewUtils";

// Blind audit r4 commentary C4 (phone): the commentary drawer read
// useIsMounted() — the ref's value AT FIRST RENDER (false) — inside its fetch
// callback, so `if (!isMounted) return` dropped every response and the drawer
// spun forever. The hook must return a live check.
test("useIsMounted reports the live mount state to async callbacks", async () => {
  let check;
  function Probe() {
    const isMounted = useIsMounted();
    useEffect(() => { check = isMounted; }, []);
    return null;
  }
  const { unmount } = render(<Probe />);
  expect(typeof check).toBe("function");
  expect(check()).toBe(true);
  unmount();
  expect(check()).toBe(false);
});
