# Unified Tabbed Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `/home` (Sampler), `/community`, and `/user` into a single tabbed Home under `/home`, `/home/community`, `/home/user`, with old paths redirecting in.

**Architecture:** A new `Home.js` shell owns a desktop-only tab bar and an inner `<Switch>` that renders the existing `Sampler` / `Community` / `User` components as pure content (Approach A). Tabs change the URL; the shell doesn't remount on tab switch. Old top-level paths redirect client-side. Two pure helpers (`resolveActivePath`, `resolveBottomSelection`) make sidebar/bottom-nav logic unit-testable.

**Tech Stack:** React 17, React Router v5, reactstrap, Jest + @testing-library/react (`react-scripts test`). Path alias `src/` resolves to `frontend/webapp/src/`.

**Spec:** `docs/specs/2026-07-17-unified-tabbed-home.md`

**Working directory for all commands:** `frontend/webapp/`

---

## File Structure

**New files**
- `src/views/Home/Home.js` — the shell: tab bar + inner Switch + messenger/legacy guards.
- `src/views/Home/HomeTabs.js` — desktop tab bar (Explore / Community / User).
- `src/views/Home/HomeTabs.css` — tab bar styles.
- `src/views/_Common/sidebarPath.js` — pure `resolveActivePath(pathname, slugs)`.
- `src/views/_Common/bottomNavSelection.js` — pure `resolveBottomSelection(pathname, useMessenger)`.
- Test files alongside (see each task).

**Modified files**
- `src/models/Routes.js` — Home subtree + redirect components; remove old entries.
- `src/views/Home/Community.js` — robust community-path detection for channel params.
- `src/views/_Common/menuConfig.js` — remove `community` item.
- `src/views/_Common/Sidebar.js` — use `resolveActivePath`; split Home vs User active state; update profile-card links.
- `src/views/_Common/BottomNav.js` — use `resolveBottomSelection`; User item path → `/home/user`.

---

## Task 1: `resolveActivePath` pure helper (sidebar active state)

**Files:**
- Create: `src/views/_Common/sidebarPath.js`
- Test: `src/views/_Common/__tests__/sidebarPath.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/views/_Common/__tests__/sidebarPath.test.js
import { resolveActivePath } from "../sidebarPath";

const SLUGS = ["home", "contents", "study", "read", "timeline", "people", "places", "map", "about"];

describe("resolveActivePath", () => {
  test("/home stays /home", () => {
    expect(resolveActivePath("/home", SLUGS)).toBe("/home");
  });
  test("/home/community keeps full path", () => {
    expect(resolveActivePath("/home/community", SLUGS)).toBe("/home/community");
  });
  test("/home/community/:channelId keeps full path", () => {
    expect(resolveActivePath("/home/community/abc123", SLUGS)).toBe("/home/community/abc123");
  });
  test("/home/user resolves to /home/user", () => {
    expect(resolveActivePath("/home/user", SLUGS)).toBe("/home/user");
  });
  test("legacy /user resolves to /home/user", () => {
    expect(resolveActivePath("/user", SLUGS)).toBe("/home/user");
  });
  test("legacy /user/history resolves to /home/user", () => {
    expect(resolveActivePath("/user/history", SLUGS)).toBe("/home/user");
  });
  test("/search/foo resolves to /search", () => {
    expect(resolveActivePath("/search/foo", SLUGS)).toBe("/search");
  });
  test("empty root resolves to /home", () => {
    expect(resolveActivePath("/", SLUGS)).toBe("/home");
  });
  test("studyedition resolves to /특별반", () => {
    expect(resolveActivePath("/studyedition", SLUGS)).toBe("/특별반");
  });
  test("a real menu slug returns its own path", () => {
    expect(resolveActivePath("/read/1-nephi/1", SLUGS)).toBe("/read/1-nephi/1");
  });
  test("unknown root falls back to /study", () => {
    expect(resolveActivePath("/nope", SLUGS)).toBe("/study");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/views/_Common/__tests__/sidebarPath.test.js --watchAll=false`
Expected: FAIL — "Cannot find module '../sidebarPath'".

- [ ] **Step 3: Write minimal implementation**

