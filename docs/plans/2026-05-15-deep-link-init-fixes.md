# Deep-link initialization fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the race conditions in the deep-link init pipeline (`/commentary/<id>`, `/image/<id>`, `/<pageSlug>/<textId>`) so the scroll → expand-row → popup sequence is signal-driven and deterministic instead of timer-stacked.

**Architecture:**
- Replace fixed `setTimeout(..., 1000)` chains with promise-sequenced operations that await real DOM/scroll signals (`scrollend` event, `MutationObserver` on row open state).
- Move data-not-found, route-param re-init, and image activation onto explicit code paths instead of relying on side-effect races.
- Add Playwright as the verification harness with a `window.__deepLinkEvents` instrumentation channel so test assertions are on event *ordering*, not absolute timing.

**Tech Stack:**
- Frontend: React 17 (functional + useReducer), react-router 5
- Browser APIs: `scrollend` event (Chrome 114+, Firefox 109+, Safari 17+), `MutationObserver`, `matchMedia('prefers-reduced-motion')`
- Tests: Jest (already in `react-scripts test`) for pure-function units; Playwright (new dependency) for browser sequencing
- Backend: untouched

**Source of truth:**
- Audit: `docs/audits/2026-05-15-deep-link-init-race-conditions.md`
- Reference docs: `docs/reference/commentary-route.md`, `docs/reference/image-route.md`, `docs/reference/page-text-route.md`

**File structure:**

| File | Touch type | Responsibility |
| --- | --- | --- |
| `frontend/webapp/src/models/Utils.js` | Modify | `scrollTo` → scrollend-based promise wrapper |
| `frontend/webapp/src/views/Page/Page.js` | Modify | `initPageItem` → async sequential; route-change re-init; data-not-found handling; image-init callback; remove dead ResizeObserver; `setActiveRow` auto-flag |
| `frontend/webapp/src/views/Page/Annotations.js` | Modify | `ImageBubble` no longer self-activates from URL |
| `frontend/webapp/src/models/appController.js` | Modify | `setSlug` accepts `replace` flag |
| `frontend/webapp/src/views/Page/PageNotFound.js` | Create | Not-found UI for missing commentary/image IDs |
| `frontend/webapp/src/utils/deepLinkInstrument.js` | Create | Test instrumentation channel; no-op when flag off |
| `frontend/webapp/src/utils/awaitDomOpen.js` | Create | MutationObserver-based row-open await helper |
| `frontend/webapp/src/utils/orderByDomAncestry.js` | Create | Replaces `textToOpen.sort()` with DOM-ancestor order |
| `frontend/webapp/src/utils/__tests__/orderByDomAncestry.test.js` | Create | Jest unit tests |
| `frontend/webapp/src/utils/__tests__/scrollTo.test.js` | Create | Jest unit tests for the refactored `scrollTo` |
| `frontend/webapp/src/utils/__tests__/awaitDomOpen.test.js` | Create | Jest unit tests for `awaitDomOpen` |
| `frontend/webapp/src/utils/__tests__/deepLinkInstrument.test.js` | Create | Jest unit tests for the instrumentation channel |
| `e2e/playwright.config.js` | Create | Playwright config |
| `e2e/fixtures.js` | Create | Test fixtures + dev-server helpers + instrumentation hook |
| `e2e/deeplink-commentary.spec.js` | Create | Commentary deep-link E2E |
| `e2e/deeplink-image.spec.js` | Create | Image deep-link E2E |
| `e2e/deeplink-pagetext.spec.js` | Create | Page+text deep-link E2E |
| `e2e/deeplink-renavigation.spec.js` | Create | R4 — re-navigation between deep-links |
| `e2e/deeplink-notfound.spec.js` | Create | R13 — not-found handling |
| `package.json` | Modify | Add `@playwright/test`, `e2e` script |

---

## Pre-flight

Before Task 1, confirm the dev server is running and the audit/reference docs are in place.

- [ ] **Step P1: Verify dev server running**

Run: `systemctl --user status bom-dev --no-pager | head -5`
Expected: `Active: active (running)`. If not, run `systemctl --user restart bom-dev` and tail logs (`journalctl --user -u bom-dev -f`) until the React dev server prints `Compiled successfully`.

- [ ] **Step P2: Identify a concrete test commentary ID, image ID, and page+text URL**

Open the dev frontend (`http://localhost:8200`), browse to any scripture page, click a commentary bubble in the margin. Capture the URL the popup pushes (e.g. `/commentary/12345`). Repeat for an image (click art panel → URL is `/art/<id>`). Also pick a known nested page+text URL (e.g. `/lehites/100`).

Record three IDs in a scratch note (not committed) — they're used as test fixtures in Tasks 2+:
```
COMMENTARY_ID=<id>
COMMENTARY_PAGE=<pageSlug>
COMMENTARY_TEXTID=<textId>
NESTED_COMMENTARY_ID=<id>     # one whose location is inside a quote block
IMAGE_ID=<id>
PAGE_TEXT_URL=/lehites/100    # adjust to real value
```

These IDs are dev-environment-specific; if Playwright tests need to run in CI later, swap to fixture seeding (out of scope here).

---

### Task 1: Add Playwright + instrumentation channel

**Goal:** Stand up Playwright as the verification harness, wire a `window.__deepLinkEvents` channel that records ordered events from the init pipeline. All later tasks assert on this channel.

**Files:**
- Create: `frontend/webapp/src/utils/deepLinkInstrument.js`
- Modify: `frontend/webapp/src/models/Utils.js` — emit events from `scrollTo`
- Modify: `frontend/webapp/src/views/Page/Page.js` — emit events from `initPageItem`
- Create: `e2e/playwright.config.js`
- Create: `e2e/fixtures.js`
- Create: `e2e/smoke.spec.js`
- Modify: `package.json` (root) — add `e2e` script + dev dependency
- Test: `frontend/webapp/src/utils/__tests__/deepLinkInstrument.test.js`

- [ ] **Step 1.1: Write the failing Jest test for the instrument**

Create `frontend/webapp/src/utils/__tests__/deepLinkInstrument.test.js`:

```js
import { recordDeepLinkEvent, resetDeepLinkEvents, getDeepLinkEvents } from "../deepLinkInstrument";

beforeEach(() => {
  delete window.__deepLinkInstrument;
  resetDeepLinkEvents();
});

describe("deepLinkInstrument", () => {
  test("is a no-op unless window.__deepLinkInstrument is true", () => {
    recordDeepLinkEvent("scrollStart", { distance: 100 });
    expect(getDeepLinkEvents()).toEqual([]);
  });

  test("records events when flag is on", () => {
    window.__deepLinkInstrument = true;
    recordDeepLinkEvent("scrollStart", { distance: 100 });
    recordDeepLinkEvent("scrollEnd");
    const events = getDeepLinkEvents();
    expect(events.map(e => e.name)).toEqual(["scrollStart", "scrollEnd"]);
    expect(events[0].payload).toEqual({ distance: 100 });
  });

  test("reset clears events", () => {
    window.__deepLinkInstrument = true;
    recordDeepLinkEvent("a");
    resetDeepLinkEvents();
    expect(getDeepLinkEvents()).toEqual([]);
  });

  test("events have monotonic timestamps", () => {
    window.__deepLinkInstrument = true;
    recordDeepLinkEvent("a");
    recordDeepLinkEvent("b");
    const events = getDeepLinkEvents();
    expect(events[1].t).toBeGreaterThanOrEqual(events[0].t);
  });
});
```

