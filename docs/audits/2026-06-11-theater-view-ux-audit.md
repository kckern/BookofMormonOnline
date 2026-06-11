# Theater View UX & Frontend-Efficiency Audit

**Date:** 2026-06-11
**Scope:** `frontend/webapp/src/views/Theater/` (Theater.js 1882 lines, Theater.css 1428 lines)
**Trigger:** User reports: (1) scrolling text and progress bar are sometimes choppy; (2) audio sometimes plays choppy at first; plus a general request to check UX best practices and frontend efficiency.
**Context:** Recent backend-side theater perf work already landed (`179a0aaf` queue API, `dd4778a8` commentary preview, `e4a1d37e` null-token logging). This audit is the frontend complement.

---

## Part 1 — Choppy scrolling text & progress bar (root causes confirmed)

The user's hunch ("might benefit from a transform animation for tweening") is half the answer. There are two compounding causes: a **20Hz full-tree re-render storm**, and **no CSS tweening between the discrete steps** it produces.

### 1.1 (HIGH) Every 50ms audio tick re-renders the entire Theater tree

`ReactAudioPlayer` is configured with `listenInterval={50}` (`Theater.js:997`). Each tick, `onListen` (`Theater.js:901`) calls `setCurrentProgress(...)` — and `currentProgress` is **`TheaterWrapper` state** (`Theater.js:84`). Nothing in the file is wrapped in `React.memo`, so 20×/second React re-renders the whole tree: `TheaterMainPanel`, `TheaterContent`, `TheaterQueueIndicator` (every dot rebuilds its HTML tooltip string), `TheaterMeta`/`TheaterNarration` (rebuilds the narration map and `<ul>`), `TheatherMusicPlayer`, the full side panel (`TheaterPeoplePlacePanel`, `TheaterImagePanel`, `TheaterCommentFeed`)…

Per-tick hotspots inside that storm:
- `TheaterContent` re-runs `Parser(content)` — html-react-parser on the full passage HTML — every 50ms (`Theater.js:1262`).
- `TheaterCommentFeed` re-filters and **re-randomizes** `queuedMessages` every render (`Theater.js:1805` — `.sort(() => Math.random() - 0.5)` on each pass), so the "which comment is next" cursor points into a different random order on every tick.
- `onListen` reassigns `player.playbackRate = ...` every tick (`Theater.js:906`) — a media-pipeline property write per tick, also implicated in audio glitching (see 2.2).
- `TheaterContent` and `TheaterPeoplePlacePanel` read the DOM during render (`document.getElementById("theater-audio-player")?.currentTime/paused/seeking/ended` at `Theater.js:1195-1198, 1244-1246, 1692-1694`) — impure renders that can disagree frame-to-frame.

**Fix direction (ordered by payoff/effort):**
1. **Decouple progress from React state.** Drive the slider/progress visuals from the audio element directly: in `onListen` (or a native `timeupdate` listener), set a CSS custom property (`el.style.setProperty('--progress', pct)`) or write `transform` on two refs — no `setState` at all. The text slider, progress bar, image zoom, and people-panel reveal can all consume `--progress` from CSS. Keep a *coarse* React state (e.g. once per second, or threshold-crossing only) for things that genuinely need re-render (comment cursor, 85% completion log).
2. If a smaller step is preferred: raise `listenInterval` to 250–500ms **and** add CSS transitions (1.2/1.3) so tweening hides the coarser steps; plus `React.memo` the side-panel components and `TheaterQueueIndicator` with stable props.
3. Hoist `filteredcoms`/`queuedMessages` into `useMemo` keyed on `[cursorIndex]`, with the random shuffle done **once per item**, not per render.

### 1.2 (HIGH) Text slider: discrete `translateY` jumps with no transition

`.theater-content-slider` (`Theater.css:271-275`) has **no `transition`**. The slider position comes from inline `transform: translateY(-${yPosition}%)` (`Theater.js:1260`), which updates in quantized steps each tick. Result: visible stutter, worse whenever a tick is delayed (GC pause, the re-render storm above, background tab throttling).

**Fix:** add to `.theater-main-panel .theater-content-slider`:
```css
transition: transform 0.3s linear, opacity 0.5s ease-in-out;
will-change: transform;
```
The browser then tweens between ticks on the compositor; even 500ms ticks look smooth. (Transform is already the right property here — good — it's only the tween that's missing. The `opacity` fade computed in JS at `Theater.js:1235-1248` also benefits.)

### 1.3 (HIGH) Progress bar animates `width` — layout + paint per tick, no tween

`ProgressBar` sets `style={{ width: percent% }}` (`Theater.js:1600-1611`) and `.theater-controls .progress-bar-inner` (`Theater.css:1042-1049`) has no transition. `width` changes trigger layout + paint 20×/second.