```js
// src/views/_Common/sidebarPath.js

// Pure resolver for the sidebar's "active" indicator. Extracted from
// Sidebar.determinePath so it can be unit-tested without loading the
// full Sidebar (crypto/svg imports, contexts). Under the unified Home,
// /user now lives at /home/user; legacy /user paths still resolve there.
export function resolveActivePath(pathname, slugs) {
  const seg = (pathname || "/").split("/");
  const root = seg[1] || "";
  const sub = seg[2] || "";

  if (root === "home" && sub === "user") return "/home/user";
  if (["message", "", "invite"].includes(root)) return "/home";
  if (root === "search") return "/search";
  if (root === "user") return "/home/user"; // legacy /user* → unified user tab
  if (["%ED%8A%B9%EB%B3%84%EB%B0%98", "studyedition"].includes(root)) return "/특별반";
  if (slugs.indexOf(root) >= 0) return pathname;
  return "/study";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/views/_Common/__tests__/sidebarPath.test.js --watchAll=false`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/views/_Common/sidebarPath.js src/views/_Common/__tests__/sidebarPath.test.js
git commit -m "feat(sidebar): extract resolveActivePath pure helper for unified Home"
```

---

## Task 2: `resolveBottomSelection` pure helper (mobile bottom nav)

**Files:**
- Create: `src/views/_Common/bottomNavSelection.js`
- Test: `src/views/_Common/__tests__/bottomNavSelection.test.js`

Preserves the EXISTING numeric returns from `BottomNav.determineSelection`
exactly, adding only the `/home/user` split (so the User item highlights on the
user tab, and the Home item on the explore/community tabs).

- [ ] **Step 1: Write the failing test**

```js
// src/views/_Common/__tests__/bottomNavSelection.test.js
import { resolveBottomSelection } from "../bottomNavSelection";

describe("resolveBottomSelection (messenger ON)", () => {
  const on = (p) => resolveBottomSelection(p, true);
  test("groups → 0", () => expect(on("/groups")).toBe(0));
  test("/home → 1 (Home item)", () => expect(on("/home")).toBe(1));
  test("/home/community → 1 (Home item)", () => expect(on("/home/community")).toBe(1));
  test("/home/user → 3 (User item)", () => expect(on("/home/user")).toBe(3));
  test("legacy /user → 3 (User item)", () => expect(on("/user")).toBe(3));
  test("/mobilemenu → 4", () => expect(on("/mobilemenu")).toBe(4));
  test("/study default → 2", () => expect(on("/study")).toBe(2));
});