- [ ] **Step 1.2: Run test, confirm failure**

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern=deepLinkInstrument`
Expected: FAIL with `Cannot find module '../deepLinkInstrument'`.

- [ ] **Step 1.3: Implement the instrument**

Create `frontend/webapp/src/utils/deepLinkInstrument.js`:

```js
let events = [];

export function recordDeepLinkEvent(name, payload) {
  if (typeof window === "undefined" || !window.__deepLinkInstrument) return;
  events.push({ name, payload: payload ?? null, t: performance.now() });
  window.__deepLinkEvents = events;
}

export function getDeepLinkEvents() {
  return events.slice();
}

export function resetDeepLinkEvents() {
  events = [];
  if (typeof window !== "undefined") window.__deepLinkEvents = events;
}
```

- [ ] **Step 1.4: Run test, confirm pass**

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern=deepLinkInstrument`
Expected: 4 tests pass.

- [ ] **Step 1.5: Wire events from `scrollTo`**

Modify `frontend/webapp/src/models/Utils.js` around line 386. Keep the existing implementation for now (Task 2 rewrites it); only add event emits.

Add import at top of file (after existing imports):
```js
import { recordDeepLinkEvent } from "src/utils/deepLinkInstrument";
```

Modify `scrollTo` to emit `scrollTo:start` before the `setTimeout(window.scrollTo, ...)` and `scrollTo:callback` inside the callback `setTimeout`:

```js
export function scrollTo(scrollHeight, callback) {
  let time = 1000;
  if (!scrollHeight || scrollHeight < 0) {
    recordDeepLinkEvent("scrollTo:skip", { scrollHeight });
    if (typeof callback === "function") return callback();
    else return false;
  }
  let behavior = { top: scrollHeight, behavior: "smooth" };
  if (callback === 0) behavior.behavior = "instant";
  recordDeepLinkEvent("scrollTo:start", { scrollHeight, behavior: behavior.behavior });
  setTimeout(() => {
    window.scrollTo(behavior);
  }, time);
  if (typeof callback === "function") setTimeout(() => {
    recordDeepLinkEvent("scrollTo:callback", { scrollHeight });
    callback();
  }, time);
}
```

- [ ] **Step 1.6: Wire events from `initPageItem`**

Modify `frontend/webapp/src/views/Page/Page.js` around line 567. Add import at top:

```js
import { recordDeepLinkEvent } from "src/utils/deepLinkInstrument";
```

Inside `initPageItem`, emit events for the major sequence points:

```js
function initPageItem(pageController, callback) {
  recordDeepLinkEvent("initPageItem:enter");
  const offsetTop = document.documentElement.clientHeight * 0.2;
  let { textToOpen, itemToScrollTo } = findTextToOpen(pageController);
  let distance = itemToScrollTo?.offsetTop - offsetTop;

  textToOpen = textToOpen.sort();
  recordDeepLinkEvent("initPageItem:plan", { textToOpen, hasItem: !!itemToScrollTo });

  let time = 0;
  scrollTo(distance, () => {
    recordDeepLinkEvent("initPageItem:outerScrollDone");
    for (let i in textToOpen) {
      if (!textToOpen[i]) return false;
      setTimeout(() => {
        let el = document.querySelector(
          `[textid='${textToOpen[i]}'] .reference a`,
        );
        if (!el || el?.attributes.autoclicked) {
          recordDeepLinkEvent("initPageItem:itemSkip", { slug: textToOpen[i] });
          return false;
        }
        let coords = getCoords(el);
        el?.setAttribute("autoclicked", true);
        recordDeepLinkEvent("initPageItem:itemScrollStart", { slug: textToOpen[i] });
        scrollTo(coords?.top - offsetTop, () => {
          recordDeepLinkEvent("initPageItem:itemClick", { slug: textToOpen[i] });
          el?.click();
        });
      }, time);
      time = time + 1000;
    }

    setTimeout(() => {
      recordDeepLinkEvent("initPageItem:markAsInitiated");
      pageController.functions.markAsInitiated();
    }, time);
    if (callback) setTimeout(() => {
      recordDeepLinkEvent("initPageItem:callback");
      callback();
    }, time);
  });
}
```

- [ ] **Step 1.7: Install Playwright**

Run: `npm install -D @playwright/test && npx playwright install chromium`
Expected: `@playwright/test` appears in root `package.json` devDependencies; Chromium binary downloaded.

- [ ] **Step 1.8: Create Playwright config**

Create `e2e/playwright.config.js`:

```js
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:8200",
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: [["list"]],
});
```

- [ ] **Step 1.9: Create fixtures**

Create `e2e/fixtures.js`:

```js
const { test: base, expect } = require("@playwright/test");

const test = base.extend({
  instrumentedPage: async ({ page }, use) => {
    await page.addInitScript(() => { window.__deepLinkInstrument = true; });
    await use(page);
  },
});

async function getEvents(page) {
  return page.evaluate(() => window.__deepLinkEvents || []);
}

async function waitForEvent(page, name, timeout = 15_000) {
  return page.waitForFunction(
    (n) => (window.__deepLinkEvents || []).some(e => e.name === n),
    name,
    { timeout },
  );
}

module.exports = { test, expect, getEvents, waitForEvent };
```

- [ ] **Step 1.10: Add npm script and root devDeps note**

Modify `package.json` (root). Find the `"scripts"` section and add:

```json
"e2e": "playwright test --config=e2e/playwright.config.js"
```

- [ ] **Step 1.11: Write a smoke E2E**

Create `e2e/smoke.spec.js`. Substitute `COMMENTARY_ID` from Step P2:

```js
const { test, expect, getEvents, waitForEvent } = require("./fixtures");

const COMMENTARY_ID = process.env.E2E_COMMENTARY_ID || "REPLACE_ME";

test("commentary deep-link emits the expected sequence", async ({ instrumentedPage: page }) => {
  test.skip(COMMENTARY_ID === "REPLACE_ME", "Set E2E_COMMENTARY_ID to run");
  await page.goto(`/commentary/${COMMENTARY_ID}`);
  await waitForEvent(page, "initPageItem:callback");
  const events = await getEvents(page);
  const names = events.map(e => e.name);
  expect(names).toContain("initPageItem:enter");
  expect(names).toContain("initPageItem:outerScrollDone");
  expect(names).toContain("initPageItem:callback");
});
```

- [ ] **Step 1.12: Run the smoke E2E**

Run: `E2E_COMMENTARY_ID=<id from P2> npm run e2e -- e2e/smoke.spec.js`
Expected: 1 test passes.

- [ ] **Step 1.13: Commit**

```bash
git add frontend/webapp/src/utils/deepLinkInstrument.js \
        frontend/webapp/src/utils/__tests__/deepLinkInstrument.test.js \
        frontend/webapp/src/models/Utils.js \
        frontend/webapp/src/views/Page/Page.js \
        e2e/ \
        package.json package-lock.json
git commit -m "chore(deeplink): add Playwright + event instrumentation"
```

---

### Task 2: Replace `scrollTo` with scrollend-based promise (R2, R10)

**Goal:** `scrollTo`'s callback fires when the scroll actually settles, not on a 1-second timer. Respects `prefers-reduced-motion`.