**Fix:** animate compositor-friendly `transform` instead:
```css
.theater-controls .progress-bar-inner {
    transform-origin: left center;
    transition: transform 0.3s linear;
    will-change: transform;
}
```
```jsx
<div className="progress-bar-inner" style={{ transform: `scaleX(${percent / 100})` }} />
```
(Keep the container's `border-radius` + `overflow: hidden` so the scaled bar clips correctly; the `border-right` "playhead" line may need to become a separate element since `scaleX` stretches it.)

---

## Part 2 — Audio choppy at first

Not literally a "memory storm," but the instinct is right: there is a **startup contention storm** — network, decode, and main-thread — at the exact moment playback begins.

### 2.1 (HIGH) Network burst at first play: 4 audio streams + image preloads at once

On mount/first play the page concurrently fetches:
- the main narration audio (`Theater.js:982-1001`),
- **two** background-music tracks — players A and B both get random `src` immediately (`Theater.js:1101-1126`), no `preload="none"`,
- the intro SFX via `new Audio(...)` created during `TheaterQueueIntro` render (`Theater.js:501-503`),
- background art (`theater/gold-1`, `people-1`, `canvas-1`) and the per-item art preload loop (`Theater.js:1726-1732`).

On a constrained connection the narration stream gets starved exactly when it has the least buffer → initial stutter.

**Fix:** stagger startup. Give player B `preload="none"` and only set its `src` when a crossfade is actually upcoming (the `nextSectionIsNew` effect at `Theater.js:1040` already knows); delay the art preload loop until `onPlaying` + a few seconds; create the intro SFX lazily inside the play handler. Consider `preload="metadata"` on music player A until the main player fires `playing`.

### 2.2 (MEDIUM) Media-pipeline writes per tick + redundant `play()` calls

- `player.playbackRate` is reassigned every 50ms in `onListen` (`Theater.js:906`) even when unchanged. Rate writes can cause audible pitch/seek artifacts on some browsers. Set it once on `onCanPlay` and when the user changes speed (those paths already exist: `Theater.js:884, 156, 167`).
- `play()` is invoked from several competing sites: the `[playerCanPlay, visible]` effect (`Theater.js:881-886`), `initPlayerA`'s `canplay` listener (`Theater.js:1028-1036`), `crossfade()` (`Theater.js:1072`), and both music players' `onCanPlay` handlers (`Theater.js:1106-1112, 1119-1125`). Overlapping `play()` promises are a classic source of `AbortError`/stutter. Centralize playback intent in one place.
- Playback starts on `canplay` (minimal buffer) rather than `canplaythrough`. For a long narration on a slow link, waiting for `canplaythrough` (or at least a small `buffered` threshold) trades ~a second of latency for smooth start.

### 2.3 (MEDIUM) API burst exactly at play-start

`onPlay` calls `logItem()` (`Theater.js:992`), which fires **three sequential uncached API calls** — `log`, `queuestatus` (`Theater.js:915-931`), then `userprogress` (`Theater.js:948`) — plus `appController.functions.updateUserSummary(...)`, which sets state at the App level and re-renders the app shell, all in the first seconds of playback. And `onPlay` fires on **every** resume, not just the first play of an item.

**Fix:** debounce/defer logging until a few seconds into playback (or piggyback on the existing 85% `updateQueueStatus` path), and guard so resume-after-pause doesn't re-log. Run it during idle (`requestIdleCallback`/`setTimeout`) rather than inside the play handler.

### 2.4 (MEDIUM) Timer and listener leaks accumulate over a session

The longer a session runs (Theater is exactly the view users keep open for 30+ minutes), the more orphaned timers tick in the background:
- `TheaterSectionIntro`'s 200ms countdown interval is **never cleared** — no cleanup return (`Theater.js:601-612`); each section intro leaks one interval for the rest of the session, plus a 10s `setTimeout` calling `setSubCursorIndex` after unmount.
- `TheaterQueueIntro`'s three staged `setTimeout`s (`Theater.js:512-514`) aren't cleared on unmount.
- `crossfade()`'s 50ms fade interval (`Theater.js:1079-1089`) and the outro fade interval (`Theater.js:263-269`) aren't cleared on unmount.
- `ButtonTimer`'s hide timeout (`Theater.js:635`) isn't cleared.
- `TheaterQueueIntro` constructs a `new Audio(...)` in `useState` on every intro mount (`Theater.js:501`) — each one is a live media element until GC.

Individually small; collectively this is the closest thing to the reported "memory storm," and the leaked `setState`-after-unmount calls also trigger extra React work. **Fix:** every `setInterval`/`setTimeout` in an effect returns a cleanup; create audio objects lazily and `pause()` + drop on cleanup.

---

## Part 3 — Outright bugs found along the way

### 3.1 (HIGH) Music player B's `onCanPlay` controls player A (copy-paste bug)

Player B's handler (`Theater.js:1119-1125`) checks `theater-music-player-a`'s paused state, checks `activeSide==="a"`, and plays **player A** — identical to player A's handler. Player B can never self-start from this path; crossfades into B rely solely on `crossfade()`. Both handlers also have inverted-looking logic: `const isPLaying = player.paused; if (isPLaying) return;` — the variable named "isPlaying" holds *paused*, and the early-returns don't match the apparent intent. This whole pair needs a rewrite with named helpers.

### 3.2 (MEDIUM) `history.push` on every queue advance — Back button walks every passage

The `[currentItem]` effect does `history.push(/theater/${slug})` (`Theater.js:876`). A 20-item session leaves 20 history entries; pressing Back replays each passage URL. Should be `history.replace` (the queue position isn't a navigation the user made).

### 3.3 (MEDIUM) `cycleVolume` strict-equality ladder silently no-ops

`Theater.js:172-181` only matches exactly 0.2/0.4/0.6/0.8/1. Any other volume (initial default, float drift like `0.6000000000000001` from repeated arithmetic, or anything set via the settings slider) makes the button do nothing. It also never persists to `playbackVolume` state or localStorage, so the React `volume` prop can snap it back. Use a tolerance/index-based cycle through a list and go through `setPlaybackVolume`.

### 3.4 (MEDIUM) Music-volume input writes player A twice, player B never

`PlaybackSettings.handleInput` (`Theater.js:1533-1535`) sets `theater-music-player-a`'s volume on two consecutive lines (copy-paste); player B is untouched, so adjusting music volume mid-crossfade (or while B is the active side) does nothing audible. Also the stored value is `label/20` while the displayed value is the raw label (`Theater.js:1529-1536`) — display says "50%", actual volume is 2.5%; intent (music quieter than narration) is undocumented magic.

### 3.5 (LOW) State-updater misuse returns `undefined`

`incrementPlaybackSpeed`/`cyclePlaybackSpeed`/`PlaybackSettings.handleInput` use `setX(() => { ... if (!player) return; ... })` (`Theater.js:140-170, 1514-1537`) — the guard paths return `undefined`, setting state to `undefined` (downstream `(playbackRate||1)` papers over it). Compute the value first, then call the setter; do DOM writes outside the updater.

### 3.6 (LOW) Direct state mutation

- `queueStatus[cursorIndex] = "prestarted"` mutates state before `setQueueStatus([...queueStatus])` (`Theater.js:326-329`).
- `currentItem.updated = true` mutates a queue item inside `onListen` (`Theater.js:910`).
- `item.coms.sort(...)` mutates fetched queue items in place (`Theater.js:236-239`).

### 3.7 (LOW) `useEffect(async () => ...)` antipattern

`Theater.js:220` (queue load) and `Theater.js:1808` (comment feed) pass async functions directly to `useEffect` — the returned Promise is treated as a cleanup function (React warns; cleanups never run). Wrap the async body in an inner function.

---

## Part 4 — UX best-practice notes (smaller)

- **Tab hijack:** `Tab` is intercepted globally to click the latest comment (`Theater.js:308-315`) — keyboard users can't move focus. Same a11y class of issue as the Read view's Tab hijack; pick a letter key instead (e.g. `c`).
- **Space conflicts:** global Space toggles playback even when focus is on a button/switch (`Theater.js:278-285`), causing double-activation; also `setIsPlaying(!isPlaying)` *and* play/pause callbacks both run, double-managing state the player events already manage.
- **Dead/unused code:** `volA/volB/timeA/timeB` computed in render and unused (`Theater.js:1094-1097`); `firstIncompleteItem` computed then ignored (`Theater.js:248-251`); `computePosition` is identity (`Theater.js:1221-1223`); `seekTo` queries `.theater-progress-bar` and never uses it (`Theater.js:1475`).
- **Comment keys by array index** over a spread Set (`Theater.js:1874`) — newly inserted comments re-key existing ones; use `com.id`.
- **`TheaterPeoplePlacePanel` declares `useLayoutEffect` referencing `setTransitioning` before the `useState` line** (`Theater.js:1682-1686`) — legal at runtime but a readability trap; reorder.
- **Seek bar has no keyboard/ARIA affordance** (`Theater.js:1492` is click-only; no `role="slider"`, no arrow-key seeking) — the audio element's native controls are rendered (`controls` prop) but visually hidden behind the custom bar.

---

## Recommended fix order

1. **Tweening quick win (small, addresses the report):** add `transition: transform` to `.theater-content-slider` and convert `ProgressBar` to `scaleX` + transition (1.2, 1.3). Ship alone; visible improvement even before the storm fix.
2. **Kill the 20Hz re-render storm (medium):** progress via CSS variable/refs, coarse React state only (1.1). This also removes the per-tick `Parser()` cost and per-tick `playbackRate` writes (2.2 first bullet).
3. **Startup audio contention (medium):** stagger music/SFX/art loading (2.1), single play-path (2.2), defer play-start logging (2.3).
4. **Leak cleanup sweep + the four bugs (small, mechanical):** 2.4, 3.1–3.4.
5. The Part 3.5–3.7 and Part 4 items are good batched "hygiene" work whenever someone is next in the file.

Items 1, 4 are low-risk and test-friendly; item 2 wants a careful manual pass on dev (`localhost:8200/theater/...`, not the CDN-cached public URL) since so much behavior hangs off `currentProgress`.