describe("resolveBottomSelection (messenger OFF)", () => {
  const off = (p) => resolveBottomSelection(p, false);
  test("/home → -1 (Home item hidden)", () => expect(off("/home")).toBe(-1));
  test("/home/user → 2 (User item)", () => expect(off("/home/user")).toBe(2));
  test("legacy /user → 2 (User item)", () => expect(off("/user")).toBe(2));
  test("/study default → 1", () => expect(off("/study")).toBe(1));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/views/_Common/__tests__/bottomNavSelection.test.js --watchAll=false`
Expected: FAIL — "Cannot find module '../bottomNavSelection'".

- [ ] **Step 3: Write minimal implementation**

```js
// src/views/_Common/bottomNavSelection.js

// Pure resolver for the mobile bottom-nav's active index. Extracted from
// BottomNav.determineSelection so it can be unit-tested. Numeric returns match
// the original exactly; the only new behavior is the /home/user split so the
// User item (not the Home item) highlights on the unified Home's user tab.
export function resolveBottomSelection(pathname, useMessenger) {
  const seg = (pathname || "/").split("/").filter(Boolean);
  const root = seg[0] || "";
  const sub = seg[1] || "";

  if (["groups", "group", "invite"].includes(root)) return useMessenger ? 0 : -1;
  if (root === "home" && sub === "user") return useMessenger ? 3 : 2; // User item
  if (root === "home") return useMessenger ? 1 : -1; // Home item
  if (root === "user") return useMessenger ? 3 : 2; // legacy /user*
  if (root === "mobilemenu") return useMessenger ? 4 : 3;
  return useMessenger ? 2 : 1; // study / default
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/views/_Common/__tests__/bottomNavSelection.test.js --watchAll=false`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/views/_Common/bottomNavSelection.js src/views/_Common/__tests__/bottomNavSelection.test.js
git commit -m "feat(bottomnav): extract resolveBottomSelection pure helper"
```

---

## Task 3: Robust community-path detection in `Community.js`

**Files:**
- Modify: `src/views/Home/Community.js:64-83`
- Test: `src/views/Home/__tests__/communityPath.test.js`

**Why:** `Community` reads channel params only when `match.url.split("/")[1] === "community"`. Under `/home/community/...` that segment is `"home"`, so deep links would silently stop hydrating the channel. Detect `community` anywhere in the matched path instead.

- [ ] **Step 1: Write the failing test**

```js
// src/views/Home/__tests__/communityPath.test.js
import { isCommunityPath } from "../Community";

describe("isCommunityPath", () => {
  test("new nested base", () => expect(isCommunityPath("/home/community")).toBe(true));
  test("new nested with channel", () => expect(isCommunityPath("/home/community/abc")).toBe(true));
  test("legacy base", () => expect(isCommunityPath("/community/abc")).toBe(true));
  test("plain home is not community", () => expect(isCommunityPath("/home")).toBe(false));
  test("user tab is not community", () => expect(isCommunityPath("/home/user")).toBe(false));
  test("substring guard: communityish", () => expect(isCommunityPath("/home/communityhall")).toBe(false));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/views/Home/__tests__/communityPath.test.js --watchAll=false`
Expected: FAIL — `isCommunityPath` is not exported.

- [ ] **Step 3: Add the export and use it**

Add near the top of `src/views/Home/Community.js` (after imports, before `function Community()`):

```js
// True when the matched URL is a community route, whether nested under the
// unified Home (/home/community/...) or the legacy top-level (/community/...).
export const isCommunityPath = (url) => /(^|\/)community(\/|$)/.test(url || "");
```

Then replace the base logic inside `function Community()` (currently
`const base = match.url.split("/")[1];` and the two `base === "community"`
guards). New body of that section:

```js
function Community() {
  const match = useRouteMatch();
  const params = match.params;
  const isCommunity = isCommunityPath(match.url);

  let urlFeedGroup = isCommunity ? params.channelId : null;
  let urlFeedMessage = isCommunity ? params.messageId : null;

  const [activeGroup, setActiveGroup] = useState(urlFeedGroup);
  const [activeMessage, setActiveMessage] = useState(urlFeedMessage);

  useEffect(() => {
    let urlFeedGroup = isCommunity ? params.channelId : null;
    let urlFeedMessage = isCommunity ? params.messageId : null;
    setActiveGroup(urlFeedGroup);
    setActiveMessage(urlFeedMessage);
  }, [params]);
```

(Leave the rest of `Community` unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/views/Home/__tests__/communityPath.test.js --watchAll=false`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/views/Home/Community.js src/views/Home/__tests__/communityPath.test.js
git commit -m "fix(community): detect community path anywhere in URL for nested Home"
```

---

## Task 4: `HomeTabs` tab bar component

**Files:**
- Create: `src/views/Home/HomeTabs.js`, `src/views/Home/HomeTabs.css`
- Test: `src/views/Home/__tests__/HomeTabs.test.js`

Renders Explore / Community / User tabs as `<Link>`s. Community tab is present
only when messenger is enabled. Active tab derived from `pathname`.

- [ ] **Step 1: Write the failing test**

```js
// src/views/Home/__tests__/HomeTabs.test.js
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

jest.mock("src/models/featureFlags", () => ({ isMessengerEnabled: jest.fn(() => true) }));
jest.mock("src/models/Utils", () => ({ label: (k) => k }));

import { isMessengerEnabled } from "src/models/featureFlags";
import HomeTabs from "../HomeTabs";

const renderAt = (path) =>
  render(<MemoryRouter initialEntries={[path]}><HomeTabs /></MemoryRouter>);

describe("HomeTabs", () => {
  beforeEach(() => isMessengerEnabled.mockReturnValue(true));

  test("shows all three tabs when messenger on", () => {
    renderAt("/home");
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("menu_community")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
  });

  test("hides Community tab when messenger off", () => {
    isMessengerEnabled.mockReturnValue(false);
    renderAt("/home");
    expect(screen.queryByText("menu_community")).not.toBeInTheDocument();
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
  });

  test("marks the active tab from the URL", () => {
    renderAt("/home/community");
    expect(screen.getByText("menu_community").closest("a")).toHaveClass("active");
    expect(screen.getByText("Explore").closest("a")).not.toHaveClass("active");
  });

  test("Explore is active on bare /home", () => {
    renderAt("/home");
    expect(screen.getByText("Explore").closest("a")).toHaveClass("active");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/views/Home/__tests__/HomeTabs.test.js --watchAll=false`
Expected: FAIL — "Cannot find module '../HomeTabs'".

- [ ] **Step 3: Write the component and styles**

```js
// src/views/Home/HomeTabs.js
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { label } from "src/models/Utils";
import { isMessengerEnabled } from "src/models/featureFlags";
import "./HomeTabs.css";

// The Sampler/explore tab has no dictionary key yet; fall back to "Explore"
// until `home_tab_explore` is added to the label dictionary (backend).
const exploreLabel = () => {
  const t = label("home_tab_explore");
  return t && t !== "home_tab_explore" ? t : "Explore";
};

// Active tab from the pathname: /home/user → user, /home/community → community,
// anything else under /home → explore.
export const activeTabFor = (pathname) => {
  if (/^\/home\/user/.test(pathname)) return "user";
  if (/^\/home\/community/.test(pathname)) return "community";
  return "explore";
};

export default function HomeTabs() {
  const { pathname } = useLocation();
  const active = activeTabFor(pathname);
  const useMessenger = isMessengerEnabled();

  const tabs = [
    { key: "explore", to: "/home", text: exploreLabel() },
    ...(useMessenger ? [{ key: "community", to: "/home/community", text: label("menu_community") }] : []),
    { key: "user", to: "/home/user", text: label("user") },
  ];

  return (
    <nav className="home-tabs" role="tablist">
      {tabs.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          role="tab"
          aria-selected={active === t.key}
          className={"home-tab" + (active === t.key ? " active" : "")}
        >
          {t.text}
        </Link>
      ))}
    </nav>
  );
}
```

```css
/* src/views/Home/HomeTabs.css */
.home-tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid #d9d9d9;
  padding: 0 0.5rem;
  position: sticky;
  top: 0;
  background: inherit;
  z-index: 5;
}
.home-tab {
  padding: 0.6rem 1.1rem;
  font-weight: 600;
  color: #666;
  text-decoration: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
  white-space: nowrap;
}
.home-tab:hover { color: #333; text-decoration: none; }
.home-tab.active {
  color: #2a7ae2;
  border-bottom-color: #2a7ae2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/views/Home/__tests__/HomeTabs.test.js --watchAll=false`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/views/Home/HomeTabs.js src/views/Home/HomeTabs.css src/views/Home/__tests__/HomeTabs.test.js
git commit -m "feat(home): add HomeTabs desktop tab bar (Explore/Community/User)"
```

---

## Task 5: `Home` shell (tab bar + inner routing + guards)

**Files:**
- Create: `src/views/Home/Home.js`
- Test: `src/views/Home/__tests__/Home.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/views/Home/__tests__/Home.test.js
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";

jest.mock("../Sampler", () => () => <div>SAMPLER</div>);
jest.mock("../Community", () => () => <div>COMMUNITY</div>);
jest.mock("../../User/User", () => () => <div>USER</div>);
jest.mock("../HomeTabs", () => () => <div>TABS</div>);
jest.mock("src/models/featureFlags", () => ({ isMessengerEnabled: jest.fn(() => true) }));
jest.mock("src/models/Utils", () => ({ isMobile: jest.fn(() => false), label: (k) => k }));

import { isMessengerEnabled } from "src/models/featureFlags";
import { isMobile } from "src/models/Utils";
import Home from "../Home";

const renderAt = (path) => {
  let location;
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <Home />
      <Route path="*" render={({ location: l }) => { location = l; return null; }} />
    </MemoryRouter>
  );
  return { view, getLocation: () => location };
};

beforeEach(() => {
  isMessengerEnabled.mockReturnValue(true);
  isMobile.mockReturnValue(false);
});

describe("Home shell routing", () => {
  test("/home renders Sampler", () => {
    renderAt("/home");
    expect(screen.getByText("SAMPLER")).toBeInTheDocument();
  });
  test("/home/community renders Community", () => {
    renderAt("/home/community");
    expect(screen.getByText("COMMUNITY")).toBeInTheDocument();
  });
  test("/home/community/:channelId renders Community", () => {
    renderAt("/home/community/abc123");
    expect(screen.getByText("COMMUNITY")).toBeInTheDocument();
  });
  test("/home/user renders User", () => {
    renderAt("/home/user");
    expect(screen.getByText("USER")).toBeInTheDocument();
  });
  test("/home/user/history renders User", () => {
    renderAt("/home/user/history");
    expect(screen.getByText("USER")).toBeInTheDocument();
  });
  test("legacy /home/:channelId redirects to /home/community/:channelId", () => {
    const { getLocation } = renderAt("/home/xyz789");
    expect(getLocation().pathname).toBe("/home/community/xyz789");
  });
});

describe("Home shell tab bar visibility", () => {
  test("renders tab bar on desktop", () => {
    renderAt("/home");
    expect(screen.getByText("TABS")).toBeInTheDocument();
  });
  test("hides tab bar on mobile", () => {
    isMobile.mockReturnValue(true);
    renderAt("/home");
    expect(screen.queryByText("TABS")).not.toBeInTheDocument();
    expect(screen.getByText("SAMPLER")).toBeInTheDocument();
  });
});

describe("Home shell messenger gate", () => {
  test("/home/community redirects to /home when messenger off", () => {
    isMessengerEnabled.mockReturnValue(false);
    const { getLocation } = renderAt("/home/community");
    expect(getLocation().pathname).toBe("/home");
    expect(screen.getByText("SAMPLER")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/views/Home/__tests__/Home.test.js --watchAll=false`
Expected: FAIL — "Cannot find module '../Home'".

- [ ] **Step 3: Write the shell**

```js
// src/views/Home/Home.js
import React from "react";
import { Switch, Route, Redirect } from "react-router-dom";
import { isMobile } from "src/models/Utils";
import { isMessengerEnabled } from "src/models/featureFlags";
import HomeTabs from "./HomeTabs";
import Sampler from "./Sampler";
import Community from "./Community";
import User from "../User/User";

// Unified Home shell (spec: docs/specs/2026-07-17-unified-tabbed-home.md).
// Owns the desktop tab bar + an inner Switch that renders the existing Sampler /
// Community / User views as pure content. Param names are preserved so those
// components keep reading their own useParams/useRouteMatch. The shell does not
// remount when tabs change — only the matched child swaps.
export default function Home() {
  const useMessenger = isMessengerEnabled();

  return (
    <div className="home-shell">
      {!isMobile() && <HomeTabs />}
      <Switch>
        <Route path="/home/user/:value?"><User /></Route>

        {useMessenger ? (
          <Route path="/home/community/:channelId/:messageId(\d+)"><Community /></Route>
        ) : null}
        {useMessenger ? (
          <Route path="/home/community/:channelId"><Community /></Route>
        ) : null}
        {useMessenger ? (
          <Route exact path="/home/community"><Community /></Route>
        ) : (
          <Route path="/home/community"><Redirect to="/home" /></Route>
        )}

        <Route exact path="/home"><Sampler /></Route>

        {/* Legacy bare /home/:channelId messenger deep links → community tab. */}
        <Route
          path="/home/:legacyChannelId"
          render={({ match }) => (
            <Redirect to={`/home/community/${match.params.legacyChannelId}`} />
          )}
        />
      </Switch>
    </div>
  );
}
```

**Note on JSX-in-Switch:** React Router v5 `<Switch>` reads the `path`/`exact`
props of its direct `Route`/`Redirect` children to pick the first match. The
`{cond ? <Route/> : null}` children above are fine — `Switch` skips `null`
children. Keep the community routes *before* the `exact /home` and the legacy
fallback so they match first.

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/views/Home/__tests__/Home.test.js --watchAll=false`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/views/Home/Home.js src/views/Home/__tests__/Home.test.js
git commit -m "feat(home): add unified Home shell with inner routing and guards"
```

---

## Task 6: Wire routes in `Routes.js` (Home subtree + redirects)

**Files:**
- Modify: `src/models/Routes.js`
- Test: `src/models/__tests__/routesRedirects.test.js`, `src/models/__tests__/routesShape.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/models/__tests__/routesShape.test.js
import routes from "../Routes";

const paths = routes.map((r) => r.path);

describe("routes shape after Home unification", () => {
  test("has a non-exact /home entry", () => {
    const home = routes.find((r) => r.path === "/home");
    expect(home).toBeTruthy();
    expect(home.exact).toBeFalsy();
  });
  test("no standalone /community entry remains", () => {
    expect(paths).not.toContain("/community");
  });
  test("no standalone /user entry remains", () => {
    expect(paths).not.toContain("/user");
    expect(paths).not.toContain("/user/:value");
    expect(paths).not.toContain("/user/signup");
  });
  test("redirect entries exist for old community + user paths", () => {
    expect(paths).toContain("/community/:channelId");
    expect(paths).toContain("/user/:value");
  });
});
```

```js
// src/models/__tests__/routesRedirects.test.js
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Switch, Route } from "react-router-dom";
import { CommunityRedirect, UserRedirect } from "../Routes";

const landAt = (entries, routeEls) => {
  let loc;
  render(
    <MemoryRouter initialEntries={entries}>
      <Switch>
        {routeEls}
        <Route path="*" render={({ location }) => { loc = location; return null; }} />
      </Switch>
    </MemoryRouter>
  );
  return () => loc;
};

describe("legacy path redirects", () => {
  test("/community → /home/community", () => {
    const get = landAt(["/community"], [
      <Route key="c" exact path="/community" component={CommunityRedirect} />,
    ]);
    expect(get().pathname).toBe("/home/community");
  });
  test("/community/:channelId → /home/community/:channelId", () => {
    const get = landAt(["/community/abc"], [
      <Route key="c" path="/community/:channelId" component={CommunityRedirect} />,
    ]);
    expect(get().pathname).toBe("/home/community/abc");
  });
  test("/community/:channelId/:messageId → nested", () => {
    const get = landAt(["/community/abc/42"], [
      <Route key="c" path="/community/:channelId/:messageId(\\d+)" component={CommunityRedirect} />,
    ]);
    expect(get().pathname).toBe("/home/community/abc/42");
  });
  test("/user → /home/user", () => {
    const get = landAt(["/user"], [
      <Route key="u" exact path="/user" component={UserRedirect} />,
    ]);
    expect(get().pathname).toBe("/home/user");
  });
  test("/user/history → /home/user/history", () => {
    const get = landAt(["/user/history"], [
      <Route key="u" path="/user/:value" component={UserRedirect} />,
    ]);
    expect(get().pathname).toBe("/home/user/history");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test src/models/__tests__/ --watchAll=false`
Expected: FAIL — `CommunityRedirect`/`UserRedirect` not exported; `/home` still `exact`.

- [ ] **Step 3: Edit `Routes.js`**

Add the lazy `Home` import (replace the separate `Sampler`/`Community` lazy
imports’ usage — keep whichever the shell still needs; the shell imports Sampler
and Community directly, so remove them from `Routes.js`):

```js
const Home = lazy(() => import("../views/Home/Home.js"));
```
Remove these lines from `Routes.js` (now imported by the shell, not the router):
```js
const Sampler = lazy(() => import("../views/Home/Sampler.js"));
const Community = lazy(() => import("../views/Home/Community.js"));
const User = lazy(() => import("../views/User/User.js"));
```
(`User` becomes unused in `Routes.js` once the `/user*` routes are redirects —
removing it avoids an unused-import lint error. The shell imports `User`
directly.)

Add the redirect components near the top (after `HomeChannelRedirect`), and
export them for tests:

```js
// Legacy /community/* and /user/* now live under the unified Home.
export const CommunityRedirect = () => {
  const { channelId, messageId } = useParams();
  const tail = channelId ? `/${channelId}${messageId ? `/${messageId}` : ""}` : "";
  return <Redirect to={`/home/community${tail}`} />;
};
export const UserRedirect = () => {
  const { value } = useParams();
  return <Redirect to={`/home/user${value ? `/${value}` : ""}`} />;
};
```

Delete the now-obsolete `HomeChannelRedirect` component and its two routes
(`/home/:channelId/:messageId(\d+)` and `/home/:channelId`) — the shell handles
legacy `/home/:channelId`.

Replace the `/home` (Sampler) and the three `/community*` route objects with a
single Home entry, and replace the three `/user*` route objects with redirects.
The relevant section of the `routes` array becomes:

```js
  {
    // Unified tabbed Home: /home (Sampler), /home/community, /home/user.
    // Non-exact so the Home shell handles all sub-paths. (spec:
    // docs/specs/2026-07-17-unified-tabbed-home.md)
    path: "/home",
    component: Home,
  },
  // Legacy redirects into the unified Home (most specific first).
  {
    path: "/community/:channelId/:messageId(\\d+)",
    component: CommunityRedirect,
  },
  {
    path: "/community/:channelId",
    component: CommunityRedirect,
  },
  {
    exact: true,
    path: "/community",
    component: CommunityRedirect,
  },
  {
    path: "/user/:value",
    component: UserRedirect,
  },
  {
    exact: true,
    path: "/user",
    component: UserRedirect,
  },
```

(`/user/signup` is covered by `/user/:value` → `/home/user/signup`; the User
view already routes `signup` internally. Remove the separate `/user/signup`
entry.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npx react-scripts test src/models/__tests__/ --watchAll=false`
Expected: PASS (routesShape: 3 tests; routesRedirects: 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/models/Routes.js src/models/__tests__/routesRedirects.test.js src/models/__tests__/routesShape.test.js
git commit -m "feat(routes): unify Home subtree + redirect legacy /community and /user"
```

---

## Task 7: Update `menuConfig.js` (remove Community item)

**Files:**
- Modify: `src/views/_Common/menuConfig.js`
- Test: `src/views/_Common/__tests__/menuConfig.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/views/_Common/__tests__/menuConfig.test.js
import { menuConfig } from "../menuConfig";

describe("menuConfig after Home unification", () => {
  test("keeps the home item", () => {
    expect(menuConfig.some((i) => i.slug === "home")).toBe(true);
  });
  test("no separate community item", () => {
    expect(menuConfig.some((i) => i.slug === "community")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/views/_Common/__tests__/menuConfig.test.js --watchAll=false`
Expected: FAIL — community item still present.

- [ ] **Step 3: Remove the community entry**

Delete this object from the `menuConfig` array in `src/views/_Common/menuConfig.js`:

```js
  {
    slug: "community",
    labelKey: "menu_community",
    requiresMessenger: true,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/views/_Common/__tests__/menuConfig.test.js --watchAll=false`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/views/_Common/menuConfig.js src/views/_Common/__tests__/menuConfig.test.js
git commit -m "feat(sidebar): drop standalone Community menu item (now a Home tab)"
```

---

## Task 8: Update `Sidebar.js` (use resolveActivePath, split active state, fix links)

**Files:**
- Modify: `src/views/_Common/Sidebar.js` (`determinePath` ~271-279; menu item `isActive` ~279; `UserInfo` active ~501 and links ~507-565)

No new test file (Sidebar pulls heavy deps; the logic is covered by Task 1). This
task wires the helper in and updates the JSX. Verify by build + manual check.

- [ ] **Step 1: Import the helper and replace `determinePath`**

At the top of `Sidebar.js`, add:
```js
import { resolveActivePath } from "./sidebarPath";
```
Replace the `determinePath` function body (currently lines ~271-280) with:
```js
  const determinePath = () => {
    let slugs = menu.map((m) => m.slug);
    return resolveActivePath(window.location.pathname, slugs);
  };
```

- [ ] **Step 2: Split the Home vs User active state in the menu map**

In the `menu.map(...)` render (currently `let isActive = activePath.match(new RegExp("^/" + r.slug));`), special-case `home` so it does NOT highlight on the user tab:
```js
            let isActive = r.slug === "home"
              ? /^\/home(?!\/user)/.test(activePath)
              : activePath.match(new RegExp("^/" + r.slug));
```

- [ ] **Step 3: Update the `UserInfo` profile-card active state + links**

In `UserInfo`, change the active check (line ~501):
```js
  let isActive = /^\/home\/user/.test(activePath);
```
Update the profile-card `NavLink` target (line ~507) and `setActivePath`:
```js
        <NavLink to={"/home/user"} onClick={() => {
          appController.activeLeafCursorController?.activeAudio?.pause();
          appController.functions.closePopUp();
          setActivePath("/home/user");
          }}>
```
Update the settings + history links (lines ~563-565):
```js
            <Link to={"/home/user/preferences"} aria-label={label("user_prefs")}><img data-tip={label("user_prefs")} src={settings} alt={label("user_prefs")} /></Link>
            {!notLoggedIn && <NavLink to={"/home/user/history"} aria-label={label("user_history")}>
```

- [ ] **Step 4: Verify build + existing tests**

Run: `CI=true npx react-scripts test src/views/_Common/ --watchAll=false`
Expected: PASS (sidebarPath, bottomNavSelection, menuConfig suites green; no Sidebar regressions).

- [ ] **Step 5: Commit**

```bash
git add src/views/_Common/Sidebar.js
git commit -m "feat(sidebar): route profile card to /home/user; split Home/User active state"
```

---

## Task 9: Update `BottomNav.js` (use resolveBottomSelection, fix User path)

**Files:**
- Modify: `src/views/_Common/BottomNav.js` (`determineSelection` ~19-27; User nav item `path` ~86)

- [ ] **Step 1: Import the helper and replace `determineSelection`**

At the top of `BottomNav.js`, add:
```js
import { resolveBottomSelection } from "./bottomNavSelection";
```
Replace `determineSelection` (lines ~19-27) with:
```js
  const determineSelection = () =>
    resolveBottomSelection(window.location.pathname, USE_MESSENGER);
```

- [ ] **Step 2: Point the User nav item at `/home/user`**

In `allNavItems`, change the User item's `path` from `'/user'` to `'/home/user'`
(the Home item stays `'/home'`):
```js
    {
      title: label('user') || 'User',
      icon: <UserIcon className='img' fill='#7F7F7F' />,
      activeIcon: <UserIcon className='img' />,
      path: '/home/user',
      requiresMessenger: false,
    },
```

- [ ] **Step 3: Verify tests**

Run: `CI=true npx react-scripts test src/views/_Common/ --watchAll=false`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/views/_Common/BottomNav.js
git commit -m "feat(bottomnav): point User item at /home/user via resolveBottomSelection"
```

---

## Task 10: Stray-link sweep + full test run

**Files:** repo-wide grep; fix any internal hard-links found.

- [ ] **Step 1: Grep for internal links still pointing at old paths**

Run (from `frontend/webapp/`):
```bash
grep -rn "to=\"/user\|to={\"/user\|to='/user\|to=\"/community\|to={\"/community\|history.push(\"/user\|history.push(\"/community" src --include=*.js | grep -v __tests__
```
Expected: only Sidebar/BottomNav (already updated) — if any others appear (e.g.
components linking to `/user` or `/community`), update them to `/home/user` /
`/home/community`. Note: bare string mentions inside `Community.js`/`User.js`
internal logic are fine; only fix `<Link>`/`NavLink`/`history.push` navigation
targets.

- [ ] **Step 2: Commit any fixes found**

```bash
git add -A && git commit -m "fix: update remaining internal links to unified Home paths"
```
(If no matches beyond already-updated files, skip this commit.)

- [ ] **Step 3: Run the full frontend test suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS — all suites green, including the pre-existing `Sampler.test.js`.

> Note: the memory “frontend perf / test state” records 8 pre-existing frontend
> test failures unrelated to this change. If those exact suites fail, confirm
> they fail on `dev` before this branch too; do not treat them as regressions.

- [ ] **Step 4: Commit (if the suite required any test updates)**

```bash
git add -A && git commit -m "test: update suites referencing legacy /community and /user routes"
```

---

## Task 11: Next SSR parity verification

**Files:** none expected (see spec §Next SSR parity). Verification only.

- [ ] **Step 1: Reason about why no code change is needed**

`frontend/next/middleware.ts` rewrites every human GET to the CRA
(`localhost:8201`) transparently, so `/home/community` and `/home/user` are
handled by the CRA router. `/home`, `/community`, `/user` are not in
`lib/sitemap.ts` nor the bot route-class table (`lib/seo.ts` / DefaultShell), so
bots keep getting the generic shell. Old `/community` / `/user` redirect
client-side via the CRA `<Redirect>` routes.

- [ ] **Step 2: Run the parity harnesses**

Run (from `frontend/next/`):
```bash
node scripts/parity.mjs /home /community /user
node scripts/sitemap-diff.mjs
```
Expected: `all head fields match` and `SITEMAP PARITY`. (These paths resolve to
the DefaultShell; parity is with the PHP box, which also serves the default
shell for them.)

- [ ] **Step 3: Manual smoke on dev**

Per CLAUDE.md, verify on `http://localhost:8200` directly (not `bom.kckern.net`
— CDN-cached). Check: `/home` shows Explore tab active; clicking Community/User
tabs navigates to `/home/community` and `/home/user`; old `/community` and
`/user` redirect in; sidebar profile card + mobile User bottom-nav land on
`/home/user`; Community tab hidden when messenger flag is off.

- [ ] **Step 4: No commit** (verification task). Record results in the PR description.

---

## Self-Review Notes

- **Spec coverage:** tabs+default (Tasks 4,5) · URL collapse under /home (Task 6) · redirects (Task 6) · messenger gate (Tasks 4,5) · desktop-only tab bar (Task 5) · sidebar item removal + active split + link updates (Tasks 7,8) · bottom-nav (Task 9) · Community param fix (Task 3) · SSR verification (Task 11) · tests throughout · stray-link sweep (Task 10).
- **Naming consistency:** `resolveActivePath`, `resolveBottomSelection`, `isCommunityPath`, `activeTabFor`, `CommunityRedirect`, `UserRedirect`, `Home`, `HomeTabs` used identically across definition and consumer tasks.
- **Known caveat:** existing `BottomNav` messenger-OFF indices are preserved verbatim (not “fixed”) — only the `/home/user` split is added, per YAGNI/scope.