**Files:**
- Modify: `frontend/webapp/src/models/Utils.js:386-401` — rewrite `scrollTo`
- Test: `frontend/webapp/src/utils/__tests__/scrollTo.test.js`
- Test: `e2e/scrollto-callback.spec.js`

- [ ] **Step 2.1: Write the failing Jest test**

Create `frontend/webapp/src/utils/__tests__/scrollTo.test.js`:

```js
import { scrollTo } from "../../models/Utils";

beforeEach(() => {
  window.__deepLinkInstrument = false;
  // mock window.scrollTo
  window.scrollTo = jest.fn();
});

describe("scrollTo (refactored)", () => {
  test("skips and fires callback immediately when distance is null", () => {
    const cb = jest.fn();
    scrollTo(null, cb);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("skips and fires callback immediately when distance is negative", () => {
    const cb = jest.fn();
    scrollTo(-10, cb);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("fires window.scrollTo with smooth behavior", () => {
    scrollTo(500, () => {});
    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 500, behavior: "smooth" }),
    );
  });

  test("uses instant behavior when prefers-reduced-motion", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    scrollTo(500, () => {});
    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 500, behavior: "instant" }),
    );
  });

  test("uses instant behavior when callback === 0 (legacy sentinel)", () => {
    scrollTo(500, 0);
    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "instant" }),
    );
  });

  test("callback fires on scrollend event when smooth", () => {
    const cb = jest.fn();
    scrollTo(500, cb);
    expect(cb).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("scrollend"));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("callback fires once even if scrollend fires twice", () => {
    const cb = jest.fn();
    scrollTo(500, cb);
    window.dispatchEvent(new Event("scrollend"));
    window.dispatchEvent(new Event("scrollend"));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("callback fires via fallback timer if scrollend never arrives", async () => {
    jest.useFakeTimers();
    const cb = jest.fn();
    scrollTo(500, cb);
    jest.advanceTimersByTime(2000);
    expect(cb).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test("instant scroll fires callback synchronously", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    const cb = jest.fn();
    scrollTo(500, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2.2: Run test, confirm failures**

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern=scrollTo`
Expected: most tests FAIL (current impl uses fixed timers + smooth-only).

- [ ] **Step 2.3: Rewrite `scrollTo`**

Modify `frontend/webapp/src/models/Utils.js`. Replace the existing `scrollTo` function (currently at lines 386-401) with:

```js
const SCROLL_FALLBACK_MS = 2000;

export function scrollTo(scrollHeight, callback) {
  const fire = () => {
    if (typeof callback === "function") {
      recordDeepLinkEvent("scrollTo:callback", { scrollHeight });
      callback();
    }
  };

  if (typeof scrollHeight !== "number" || !Number.isFinite(scrollHeight) || scrollHeight < 0) {
    recordDeepLinkEvent("scrollTo:skip", { scrollHeight });
    fire();
    return;
  }

  const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const behavior = callback === 0 || reduced ? "instant" : "smooth";

  recordDeepLinkEvent("scrollTo:start", { scrollHeight, behavior });
  window.scrollTo({ top: scrollHeight, behavior });

  if (behavior === "instant") {
    fire();
    return;
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener("scrollend", onScrollEnd);
    clearTimeout(fallback);
    fire();
  };
  const onScrollEnd = () => finish();
  window.addEventListener("scrollend", onScrollEnd, { once: true });
  const fallback = setTimeout(finish, SCROLL_FALLBACK_MS);
}
```

Note: the previous implementation took a 1-second pre-scroll delay; the new one scrolls immediately. Callers that relied on that delay are fixed in Task 3.

- [ ] **Step 2.4: Run Jest, confirm pass**

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern=scrollTo`
Expected: all 9 tests pass.

- [ ] **Step 2.5: Write Playwright check that scrollEnd ordering holds**

Create `e2e/scrollto-callback.spec.js`:

```js
const { test, expect, getEvents, waitForEvent } = require("./fixtures");

const COMMENTARY_ID = process.env.E2E_COMMENTARY_ID || "REPLACE_ME";

test("scrollTo:callback fires after the page has stopped scrolling", async ({ instrumentedPage: page }) => {
  test.skip(COMMENTARY_ID === "REPLACE_ME", "Set E2E_COMMENTARY_ID to run");
  await page.goto(`/commentary/${COMMENTARY_ID}`);
  await waitForEvent(page, "initPageItem:callback");
  const events = await getEvents(page);

  const starts = events.filter(e => e.name === "scrollTo:start");
  const callbacks = events.filter(e => e.name === "scrollTo:callback");
  expect(starts.length).toBeGreaterThan(0);
  expect(callbacks.length).toBe(starts.length);

  // For each scrollTo:start, the next scrollTo:callback occurs AFTER it (event ordering only —
  // does NOT prove the scroll completed, but proves we no longer fire callback at fixed t=1000).
  for (let i = 0; i < starts.length; i++) {
    expect(callbacks[i].t).toBeGreaterThanOrEqual(starts[i].t);
  }
});
```

- [ ] **Step 2.6: Run Playwright**

Run: `E2E_COMMENTARY_ID=<id> npm run e2e -- e2e/scrollto-callback.spec.js`
Expected: PASS.

- [ ] **Step 2.7: Commit**

```bash
git add frontend/webapp/src/models/Utils.js \
        frontend/webapp/src/utils/__tests__/scrollTo.test.js \
        e2e/scrollto-callback.spec.js
git commit -m "refactor(scrollTo): use scrollend event + respect prefers-reduced-motion (R2, R10)"
```

---

### Task 3: Sequence `initPageItem` (R1, R3, R12)

**Goal:** Per-item scroll-then-click happens sequentially, each step awaiting the previous. Leaf-row coords are recomputed *after* the parent has expanded. Popup callback fires after the last click's row-open is observed, not on a stagger timer. Order respects DOM ancestry.

**Files:**
- Create: `frontend/webapp/src/utils/orderByDomAncestry.js`
- Create: `frontend/webapp/src/utils/awaitDomOpen.js`
- Create: `frontend/webapp/src/utils/__tests__/orderByDomAncestry.test.js`
- Modify: `frontend/webapp/src/views/Page/Page.js:567-597` — rewrite `initPageItem`
- Create: `e2e/deeplink-commentary.spec.js`

- [ ] **Step 3.1: Write failing Jest tests for `orderByDomAncestry`**

Create `frontend/webapp/src/utils/__tests__/orderByDomAncestry.test.js`:

```js
import { orderByDomAncestry } from "../orderByDomAncestry";

function setupDom(html) {
  document.body.innerHTML = html;
}

describe("orderByDomAncestry", () => {
  test("returns ancestor before descendant", () => {
    setupDom(`
      <div textid="lehites/85"><div class="row"><div textid="lehites/100"></div></div></div>
    `);
    expect(orderByDomAncestry(["lehites/100", "lehites/85"])).toEqual([
      "lehites/85",
      "lehites/100",
    ]);
  });

  test("preserves order when slugs are siblings", () => {
    setupDom(`
      <div textid="lehites/1"></div><div textid="lehites/2"></div>
    `);
    expect(orderByDomAncestry(["lehites/1", "lehites/2"])).toEqual([
      "lehites/1",
      "lehites/2",
    ]);
  });

  test("works regardless of lexical order", () => {
    setupDom(`
      <div textid="lehites/9"><div class="row"><div textid="lehites/100"></div></div></div>
    `);
    // Note: lex sort would put "lehites/100" first because '1' < '9'
    expect(orderByDomAncestry(["lehites/100", "lehites/9"])).toEqual([
      "lehites/9",
      "lehites/100",
    ]);
  });

  test("drops slugs whose elements aren't in the DOM", () => {
    setupDom(`<div textid="lehites/1"></div>`);
    expect(orderByDomAncestry(["lehites/1", "lehites/missing"])).toEqual([
      "lehites/1",
    ]);
  });

  test("handles empty input", () => {
    expect(orderByDomAncestry([])).toEqual([]);
  });
});
```

- [ ] **Step 3.2: Run test, confirm failure**

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern=orderByDomAncestry`
Expected: FAIL with `Cannot find module '../orderByDomAncestry'`.

- [ ] **Step 3.3: Implement `orderByDomAncestry`**

Create `frontend/webapp/src/utils/orderByDomAncestry.js`:

```js
export function orderByDomAncestry(slugs) {
  const elements = slugs
    .map(slug => ({ slug, el: document.querySelector(`[textid='${slug}']`) }))
    .filter(x => x.el);

  return elements
    .sort((a, b) => {
      if (a.el === b.el) return 0;
      const pos = a.el.compareDocumentPosition(b.el);
      // a is ancestor of b → a first
      if (pos & Node.DOCUMENT_POSITION_CONTAINED_BY) return -1;
      // b is ancestor of a → b first
      if (pos & Node.DOCUMENT_POSITION_CONTAINS) return 1;
      // a precedes b in document order → a first
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      return 1;
    })
    .map(x => x.slug);
}
```

- [ ] **Step 3.4: Run test, confirm pass**

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern=orderByDomAncestry`
Expected: 5 tests pass.

- [ ] **Step 3.5: Write Jest test for `awaitDomOpen`**

Create `frontend/webapp/src/utils/__tests__/awaitDomOpen.test.js`:

```js
import { awaitDomOpen } from "../awaitDomOpen";

describe("awaitDomOpen", () => {
  test("resolves when target element gains the open class", async () => {
    document.body.innerHTML = `
      <div textid="lehites/1"><a class="reference"></a></div>
    `;
    const promise = awaitDomOpen("lehites/1", 500);
    setTimeout(() => {
      document.querySelector("[textid='lehites/1'] .reference").classList.add("open");
    }, 50);
    await expect(promise).resolves.toBe("opened");
  });

  test("resolves with 'timeout' when class never appears", async () => {
    document.body.innerHTML = `
      <div textid="lehites/1"><a class="reference"></a></div>
    `;
    await expect(awaitDomOpen("lehites/1", 100)).resolves.toBe("timeout");
  });

  test("resolves with 'missing' when element doesn't exist", async () => {
    document.body.innerHTML = ``;
    await expect(awaitDomOpen("lehites/missing", 100)).resolves.toBe("missing");
  });
});
```

- [ ] **Step 3.6: Run test, confirm failure**

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern=awaitDomOpen`
Expected: FAIL with `Cannot find module '../awaitDomOpen'`.

- [ ] **Step 3.7: Implement `awaitDomOpen`**

Create `frontend/webapp/src/utils/awaitDomOpen.js`:

```js
export function awaitDomOpen(slug, timeoutMs = 2000) {
  return new Promise(resolve => {
    const target = document.querySelector(`[textid='${slug}'] .reference`);
    if (!target) {
      resolve("missing");
      return;
    }
    if (target.classList.contains("open")) {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve("opened")));
      return;
    }
    const observer = new MutationObserver(() => {
      if (target.classList.contains("open")) {
        observer.disconnect();
        clearTimeout(timer);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve("opened")));
      }
    });
    observer.observe(target, { attributes: true, attributeFilter: ["class"] });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve("timeout");
    }, timeoutMs);
  });
}
```

- [ ] **Step 3.8: Run test, confirm pass**

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern=awaitDomOpen`
Expected: 3 tests pass.

- [ ] **Step 3.9: Rewrite `initPageItem` to be async/sequential**

Modify `frontend/webapp/src/views/Page/Page.js`. Replace lines 567-597 with:

```js
async function initPageItem(pageController, callback) {
  recordDeepLinkEvent("initPageItem:enter");
  const offsetTop = document.documentElement.clientHeight * 0.2;
  const { textToOpen: rawTextToOpen, itemToScrollTo } = findTextToOpen(pageController);

  if (!itemToScrollTo || rawTextToOpen.length === 0) {
    recordDeepLinkEvent("initPageItem:noTarget", { rawTextToOpen });
    pageController.functions.markAsInitiated();
    if (callback) callback();
    return;
  }

  const ordered = orderByDomAncestry(rawTextToOpen);
  recordDeepLinkEvent("initPageItem:plan", { textToOpen: ordered });

  await scrollToAsync(itemToScrollTo.offsetTop - offsetTop);
  recordDeepLinkEvent("initPageItem:outerScrollDone");

  for (const slug of ordered) {
    const el = document.querySelector(`[textid='${slug}'] .reference a`);
    if (!el) {
      recordDeepLinkEvent("initPageItem:itemSkip", { slug, reason: "missing" });
      continue;
    }
    if (pageController.states.autoClicked.has(slug)) {
      recordDeepLinkEvent("initPageItem:itemSkip", { slug, reason: "already-clicked" });
      continue;
    }
    pageController.states.autoClicked.add(slug);

    const coords = getCoords(el);
    recordDeepLinkEvent("initPageItem:itemScrollStart", { slug });
    await scrollToAsync(coords?.top - offsetTop);
    recordDeepLinkEvent("initPageItem:itemClick", { slug });
    el.click();
    const result = await awaitDomOpen(slug, 2000);
    recordDeepLinkEvent("initPageItem:itemOpened", { slug, result });
  }

  recordDeepLinkEvent("initPageItem:markAsInitiated");
  pageController.functions.markAsInitiated();
  if (callback) {
    recordDeepLinkEvent("initPageItem:callback");
    callback();
  }
}

function scrollToAsync(distance) {
  return new Promise(resolve => scrollTo(distance, resolve));
}
```

Add imports at top of `Page.js` (alongside the existing `recordDeepLinkEvent` import from Task 1):

```js
import { orderByDomAncestry } from "src/utils/orderByDomAncestry";
import { awaitDomOpen } from "src/utils/awaitDomOpen";
```

The `pageController.states.autoClicked` field doesn't exist yet; it's added in Task 4. For now, initialize it as a Set in the useReducer initializer.

Locate the useReducer initializer (`Page.js:67-178`). Inside the `states` object (~line 71-87), add:

```js
autoClicked: new Set(),
```

- [ ] **Step 3.10: Verify `findTextToOpen` returns parent + leaf consistently**

The existing `findTextToOpen` (Page.js:615-641) collects parent + leaf via `el?.closest(".row > [textid]")`. Verify behavior is unchanged — we still want both slugs, ordering is now handled by `orderByDomAncestry`.

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern="(scrollTo|orderByDomAncestry|awaitDomOpen)"`
Expected: 17 tests pass total.

- [ ] **Step 3.11: Write E2E for commentary sequencing**

Create `e2e/deeplink-commentary.spec.js`:

```js
const { test, expect, getEvents, waitForEvent } = require("./fixtures");

const COMMENTARY_ID = process.env.E2E_COMMENTARY_ID || "REPLACE_ME";
const NESTED_COMMENTARY_ID = process.env.E2E_NESTED_COMMENTARY_ID || COMMENTARY_ID;

function indexOf(events, name, occurrence = 0) {
  let count = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].name === name) {
      if (count === occurrence) return i;
      count++;
    }
  }
  return -1;
}

test.describe("commentary deep-link sequencing", () => {
  test.skip(COMMENTARY_ID === "REPLACE_ME", "Set E2E_COMMENTARY_ID to run");

  test("popup callback fires AFTER the last row open", async ({ instrumentedPage: page }) => {
    await page.goto(`/commentary/${NESTED_COMMENTARY_ID}`);
    await waitForEvent(page, "initPageItem:callback");
    const events = await getEvents(page);
    const lastOpen = events.map(e => e.name).lastIndexOf("initPageItem:itemOpened");
    const cbIdx = events.map(e => e.name).indexOf("initPageItem:callback");
    expect(lastOpen).toBeGreaterThan(-1);
    expect(cbIdx).toBeGreaterThan(lastOpen);
  });

  test("items open in DOM-ancestry order (parent before leaf)", async ({ instrumentedPage: page }) => {
    await page.goto(`/commentary/${NESTED_COMMENTARY_ID}`);
    await waitForEvent(page, "initPageItem:callback");
    const events = await getEvents(page);
    const opens = events.filter(e => e.name === "initPageItem:itemOpened").map(e => e.payload.slug);

    if (opens.length < 2) test.skip(true, "Not a nested case for this ID");

    // The first opened slug must be an ancestor of the second
    const order = await page.evaluate(
      ([a, b]) => {
        const aEl = document.querySelector(`[textid='${a}']`);
        const bEl = document.querySelector(`[textid='${b}']`);
        if (!aEl || !bEl) return "missing";
        return aEl.contains(bEl) ? "ancestor" : "not-ancestor";
      },
      [opens[0], opens[1]],
    );
    expect(order).toBe("ancestor");
  });

  test("popup is visible by the time callback fires", async ({ instrumentedPage: page }) => {
    await page.goto(`/commentary/${COMMENTARY_ID}`);
    await waitForEvent(page, "initPageItem:callback");
    await expect(page.locator("#popUp")).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 3.12: Run Playwright**

Run: `E2E_COMMENTARY_ID=<id> E2E_NESTED_COMMENTARY_ID=<nested-id> npm run e2e -- e2e/deeplink-commentary.spec.js`
Expected: 3 tests pass.

- [ ] **Step 3.13: Commit**

```bash
git add frontend/webapp/src/utils/orderByDomAncestry.js \
        frontend/webapp/src/utils/awaitDomOpen.js \
        frontend/webapp/src/utils/__tests__/orderByDomAncestry.test.js \
        frontend/webapp/src/utils/__tests__/awaitDomOpen.test.js \
        frontend/webapp/src/views/Page/Page.js \
        e2e/deeplink-commentary.spec.js
git commit -m "refactor(initPageItem): async-sequential with DOM-open await + ancestry order (R1, R3, R12)"
```

---

### Task 4: Replace `autoclicked` DOM attribute with controller state (R8)

**Goal:** Track per-init-session auto-clicked slugs in controller state, not as a DOM attribute. The set is reset on every fresh init (Task 5 leans on this).

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js` — reducer + initial state + `markAsInitiated`

- [ ] **Step 4.1: Add reducer case for resetting autoClicked**

Modify `frontend/webapp/src/views/Page/Page.js`. In the reducer (around line 687), add a case after `setPageSlugId`:

```js
case "resetAutoClicked":
  pageController.states.autoClicked = new Set();
  break;
```

Also expose it as a function in the controller initializer (around line 93-164):

```js
resetAutoClicked: () => {
  dispatch({ fn: "resetAutoClicked" });
},
```

- [ ] **Step 4.2: Reset the set when init begins**

In `Page.js`, locate the useEffect at line 186-192 (the `match.params.pageSlug` effect). Add a reset call:

```js
useEffect(() => {
  setReadyToScroll(false);
  startInit(false);
  dispatch({ fn: "markAsInitiated", val: false });
  pageController.functions.resetAutoClicked();
  prepareInitOpen(match.params);
  handlePageInit();
}, [match.params.pageSlug]);
```

- [ ] **Step 4.3: Confirm the rewritten `initPageItem` already uses `autoClicked.has` / `autoClicked.add`**

Verify Task 3.9's code uses `pageController.states.autoClicked.has(slug)` and `.add(slug)`. No DOM `setAttribute("autoclicked", ...)` call should remain in `initPageItem`. Grep:

Run: `grep -n autoclicked frontend/webapp/src/views/Page/Page.js`
Expected: zero matches (the attribute-based logic is gone).

- [ ] **Step 4.4: Run existing E2E to confirm no regression**

Run: `E2E_COMMENTARY_ID=<id> npm run e2e -- e2e/deeplink-commentary.spec.js`
Expected: 3 tests still pass.

- [ ] **Step 4.5: Commit**

```bash
git add frontend/webapp/src/views/Page/Page.js
git commit -m "refactor(initPageItem): track autoClicked in controller state, not DOM attribute (R8)"
```

---

### Task 5: Re-init on route-param change (R4)

**Goal:** Navigating from `/commentary/A` to `/commentary/B` (or any deep-link → another deep-link) re-runs the full init pipeline with the new params. `initOpen` is no longer frozen at first mount.

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js` — effect dep arrays + `setInitOpen` dispatch
- Create: `e2e/deeplink-renavigation.spec.js`

- [ ] **Step 5.1: Locate the two effects that gate on `match.params.pageSlug`**

`Page.js:56-63` and `Page.js:186-192` both have `[match.params.pageSlug]` deps. They miss commentary→commentary and image→image transitions because both have `pageSlug === undefined`.

- [ ] **Step 5.2: Compute a stable route key**

Modify `Page.js` near the top of the `Page` component body (after `match` is read at line 44, before `prepareInitOpen`):

```js
const routeKey = `${match.params.pageSlug || ""}|${match.params.textId || ""}|${match.params.commentaryId || ""}|${match.params.imageId || ""}|${match.params.faxVersion || ""}`;
```

- [ ] **Step 5.3: Re-key both effects on `routeKey`**

Replace `[match.params.pageSlug]` with `[routeKey]` in:

`Page.js:63`:
```js
}, [routeKey]);
```

`Page.js:192`:
```js
}, [routeKey]);
```

- [ ] **Step 5.4: Make the second effect actually update `initOpen`**

In the existing effect at `Page.js:186-192`, `prepareInitOpen(match.params)` is called and its return value is discarded. Replace the effect body with:

```js
useEffect(() => {
  setReadyToScroll(false);
  startInit(false);
  dispatch({ fn: "markAsInitiated", val: false });
  pageController.functions.resetAutoClicked();
  const newInitOpen = prepareInitOpen(match.params);
  pageController.functions.setInitOpen(newInitOpen);
  handlePageInit();
}, [routeKey]);
```

`setInitOpen` already exists at `Page.js:152-154` and its reducer case at `Page.js:868-870` already replaces `initOpen` wholesale — no changes needed there.

- [ ] **Step 5.5: Verify the first effect (data fetch) also re-runs**

In the first effect at `Page.js:56-63`, the body calls either `getPageDataFromAPIViaNote(match.params)` or `getPageDataFromAPI(match.params.pageSlug)`. With the new dep on `routeKey`, both will re-run. No body changes needed.

- [ ] **Step 5.6: Write E2E for renavigation**

Create `e2e/deeplink-renavigation.spec.js`:

```js
const { test, expect, getEvents, waitForEvent } = require("./fixtures");

const A = process.env.E2E_COMMENTARY_ID || "REPLACE_ME";
const B = process.env.E2E_COMMENTARY_ID_B || "REPLACE_ME";

test.skip(A === "REPLACE_ME" || B === "REPLACE_ME", "Set E2E_COMMENTARY_ID and E2E_COMMENTARY_ID_B to run");

test("navigating /commentary/A → /commentary/B re-runs init with B's id", async ({ instrumentedPage: page }) => {
  await page.goto(`/commentary/${A}`);
  await waitForEvent(page, "initPageItem:callback");
  const eventsA = await getEvents(page);
  expect(eventsA.some(e => e.name === "initPageItem:enter")).toBe(true);

  // Reset capture and navigate
  await page.evaluate(() => { window.__deepLinkEvents.length = 0; });
  await page.goto(`/commentary/${B}`, { waitUntil: "domcontentloaded" });
  await waitForEvent(page, "initPageItem:callback");
  const eventsB = await getEvents(page);
  expect(eventsB.filter(e => e.name === "initPageItem:enter").length).toBeGreaterThanOrEqual(1);

  // The page URL must end at /commentary/B (popup pushes commentary/B's slug)
  await expect(page).toHaveURL(new RegExp(`/commentary/${B}$`));
});

test("client-side <Link>-style navigation also re-runs init", async ({ instrumentedPage: page }) => {
  await page.goto(`/commentary/${A}`);
  await waitForEvent(page, "initPageItem:callback");
  await page.evaluate(() => { window.__deepLinkEvents.length = 0; });

  // Simulate a SPA navigation via history.pushState + popstate (closest to a <Link> click)
  await page.evaluate((id) => {
    window.history.pushState({}, "", `/commentary/${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, B);
  await waitForEvent(page, "initPageItem:callback");
  const events = await getEvents(page);
  expect(events.some(e => e.name === "initPageItem:enter")).toBe(true);
});
```

- [ ] **Step 5.7: Run Playwright**

Run: `E2E_COMMENTARY_ID=<A> E2E_COMMENTARY_ID_B=<B> npm run e2e -- e2e/deeplink-renavigation.spec.js`
Expected: 2 tests pass.

- [ ] **Step 5.8: Commit**

```bash
git add frontend/webapp/src/views/Page/Page.js \
        e2e/deeplink-renavigation.spec.js
git commit -m "fix(Page): re-init on any route-param change, not just pageSlug (R4)"
```

---

### Task 6: Data-not-found handling for `/commentary/<id>` and `/image/<id>` (R13)

**Goal:** When the backend returns empty data (sandbox mode, invalid ID, permissions), show an explicit not-found state instead of hanging forever.

**Files:**
- Create: `frontend/webapp/src/views/Page/PageNotFound.js`
- Modify: `frontend/webapp/src/views/Page/Page.js:312-327` — `getPageDataFromAPIViaNote`
- Create: `e2e/deeplink-notfound.spec.js`

- [ ] **Step 6.1: Add a notFound state to the controller**

Modify `Page.js`. In the useReducer initializer's `states`, add:

```js
notFound: null,  // { type: "commentary" | "image", id: string } when set
```

Add a setter to `functions`:

```js
setNotFound: (val) => {
  dispatch({ fn: "setNotFound", val: val });
},
```

Add a reducer case (near `setPageData`):

```js
case "setNotFound":
  pageController.states.notFound = input.val;
  pageController.states.loading = false;
  break;
```

- [ ] **Step 6.2: Create the not-found UI**

Create `frontend/webapp/src/views/Page/PageNotFound.js`:

```js
import React from "react";
import { Alert } from "reactstrap";
import { label } from "src/models/Utils";

export default function PageNotFound({ type, id }) {
  return (
    <div className="content page ready">
      <Alert color="warning" className="pageInfo">
        <h4>{label("not_found_title") || "Not found"}</h4>
        <p>
          {(label("not_found_body") || "We couldn't find the requested resource.")}
          {" "}<code>{type}/{id}</code>
        </p>
        <a href="/">{label("back_home") || "Back to home"}</a>
      </Alert>
    </div>
  );
}
```

- [ ] **Step 6.3: Detect missing data in `getPageDataFromAPIViaNote`**

Modify `Page.js:312-327` to:

```js
const getPageDataFromAPIViaNote = async (params) => {
  let { pageSlug, textId } = false;
  if (params.imageId) {
    let response = await BoMOnlineAPI({ image: params.imageId });
    let image = response?.image?.[params.imageId];
    if (!image?.location?.slug) {
      pageController.functions.setNotFound({ type: "image", id: params.imageId });
      return;
    }
    pageSlug = image.location.slug.replace(/\/\d+$/, "");
    textId = image.location.slug.match(/\d+$/)?.[0];
  }
  if (params.commentaryId) {
    let response = await BoMOnlineAPI({ commentary: params.commentaryId });
    let commentary = response?.commentary?.[params.commentaryId];
    if (!commentary?.location?.slug) {
      pageController.functions.setNotFound({ type: "commentary", id: params.commentaryId });
      return;
    }
    pageSlug = commentary.location.slug.replace(/\/\d+$/, "");
    textId = commentary.location.slug.match(/\d+$/)?.[0];
  }
  if (pageSlug) getPageDataFromAPI(pageSlug, textId);
};
```

- [ ] **Step 6.4: Render `PageNotFound` when `notFound` is set**

In `Page.js`, locate the render early-returns (around line 478-479):

```js
if(!appController.states.preloaded) return <Loader />;
if (pageController.states.loading !== false) return <Loader />;
```

Insert before the loading check (so notFound wins over Loader):

```js
if (pageController.states.notFound) {
  return <PageNotFound type={pageController.states.notFound.type} id={pageController.states.notFound.id} />;
}
```

Add import at top of `Page.js`:

```js
import PageNotFound from "./PageNotFound";
```

- [ ] **Step 6.5: Reset notFound on route change**

In the route-change effect from Task 5, add a `setNotFound(null)` call:

```js
useEffect(() => {
  setReadyToScroll(false);
  startInit(false);
  dispatch({ fn: "markAsInitiated", val: false });
  pageController.functions.resetAutoClicked();
  pageController.functions.setNotFound(null);
  const newInitOpen = prepareInitOpen(match.params);
  pageController.functions.setInitOpen(newInitOpen);
  handlePageInit();
}, [routeKey]);
```

- [ ] **Step 6.6: Add labels (optional, fallback covers no-op)**

`label()` falls back gracefully when keys are missing (verify by checking `Utils.js` for the `label` function). If adding label keys to the backend label table, add `not_found_title`, `not_found_body`, `back_home`. Skip if out of scope for this commit.

- [ ] **Step 6.7: Write E2E**

Create `e2e/deeplink-notfound.spec.js`:

```js
const { test, expect } = require("./fixtures");

test("/commentary/999999999 shows not-found UI", async ({ page }) => {
  await page.goto("/commentary/999999999");
  await expect(page.getByText(/Not found|commentary\/999999999/i)).toBeVisible({ timeout: 15_000 });
});

test("/image/999999999 shows not-found UI", async ({ page }) => {
  await page.goto("/image/999999999");
  await expect(page.getByText(/Not found|image\/999999999/i)).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 6.8: Run Playwright**

Run: `npm run e2e -- e2e/deeplink-notfound.spec.js`
Expected: 2 tests pass.

- [ ] **Step 6.9: Commit**

```bash
git add frontend/webapp/src/views/Page/PageNotFound.js \
        frontend/webapp/src/views/Page/Page.js \
        e2e/deeplink-notfound.spec.js
git commit -m "feat(deeplink): not-found UI for missing commentary/image IDs (R13)"
```

---

### Task 7: Cap `loadPageComments` wait with a deterministic timeout (R5)

**Goal:** Study-mode users don't stare at a `LoadingPageCommentsNotice` forever. After 2.5 seconds, `setReadyToScroll(true)` is forced regardless of whether messenger has responded.

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js:369-476` — `loadPageComments`

- [ ] **Step 7.1: Add a deterministic timeout to `loadPageComments`**

Modify `Page.js:369-476`. Find the line where `listQuery.load().then(...)` is called (around line 452). Wrap the wait with a Promise.race against a fixed timeout. Replace the try/catch block:

```js
const COMMENTS_FALLBACK_MS = 2500;
const fallbackTimer = setTimeout(() => {
  recordDeepLinkEvent("loadPageComments:fallback");
  setReadyToScroll(true);
}, COMMENTS_FALLBACK_MS);

try {
  listQuery.load().then((messages) => {
    clearTimeout(fallbackTimer);
    setCommentState("indexing");
    let index = indexPageComments(messages);
    setCommentState("counting");
    pageController.functions.setPageComments({
      groupId,
      index,
      counts: null,
    });
    countPageComments(index, pageController, setCommentState).then(
      (counts) => {
        setCommentState("placing");
        pageController.functions.setPageComments({
          groupId,
          index,
          counts,
        });
      },
    );
  });
} catch (error) {
  clearTimeout(fallbackTimer);
  console.log({ error });
  return false;
}
```

- [ ] **Step 7.2: Verify behavior with the existing manual-override exit path**

The existing `LoadingPageCommentsNotice` (`Page.js:519-`) has a manual `×` to force readyToScroll. With the timeout, this becomes a backup rather than the only way out. No code change needed; manual mark.

- [ ] **Step 7.3: Run existing E2Es to confirm no regression**

Run: `E2E_COMMENTARY_ID=<id> npm run e2e -- e2e/deeplink-commentary.spec.js`
Expected: all 3 tests pass.

- [ ] **Step 7.4: Commit**

```bash
git add frontend/webapp/src/views/Page/Page.js
git commit -m "fix(loadPageComments): cap wait at 2.5s fallback (R5)"
```

---

### Task 8: Move image activation into `initPageImage` callback (R14)

**Goal:** `/image/<id>` activates the image via the `initPageImage` callback instead of the `ImageBubble` mount-time side effect. Eliminates the race where the bubble's effect rejects because `pageController.states.loading` hasn't flipped to false yet.

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js:599-601` — `initPageImage`
- Modify: `frontend/webapp/src/views/Page/Annotations.js:279-301` — `ImageBubble` effect
- Create: `e2e/deeplink-image.spec.js`

- [ ] **Step 8.1: Add an app-level "activate image" function**

The narrationController is created per-row inside `Narration.js` (search `narrationController` to find it). We need a way for `initPageImage` to reach the right narrationController.

Simplest approach: expose a registry on `appController`. Modify `frontend/webapp/src/models/appController.js` near other state, add to the state object:

```js
imageActivationRequest: null,  // { imageId: string } when init wants the bubble to claim
```

And a function:

```js
requestImageActivation: (appController, input) => {
  appController.states.imageActivationRequest = input.val;
  return appController;
},
```

Wire it through the existing reducer pattern (the file already has `appFunctions[input.fn]` dispatch).

Expose in `appController.js` initial controller (search `setSlug:` to find the functions block):

```js
requestImageActivation: (val) => dispatch({ fn: "requestImageActivation", val }),
```

- [ ] **Step 8.2: `initPageImage` requests activation via callback**

Modify `Page.js:599-601`:

```js
function initPageImage(pageController) {
  initPageItem(pageController, () => {
    pageController.appController.functions.requestImageActivation({
      imageId: pageController.states.initOpen.imageId,
    });
  });
}
```

- [ ] **Step 8.3: `ImageBubble` claims activation from the appController state, not from `initOpen`**

Modify `frontend/webapp/src/views/Page/Annotations.js:279-301`. Replace the effect with:

```js
useEffect(() => {
  if (fadeClass !== " fadedIn") setTimeout(() => makeFadeIn(" fadedIn"), 500);
  const req = narrationController.pageController.appController.states.imageActivationRequest;
  const urlOpenImageId = req?.imageId;
  if (
    urlOpenImageId &&
    item.ids.indexOf(urlOpenImageId) >= 0 &&
    !narrationController.states.activeImageId
  ) {
    narrationController.functions.setActiveImageId(urlOpenImageId);
    narrationController.functions.setPanelImageIds(item.ids);
    history.push(`/art/${urlOpenImageId}`);
    setAutoCyle(false);
    // Clear the request so re-renders don't repeat
    narrationController.pageController.appController.functions.requestImageActivation(null);
  }
}, [
  fadeClass,
  item.ids,
  narrationController.functions,
  narrationController.pageController.appController.states.imageActivationRequest,
]);
```

Note the `loading` guard is gone — the request is only set after `initPageItem` has completed its scroll-and-open sequence, so by definition loading is past.

- [ ] **Step 8.4: Write E2E**

Create `e2e/deeplink-image.spec.js`:

```js
const { test, expect, getEvents, waitForEvent } = require("./fixtures");

const IMAGE_ID = process.env.E2E_IMAGE_ID || "REPLACE_ME";

test.describe("image deep-link", () => {
  test.skip(IMAGE_ID === "REPLACE_ME", "Set E2E_IMAGE_ID to run");

  test("activation happens after row open, URL canonicalizes to /art/<id>", async ({ instrumentedPage: page }) => {
    await page.goto(`/image/${IMAGE_ID}`);
    await waitForEvent(page, "initPageItem:callback");
    await expect(page).toHaveURL(new RegExp(`/art/${IMAGE_ID}$`), { timeout: 5000 });
  });

  test("ImagePanel renders the activated image", async ({ instrumentedPage: page }) => {
    await page.goto(`/image/${IMAGE_ID}`);
    await waitForEvent(page, "initPageItem:callback");
    const src = await page.locator(`img.panel.i${IMAGE_ID}`).getAttribute("src");
    expect(src).toMatch(new RegExp(`/art/${IMAGE_ID}$`));
  });
});
```

- [ ] **Step 8.5: Run Playwright**

Run: `E2E_IMAGE_ID=<id> npm run e2e -- e2e/deeplink-image.spec.js`
Expected: 2 tests pass.

- [ ] **Step 8.6: Commit**

```bash
git add frontend/webapp/src/views/Page/Page.js \
        frontend/webapp/src/views/Page/Annotations.js \
        frontend/webapp/src/models/appController.js \
        e2e/deeplink-image.spec.js
git commit -m "refactor(image-deeplink): activate via explicit callback, not side-effect race (R14)"
```

---

### Task 9: Use `history.replace` during auto-clicks (R9)

**Goal:** Auto-clicks from `initPageItem` don't pollute history with intermediate `<pageSlug>/<textId>` entries. Back button works as users expect.

**Files:**
- Modify: `frontend/webapp/src/models/appController.js:225-232` — `setSlug` accepts `replace` flag
- Modify: `frontend/webapp/src/views/Page/Page.js:689-765` — `setActiveRow` reducer passes auto flag

- [ ] **Step 9.1: Add `replace` flag to `setSlug`**

Modify `appController.js:225-232`:

```js
setSlug: (appController, input) => {
  let slug = input.val;
  if (!slug) return appController;
  if (!/^\//.test(slug)) slug = `/${slug}`;
  if (appController.states.slug === slug) return appController;
  appController.states.slug = slug;
  const useReplace = input.replace === true;
  input.val && (useReplace ? history?.replace(slug) : history?.push(slug));
  return appController;
},
```

Update the controller function to accept the flag (search the file for the functions block, the existing one is `setSlug: (val) => dispatch({ fn: "setSlug", val: val })`):

```js
setSlug: (val, opts) => dispatch({ fn: "setSlug", val: val, replace: opts?.replace === true }),
```

- [ ] **Step 9.2: Pass `auto` from `setActiveRow` payload**

Modify `Page.js:689-765`. The reducer destructures `input.val`:

```js
case "setActiveRow":
  let { slug, duration, pagetitle, heading, auto } = input.val;
  // ... existing body ...
  pageController.appController.functions.setSlug(slug, { replace: auto === true });
  // ... rest unchanged ...
```

- [ ] **Step 9.3: Pass `auto: true` from `initPageItem`'s clicks**

The auto-click in `initPageItem` synthesizes `el.click()` on the row's `<a>`, which triggers `TextContent.js`'s `toggleOpenClose`, which dispatches `setActiveRow` *without* an auto flag. So the click path goes through the row's local reducer.

Option A: Pass the auto context through a controller-level set ("currently auto-clicking these slugs"). Option B: Add a query-param-like signal via `pageController.states.autoClickInProgress`.

Implement Option B. In the reducer dispatch from `TextContent.js:33-40`:

```js
textContentController.pageController.functions.setActiveRow({
  slug: textContentController.data.slug,
  duration: textContentController.data.duration,
  pagetitle: textContentController.narrationController.pageController.pageData.title,
  heading: textContentController.data.heading,
  auto: textContentController.pageController.states.autoClicked?.has(textContentController.data.slug) === true,
});
```

(The `autoClicked` set was added in Task 4 to track session-scoped auto-clicks. If the slug is in the set, the click is auto.)

- [ ] **Step 9.4: Confirm history doesn't accumulate**

Add to `e2e/deeplink-commentary.spec.js`:

```js
test("auto-click history entries don't pollute back-button", async ({ instrumentedPage: page }) => {
  test.skip(NESTED_COMMENTARY_ID === "REPLACE_ME", "Set E2E_NESTED_COMMENTARY_ID to run");
  await page.goto(`/commentary/${NESTED_COMMENTARY_ID}`);
  await waitForEvent(page, "initPageItem:callback");
  await page.goBack();
  // After one back, we should NOT be on /<pageSlug>/<textId>
  const url = page.url();
  expect(url).not.toMatch(/\/[^/]+\/\d+$/);
});
```

- [ ] **Step 9.5: Run Playwright**

Run: `E2E_NESTED_COMMENTARY_ID=<id> npm run e2e -- e2e/deeplink-commentary.spec.js`
Expected: all 4 tests pass.

- [ ] **Step 9.6: Commit**

```bash
git add frontend/webapp/src/models/appController.js \
        frontend/webapp/src/views/Page/Page.js \
        frontend/webapp/src/views/Page/TextContent.js \
        e2e/deeplink-commentary.spec.js
git commit -m "fix(history): replace instead of push during auto-clicks (R9)"
```

---

### Task 10: Remove dead `justScroll` ResizeObserver (R11)

**Goal:** Eliminate the ResizeObserver attached in `loadPageComments` whose only effect is calling a no-op function on every layout shift.

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js:432-436` — remove observer
- Modify: `frontend/webapp/src/views/Page/Page.js:556-565` — remove `justScroll` function

- [ ] **Step 10.1: Remove the ResizeObserver attachment**

Delete lines 432-436 of `Page.js` (the `const resizeObserver = new ResizeObserver(...)` block and the `.observe(...)` call).

- [ ] **Step 10.2: Remove the dead `justScroll` function**

Delete the `justScroll` function definition at `Page.js:556-565`.

- [ ] **Step 10.3: Grep for leftover references**

Run: `grep -n "justScroll\|resizeObserver" frontend/webapp/src/views/Page/Page.js`
Expected: zero matches.

- [ ] **Step 10.4: Run full E2E suite**

Run: `E2E_COMMENTARY_ID=<id> E2E_IMAGE_ID=<id> E2E_NESTED_COMMENTARY_ID=<id> E2E_COMMENTARY_ID_B=<id> npm run e2e`
Expected: all tests pass.

- [ ] **Step 10.5: Commit**

```bash
git add frontend/webapp/src/views/Page/Page.js
git commit -m "chore(Page): remove dead justScroll + ResizeObserver (R11)"
```

---

## Self-review checklist (for the implementer before merging)

- [ ] `grep -rn "setTimeout.*1000" frontend/webapp/src/views/Page/Page.js frontend/webapp/src/models/Utils.js` — should NOT find the old fixed-stagger timers in `initPageItem` or `scrollTo`. (The Task 7 fallback timer at 2500 ms is intentional and expected.)
- [ ] `grep -rn "autoclicked" frontend/webapp/src/views/Page/Page.js` — zero matches (DOM-attribute logic gone).
- [ ] `grep -rn "justScroll\|new ResizeObserver" frontend/webapp/src/views/Page/Page.js` — zero matches.
- [ ] `cd frontend/webapp && CI=true npm test` — all Jest tests pass (instrument, scrollTo, orderByDomAncestry, awaitDomOpen).
- [ ] `npm run e2e` (with all `E2E_*` env vars set) — all Playwright specs pass.
- [ ] Visual check on `http://localhost:8200/commentary/<nested-id>`:
  - The page scrolls smoothly to the parent row.
  - The parent row opens.
  - The page scrolls smoothly to the leaf row.
  - The leaf row opens.
  - **Only then** does the popup appear.
- [ ] Back-button behavior: after the popup closes on a deep-link, pressing back once goes to the previous page (not to an intermediate `/<page>/<textId>` URL).

## What's intentionally not in this plan

These items from the audit are deferred and should be tracked separately:

- **R15-R17 (verification recommendations):** the Playwright scaffold from Task 1 partially addresses R15; the canary console.time instrumentation (R16) is implicit in the `deepLinkInstrument` channel; CPU-throttled testing (R17) is left to manual QA.
- **Mobile drawer (`PopUp.js:98`):** all changes target the desktop popup path. The `MobileDrawer` flow uses the same `setPopUp` reducer but renders differently; a follow-up audit is needed before touching it.
- **Fax route:** `initPageFax` reuses `initPageItem`, so it inherits all the fixes. No separate task.
- **Audio side-effect inside `setActiveRow`:** unrelated product question.
- **Label keys (`not_found_title`, `not_found_body`, `back_home`):** Task 6 falls back to hard-coded English; adding translations is a follow-up.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-05-15-deep-link-init-fixes.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration with clean context windows.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for your review.

**Which approach?**
