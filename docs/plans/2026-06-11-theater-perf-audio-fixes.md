# Theater Performance & Audio Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Theater view's choppy text/progress-bar animation and choppy audio start, per the audit `docs/audits/2026-06-11-theater-view-ux-audit.md`.

**Architecture:** Two-pronged animation fix: CSS transitions tween between discrete progress steps (Task 1), then progress updates move out of React state into a CSS variable so the 20Hz `onListen` tick stops re-rendering the whole tree (Task 2). Audio-start fixes remove the startup contention storm: per-render `new Audio` construction, dual music-track preloads, art preloads, and the play-start API burst all get lazy/staggered/deferred (Tasks 3–4). Then leak cleanup and four concrete bugs (Tasks 5–6) and a small hygiene pass (Task 7). Pure logic extracted for the one TDD-able piece (comment-queue building) goes in a new `theaterUtils.js`.

**Tech Stack:** React 17 (CRA / react-scripts 5), `react-audio-player` (supports `preload` prop), plain CSS (`Theater.css`), Jest for the pure-helper tests only (Theater.js itself is untestable under jsdom — `HTMLMediaElement.play` and `can-autoplay` don't work there; do NOT import Theater.js in tests).

**Working directory:** repo root `/home/bom/BookofMormonOnline`; npm/npx commands run from `frontend/webapp/`.

**Environment (from CLAUDE.md):** dev server = systemd user unit `bom-dev`, frontend on `localhost:8200` with HMR (do NOT restart the unit; do NOT verify against bom.kckern.net — CDN-cached). Manual verification URL: `http://localhost:8200/theater` (route is `/theater/:slug*`; no slug loads the default queue). Theater requires a click/keypress before playing (autoplay gate), then plays audio — manual steps note this.

**Line numbers** below refer to the current `frontend/webapp/src/views/Theater/Theater.js` (1882 lines) and `Theater.css` (1428 lines); verify anchors by content, not number, since earlier tasks shift later lines.

---

### Task 1: CSS tweening for the text slider and progress bar (quick win)

**Files:**
- Modify: `frontend/webapp/src/views/Theater/Theater.css` (slider rule ~line 271; progress-bar rules ~lines 1027–1049)
- Modify: `frontend/webapp/src/views/Theater/Theater.js` (`ProgressBar`, ~lines 1600–1611)

The text slider moves via inline `transform: translateY(-N%)` updated every 50ms with no transition — visible stutter. The progress bar animates `width` (layout + paint per tick, no transition). Add transitions and convert the bar to compositor-friendly `scaleX`.

- [ ] **Step 1: Add the slider transition**

In `Theater.css`, replace:

```css
.theater-main-panel .theater-content-slider {
    width: 80%;
    position: absolute;
    top: 30%; 
}
```

with:

```css
.theater-main-panel .theater-content-slider {
    width: 80%;
    position: absolute;
    top: 30%;
    /* Tween between the discrete progress steps coming from JS so the
       scroll reads as continuous motion instead of 50ms jumps. */
    transition: transform 0.25s linear, opacity 0.5s linear;
    will-change: transform, opacity;
}
```

- [ ] **Step 2: Convert ProgressBar from width to scaleX**

In `Theater.js`, replace the `ProgressBar` function:

```jsx
function ProgressBar({ percent }) {
  return (
    <div className="progress-bar">
      <div
        className="progress-bar-inner"
        style={{ transform: `scaleX(${(percent || 0) / 100})` }}
      ></div>
    </div>
  );
}
```

In `Theater.css`, replace the two rules:

```css
.theater-controls .progress-bar
{
    width: 100%;
    height: 2rem;
    background-color: #333;
    cursor:pointer;
    flex-grow: 1;
    border-radius: 1ex;
    /* Clip the scaled inner bar inside the rounded corners */
    overflow: hidden;
}
.theater-controls .progress-bar-inner
{
    height: 100%;
    width: 100%;
    background-color: #6bd09866;
    pointer-events: none;
    border-right: 1px solid #6bd098;
    /* scaleX + transition = compositor-only animation (no layout/paint per
       tick), tweened between progress steps. */
    transform-origin: left center;
    transition: transform 0.25s linear;
    will-change: transform;
}
```

(The 1px `border-right` playhead gets scaled with the bar — at any visible scale it stays sub-pixel-to-1px; acceptable.)

- [ ] **Step 3: Manual verification**

Open `http://localhost:8200/theater`, press play. Expected: the scripture text scrolls smoothly (no 50ms stair-steps) and the green progress bar advances smoothly left-to-right, clipped inside its rounded container. Seek by clicking the bar — position jumps then resumes smooth motion.

- [ ] **Step 4: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Theater/Theater.css frontend/webapp/src/views/Theater/Theater.js
git commit -m "perf(theater): tween text slider and progress bar (transform + transition)

The slider jumped in discrete 50ms translateY steps with no transition,
and the progress bar animated width (layout+paint per tick). Linear
transform transitions interpolate between ticks on the compositor.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Kill the 20Hz re-render storm — progress via CSS variable + coarse state

**Files:**
- Create: `frontend/webapp/src/views/Theater/theaterUtils.js`
- Test: `frontend/webapp/src/views/Theater/__tests__/theaterUtils.test.js`
- Modify: `frontend/webapp/src/views/Theater/Theater.js` (`onListen` ~901; `TheaterControls` currentItem effect ~870; `TheaterContent` slider style ~1258; `ProgressBar` from Task 1; `TheaterCommentFeed` ~1777–1818; `TheaterImagePanel` ~1753; React import line 1)
- Modify: `frontend/webapp/src/views/Theater/Theater.css` (slider + progress-bar rules from Task 1; image container)

Design: `onListen` (50ms) keeps firing, but (a) writes a `--progress` CSS variable on `.theater-wrapper` for the two continuously-moving elements (text slider, progress bar) — zero React involvement; (b) only calls `setCurrentProgress` when the **integer percent** changes (~1 update/sec instead of 20), which is plenty for the discrete consumers (comment cursor, image index, people reveal, opacity fades — all already step functions); (c) stops reassigning `player.playbackRate` every tick (it's already set in `onCanPlay` and in every speed-change handler). The comment queue gets memoized with a one-time shuffle (it currently re-randomizes on every render).

- [ ] **Step 1: Write the failing test for the extracted comment-queue helper**

Create `frontend/webapp/src/views/Theater/__tests__/theaterUtils.test.js`:

```js
import { buildCommentQueue } from "../theaterUtils";

// Comment ids embed a 3-digit source id at string index 5..7
// e.g. "10000192001" → source 192
const com = (sourceId, preview, n = "001") => ({
  id: `10000${sourceId}${n}`,
  title: `t${sourceId}`,
  preview,
});

test("keeps normal sources, drops excluded sources and empty previews", () => {
  const coms = [
    com("099", "a normal comment"),
    com("041", "excluded source"),        // hardcoded exclusion list
    com("100", "   "),                    // empty preview
    com("101", "another normal comment"),
  ];
  const result = buildCommentQueue(coms, [], 100);
  const ids = result.map(c => c.id).sort();
  expect(ids).toEqual([com("099", "x").id, com("101", "x", "001").id].sort());
});

test("note sources pass even when blacklisted", () => {
  const coms = [com("192", "a study note")];
  const result = buildCommentQueue(coms, [192], 100);
  expect(result.length).toBe(1);
});

test("blacklisted sources are dropped", () => {
  const coms = [com("055", "blacklisted comment")];
  expect(buildCommentQueue(coms, [55], 100)).toEqual([]);
});

test("caps the queue at one comment per 5 seconds of duration", () => {
  const coms = Array.from({ length: 10 }, (_, i) =>
    com("099", `comment number ${i}`, String(i).padStart(3, "0"))
  );
  // 25 seconds → at most 5 comments
  expect(buildCommentQueue(coms, [], 25).length).toBeLessThanOrEqual(5);
});
```

- [ ] **Step 2: Run it — must fail with module not found**

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false src/views/Theater/__tests__/theaterUtils.test.js
```

Expected: FAIL — `Cannot find module '../theaterUtils'`.

- [ ] **Step 3: Create the helper (logic moved verbatim from TheaterCommentFeed)**

Create `frontend/webapp/src/views/Theater/theaterUtils.js`:

```js
// Pure helpers for the Theater view. Theater.js itself cannot be imported
// under jsdom (audio APIs), so testable logic lives here.

const NOTE_SOURCES = [192, 193];
const EXCLUDED_SOURCES = [41, 161, 162, 163, 164, 165, 166];
const SECONDS_BETWEEN_COMMENTS = 5;

// Filter an item's commentary to displayable comments, capped to the clip
// duration, in a random order. Shuffle is injected for testability.
export function buildCommentQueue(coms, blacklist, durationSeconds, random = Math.random) {
  const filtered = (coms || [])
    .filter(c => {
      const sourceId = parseInt(c.id.toString().substr(5, 3));
      if (!c.preview?.trim()) return false;
      if (NOTE_SOURCES.includes(sourceId)) return true;
      if ([...(blacklist || []), ...EXCLUDED_SOURCES].includes(sourceId)) return false;
      return true;
    })
    .sort((a, b) => a.preview.length - b.preview.length);
  const allowedMessageCount = durationSeconds / SECONDS_BETWEEN_COMMENTS;
  return filtered.slice(0, allowedMessageCount).sort(() => random() - 0.5);
}
```

- [ ] **Step 4: Run the test — must pass**

Same command as Step 2. Expected: 4 passed.

- [ ] **Step 5: Rewrite `onListen` in TheaterControls**

In `Theater.js`, replace the existing `onListen` (currently: computes progress, `setCurrentProgress(progress)`, re-sets `player.playbackRate`, 85% check):

```js
  const onListen = e => {
    const progress = (e / currentDuration) * 100;

    // Smooth movers (text slider, progress bar) read this CSS variable;
    // updating it does not re-render anything.
    document
      .querySelector(".theater-wrapper")
      ?.style.setProperty("--progress", `${progress}`);

    // Discrete consumers (comment cursor, image index, people reveal,
    // opacity fades) only need ~1% granularity. Returning the previous
    // value bails out of the re-render, cutting renders from 20/s to ~1/s.
    setCurrentProgress(prev =>
      Math.floor(prev) === Math.floor(progress) ? prev : progress
    );

    //if progress is 85% log item, but only once!
    if (progress > 85 && !currentItem?.updated) {
      currentItem.updated = true;
      updateQueueStatus();
    }
  };
```

(Note the per-tick `player.playbackRate = theaterController.playbackRate` lines are **deleted** — rate is already applied in the `[playerCanPlay, visible]` effect and in every speed-change handler.)

- [ ] **Step 6: Reset progress when the queue item changes**

In the existing `useEffect(..., [currentItem])` in `TheaterControls` (the one that sets `document.title` and pushes history), add as the first lines of the body:

```js
    setCurrentProgress(0);
    document
      .querySelector(".theater-wrapper")
      ?.style.setProperty("--progress", "0");
```

(`setCurrentProgress` is already destructured from `theaterController` in this component.)

- [ ] **Step 7: Slider and progress bar consume the CSS variable**

In `TheaterContent`, change the slider div — remove the transform from the inline style, keep opacity:

```jsx
      <div
        className={`theater-content-slider ${state}`}
        style={{ opacity }}
      >
```

(The `yPosition`/`computePosition` lines above it become unused — delete them.)

In `Theater.css`, add the transform to the Task 1 slider rule so it reads:

```css
.theater-main-panel .theater-content-slider {
    width: 80%;
    position: absolute;
    top: 30%;
    transform: translateY(calc(var(--progress, 0) * -1%));
    transition: transform 0.25s linear, opacity 0.5s linear;
    will-change: transform, opacity;
}
```

Change `ProgressBar` (from Task 1) to be prop-less and variable-driven:

```jsx
function ProgressBar() {
  return (
    <div className="progress-bar">
      <div className="progress-bar-inner"></div>
    </div>
  );
}
```

…and its call site in `TheaterProgressBar` to `<ProgressBar />`. In `Theater.css`, replace the inner-bar `transform` line (Task 1 had none — the inline style provided it) by adding to `.theater-controls .progress-bar-inner`:

```css
    transform: scaleX(calc(var(--progress, 0) / 100));
```

- [ ] **Step 8: Memoize the comment queue with a one-time shuffle**

In `Theater.js` line 1: add `useMemo` to the React import:

```js
import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
```

Add the import near the other local imports:

```js
import { buildCommentQueue } from "./theaterUtils";
```

In `TheaterCommentFeed`, delete the inline `filteredcoms` filter/sort block, the `allowedMessageCount` line, and the `queuedMessages` line, replacing them with:

```js
  // Build (and shuffle) the queue once per item — previously this re-ran
  // and re-randomized on every render, 20×/sec during playback.
  const queuedMessages = useMemo(
    () => buildCommentQueue(coms, blacklist.map(Number), currentDuration),
    [currentItem, currentDuration]
  );
```

(Leave `secondsBetweenComments`, `division`, and `commentCursor` lines as they are — `secondsBetweenComments` is still used by nothing else after this change, so delete its declaration too; `division` keeps using `queuedMessages.length`.)

- [ ] **Step 9: Smooth the art panel zoom**

In `TheaterImagePanel`, key the container so image changes remount (no tween across image swaps), while within-image zoom tweens:

```jsx
  const imgEl = image ? (
    <div className="img-element-container"
    key={`${cursorIndex}-${imageIndex}`}
    style={{
      transform: `scale(${scale}) `,
      opacity
    }}>
```

In `Theater.css`, add:

```css
.theater-image-container .img-element-container {
    transition: transform 1.2s linear, opacity 0.5s linear;
    will-change: transform, opacity;
}
```

- [ ] **Step 10: Run the full test suite**

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false
```

Expected: all suites pass (utils suites + Read + the new theaterUtils).

- [ ] **Step 11: Manual verification**

On `http://localhost:8200/theater`: play an item. Expected: text scroll and progress bar still smooth (now variable-driven); commentary appears progressively on the right; art panel slowly zooms, switching images cleanly; people panel reveals entries over time; pausing freezes motion. Open React DevTools Profiler (or watch the console) — re-renders during playback should be ~1/sec, not 20/sec. Skip to the next item with ▶ — text starts from the top (progress reset).

- [ ] **Step 12: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Theater/theaterUtils.js \
        frontend/webapp/src/views/Theater/__tests__/theaterUtils.test.js \
        frontend/webapp/src/views/Theater/Theater.js \
        frontend/webapp/src/views/Theater/Theater.css
git commit -m "perf(theater): drive progress via CSS variable, cut re-renders 20x

onListen now writes --progress on the wrapper for the smooth movers
(slider, progress bar) and only commits React state on integer-percent
changes (~1/s). Drops the per-tick playbackRate write, memoizes the
comment queue with a one-time shuffle (was re-randomized every render),
and tweens the art-panel zoom.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Defer the play-start API burst

**Files:**
- Modify: `frontend/webapp/src/views/Theater/Theater.js` (`TheaterControls`: refs near `playerCanPlay` state ~865; `onPlay` ~989; the `[currentItem]` effect ~870)

`onPlay` currently fires `logItem()` — three sequential uncached API calls plus an App-level state update — at the exact moment audio starts buffering, and again on **every** resume. Defer it 4s and run it once per item.

- [ ] **Step 1: Add refs in TheaterControls**

After `const [playerCanPlay, setPlayerCanPlay] = useState(false);` add:

```js
  const logTimerRef = useRef(null);
  const loggedSlugsRef = useRef(new Set());
```

- [ ] **Step 2: Rewrite onPlay**

Replace the `onPlay` prop of the `ReactAudioPlayer`:

```jsx
        onPlay={() => {
          theaterController.setIsPlaying(true);
          theaterController.setIsScrollingPanel(true);
          // Defer the log/status/progress API burst out of the playback-
          // start window (it competed with audio buffering), and only log
          // once per item (onPlay also fires on every pause→resume).
          const slug = currentItem?.slug;
          if (slug && !loggedSlugsRef.current.has(slug)) {
            loggedSlugsRef.current.add(slug);
            logTimerRef.current = setTimeout(logItem, 4000);
          }
        }}
```

- [ ] **Step 3: Clear the pending timer when the item changes/unmounts**

In the `useEffect(..., [currentItem])` in `TheaterControls`, add a cleanup return at the end of the effect body:

```js
    return () => {
      if (logTimerRef.current) {
        clearTimeout(logTimerRef.current);
        logTimerRef.current = null;
      }
    };
```

(If the user skips an item within 4s, its log is intentionally dropped — they didn't engage with it; the 85% `updateQueueStatus` path still records real listens.)

- [ ] **Step 4: Manual verification**

On `http://localhost:8200/theater` with devtools Network open: press play. Expected: the `graphql` calls for `log`/`queuestatus`/`userprogress` appear ~4s **after** audio starts, not at t=0. Pause and resume — no repeat burst. Let an item finish and the next start — exactly one deferred burst per item.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Theater/Theater.js
git commit -m "perf(theater): defer play-start logging out of the buffering window

logItem (3 sequential uncached API calls + app-level state update) fired
inside onPlay at t=0 and again on every resume. Now scheduled 4s in,
once per item, cancelled if the user skips first.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Stagger startup audio/media loading

**Files:**
- Modify: `frontend/webapp/src/views/Theater/Theater.js` (`TheaterQueueIntro` SFX ~501; `TheatherMusicPlayer` ~1040 and player B props ~1114; `TheaterImagePanel` preload effect ~1726)

- [x] **Step 1: Fix the per-render `new Audio` construction (the literal "memory storm")** — ALREADY APPLIED ahead of plan execution in commit `a84eb915`; verify it is present and skip to Step 2.

In `TheaterQueueIntro`, the current code constructs a fetching `Audio` object on **every render** — and this component re-renders every second from its countdown:

```js
  const [initSFX] = useState(
    new Audio(`${assetUrl}/interface/audio/theater`)
);
```

Replace with the lazy initializer form (argument evaluated once):

```js
  const [initSFX] = useState(
    () => new Audio(`${assetUrl}/interface/audio/theater`)
  );
```

- [ ] **Step 2: Music player B loads lazily**

In `TheatherMusicPlayer`, add `preload="none"` to **player B only**:

```jsx
    <ReactAudioPlayer
      id="theater-music-player-b"
      src={`${assetUrl}/audio/music/${trackB}`}
      volume={playbackMusicVolume}
      muted={isMuted}
      preload="none"
      onCanPlay={...}
    />
```

Then in the `nextSectionIsNew` effect (the one that preloads the quiet side), kick the fetch only when a crossfade is genuinely upcoming — replace the effect body with:

```js
  useEffect(()=>{
    if(!nextSectionIsNew) return;
    const newTrack = makeSelection(nextSection);
    if(activeSide==="a"){
      document.getElementById(`theater-music-player-b`).volume = 0;
      setTrackB(newTrack);
      // preload="none" defers the fetch; start it now that a crossfade
      // is actually coming up (src updates on the next render).
      setTimeout(() => document.getElementById(`theater-music-player-b`)?.load(), 0);
    }else{
      document.getElementById(`theater-music-player-a`).volume = 0;
      setTrackA(newTrack);
    }

  },[nextSection])
```

(Player A keeps default preload — it genuinely plays at start.)

- [ ] **Step 3: Delay the art preload loop**

In `TheaterImagePanel`, replace the preload effect:

```js
  useEffect(() => {
    // Preload upcoming art a few seconds in, after the narration stream
    // has had the network to itself.
    const t = setTimeout(() => {
      images.forEach(img => {
        const image = new Image();
        image.src = `${assetUrl}/art/${img.id}`;
      });
    }, 4000);
    return () => clearTimeout(t);
  }, [currentItem?.imgs]);
```

- [ ] **Step 4: Manual verification**

Hard-reload `http://localhost:8200/theater` with the Network panel open and "Disable cache" on. Expected at t=0 after pressing play: ONE music stream (player A) + the narration stream; player B's track does NOT fetch until a section boundary approaches; art images fetch ~4s in; only one `interface/audio/theater` SFX request total (previously it could re-request per intro re-render).

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Theater/Theater.js
git commit -m "perf(theater): stagger startup media loading

useState(new Audio(...)) constructed a fetching Audio object on every
intro render (1/sec from the countdown) — lazy initializer fixes it.
Music player B now preload=none with an explicit load() kick when a
crossfade approaches; art preloads deferred 4s so the narration stream
gets the network at startup.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Clean up leaked timers and intervals

**Files:**
- Modify: `frontend/webapp/src/views/Theater/Theater.js` (outro fade ~257; `TheaterQueueIntro` ~510; `TheaterSectionIntro` ~601; `ButtonTimer` ~634; `crossfade` ~1069)

Every block below currently leaks its timer past unmount (setState-after-unmount + background CPU in long sessions).

- [ ] **Step 1: Outro fade interval** — replace the `isOutroActive` effect:

```js
  useEffect(() => {
    if (!isOutroActive) return;
    const playerA = document.getElementById("theater-music-player-a");
    const playerB = document.getElementById("theater-music-player-b");
    const player = playerA?.volume > 0 ? playerA : playerB;
    if (!player || player.volume <= 0) return;
    const fadeOutInterval = setInterval(() => {
      player.volume = Math.max(0, player.volume - 0.05);
      if (player.volume <= 0) {
        player.pause();
        clearInterval(fadeOutInterval);
      }
    }, 200);
    return () => clearInterval(fadeOutInterval);
  }, [isOutroActive]);
```

(Also fixes the latent `player.volume -= 0.05` underflow — media volume below 0 throws.)

- [ ] **Step 2: TheaterQueueIntro staged timeouts** — in its mount effect, capture and clear all timers:

```js
  useEffect(() => {
    if(!cursorIndex) playSound(initSFX);
    const t1 = setTimeout(()=>setPart(1),200);
    const t2 = setTimeout(()=>setPart(2),6000);
    const t3 = setTimeout(()=>setPart(3),12000);
    const timer = setInterval(() => {
      setCountdown(previousCountdown => {
        if (previousCountdown === 1) {
          theaterController.setSubCursorIndex(0);
          theaterController.setIsScrollingPanel(true);
          clearInterval(timer);
        } else {
          return previousCountdown - 1;
        }
      });
    }, 1000);
    return () => {
      [t1, t2, t3].forEach(clearTimeout);
      clearInterval(timer);
      initSFX.pause();
    };
  }, []);
```

- [ ] **Step 3: TheaterSectionIntro countdown** — replace its second effect (the one with the 10s timeout and 200ms interval, which currently has NO cleanup):

```js
  useEffect(() => {
    const advance = setTimeout(() => {
      theaterController.setSubCursorIndex(0);
    }, secondsToShow * 1000);

    const timer = setInterval(() => {
      const now = Date.now();
      const timeLeft = now - startTimestamp;
      setCountdown(parseInt((secondsToShow * 1000 - timeLeft) / 1000));
    }, 200);

    return () => {
      clearTimeout(advance);
      clearInterval(timer);
    };
  }, []);
```

- [ ] **Step 4: ButtonTimer hide timeout** — replace its effect:

```js
  useEffect(() => {
    if (timerprogress !== null) return;
    const t = setTimeout(() => setIsHidden(true), 2500);
    return () => clearTimeout(t);
  }, [timerprogress]);
```

- [ ] **Step 5: crossfade interval** — in `TheatherMusicPlayer`, add a ref and route the interval through it. After the `const [trackB, setTrackB] = ...` line add:

```js
  const fadeIntervalRef = useRef(null);
```

(add `useRef` usage — it is already imported at the top of the file). In `crossfade()`, replace `const fadeOut = setInterval(...)` wiring:

```js
  const crossfade = () => {
		if(isMuted) return;
    const playerToFadeIn = document.getElementById(`theater-music-player-${activeSide}`);
    playAudioElement(`theater-music-player-${activeSide}`);
    const playerToFadeOut = document.getElementById(`theater-music-player-${activeSide==="a" ? "b" : "a"}`);
    const targetVolume = Math.max(playerToFadeIn.volume,playerToFadeOut.volume);
    const fadeDuration = 3;
    const fadeInterval = 50;
    const fadeSteps = fadeDuration*1000/fadeInterval;
    let fadeStep = 0;
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    fadeIntervalRef.current = setInterval(()=>{
      fadeStep++;
      const fadeInVolume = fadeStep/fadeSteps*targetVolume;
      const fadeOutVolume = targetVolume - fadeInVolume;
      playerToFadeIn.volume = fadeInVolume;
      playerToFadeOut.volume = fadeOutVolume;
      if(fadeStep>=fadeSteps){
        playerToFadeOut.pause();
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    },fadeInterval);
  }
```

And add an unmount cleanup effect right after the `crossfade` definition:

```js
  useEffect(() => () => {
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
  }, []);
```

- [ ] **Step 6: Run tests + manual spot-check**

`CI=true npx react-scripts test --watchAll=false` (all pass — these components aren't unit-tested; suite guards against import-time breakage elsewhere). Manually: play through a section boundary (crossfade still works), let the intro countdown finish, skip mid-intro (no console "setState on unmounted component" warnings).

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Theater/Theater.js
git commit -m "fix(theater): clear leaked timers/intervals on unmount

Section-intro countdown interval, queue-intro staged timeouts, outro and
crossfade fade intervals, and ButtonTimer's hide timeout all leaked past
unmount, accumulating background work over long sessions.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Fix the four concrete bugs

**Files:**
- Modify: `frontend/webapp/src/views/Theater/Theater.js` (music `onCanPlay` handlers ~1106/1119; history.push ~876; `cycleVolume` ~172; `PlaybackSettings.handleInput` ~1527)

- [ ] **Step 1: Correct both music players' `onCanPlay` handlers**

Both handlers currently check and play **player A** with inverted paused/active logic. Replace player A's:

```jsx
      onCanPlay={()=>{
        // If this side became ready while it is the active side and isn't
        // playing yet, start it.
        const player = document.getElementById("theater-music-player-a");
        if (!player || activeSide !== "a") return;
        if (player.paused) playAudioElement("theater-music-player-a");
      }}
```

and player B's:

```jsx
      onCanPlay={()=>{
        const player = document.getElementById("theater-music-player-b");
        if (!player || activeSide !== "b") return;
        if (player.paused) playAudioElement("theater-music-player-b");
      }}
```

(`activeSide` is component state in scope of both.)

- [ ] **Step 2: Queue advances replace history instead of pushing**

In the `TheaterControls` `[currentItem]` effect, change:

```js
    history.push(`/theater/${slug}`);
```

to:

```js
    // Queue advancement is not user navigation — don't grow history;
    // Back should leave the theater, not replay every passage.
    history.replace(`/theater/${slug}`);
```

- [ ] **Step 3: Delete dead `cycleVolume`**

`controls.cycleVolume` (the strict-equality volume ladder) has **zero call sites** in the codebase (`grep -rn "cycleVolume" frontend/webapp/src` → only its definition). Delete the whole `cycleVolume: () => { ... },` entry from `controls`. (Volume is controlled via the PlaybackSettings slider.)

- [ ] **Step 4: Music-volume slider — fix the player-B copy-paste**

In `PlaybackSettings.handleInput`, `musicVolumeInput` branch, replace the two duplicate player-a lines:

```js
          document.getElementById("theater-music-player-a").volume =musicVolume;
          document.getElementById("theater-music-player-a").volume =musicVolume;
```

with:

```js
          // Music plays at 1/20th of the displayed percentage so it sits
          // under the narration; apply to whichever side is audible.
          if (document.getElementById("theater-music-player-a")) document.getElementById("theater-music-player-a").volume = musicVolume;
          if (document.getElementById("theater-music-player-b")) document.getElementById("theater-music-player-b").volume = musicVolume;
```

Also remove the `console.log('musicVolume',musicVolume);` line while there. (Leave the /20 scale as-is — changing it would re-loudness existing users' stored settings; the comment documents it.)

- [ ] **Step 5: Manual verification**

On `http://localhost:8200/theater`: (a) play across a section boundary — background music crossfades and the incoming side actually starts; (b) advance several items, then press the browser Back button once — you leave the theater (not step back through passages); (c) open settings (gear), drag the music volume slider during playback — audible change.

- [ ] **Step 6: Run tests, commit**

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Theater/Theater.js
git commit -m "fix(theater): music onCanPlay copy-paste, history spam, volume slider

Player B's onCanPlay checked and played player A with inverted logic;
queue advances pushed history entries (Back replayed every passage);
the music-volume slider set player A twice and player B never; dead
cycleVolume control removed (no call sites).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Hygiene pass (small, mechanical)

**Files:**
- Modify: `frontend/webapp/src/views/Theater/Theater.js`

- [ ] **Step 1: Fix the two `useEffect(async () => ...)` antipatterns**

Queue load (TheaterWrapper, ~line 220) — wrap the body:

```js
  useEffect(() => {
    const loadQueue = async () => {
      let items = slug ? [{slug}] : null;

      if(slugIsRef) items = [{reference:slug}];
      const [plan,segment] = slug?.split("/") || [];
      if(plan==="plan" && segment) items = [{plan:segment}];
      const token = localStorage.getItem("token");
      let { queue:loadedQueue } = await BoMOnlineAPI(
        { queue: { token, items } },
        { useCache: false }
      );
      if(!loadedQueue || !loadedQueue?.length || !loadedQueue?.[0]) return setLoadFailed(true);
      loadedQueue = loadedQueue.map(item => {
        if(!item?.coms) return item;
        item.coms = [...(item?.coms || [])].sort(() => Math.random() - 0.5);
        return item;
      });
      setQueue(loadedQueue);
      setQueueStatus((loadedQueue||[]).map(item => item?.status));
    };
    loadQueue();
  }, []);
```

(Note: `.sort` now operates on a copy — fixes the in-place mutation of fetched items.)

Comment feed (TheaterCommentFeed, ~line 1808) — same pattern, with timer cleanup:

```js
  useEffect(() => {
    if(!isPlaying) return;
    const t = setTimeout(() => {
      if (!queuedMessages.length) return;
      if (!queuedMessages[commentCursor]) return;
      const onDeckComment = queuedMessages.filter((_,index)=>index <= commentCursor);
      setComments(prev=>new Set([...prev, ...onDeckComment]));
    }, 1000 + Math.random() * 2000);
    return () => clearTimeout(t);
  }, [commentCursor,isPlaying]);
```

- [ ] **Step 2: Stop mutating state in the keyboard effect**

In the keyboard effect (~line 326), replace:

```js
    if (!["completed", "started"].includes(queueStatus[cursorIndex])) {
      queueStatus[cursorIndex] = "prestarted";
      setQueueStatus([...queueStatus]);
    }
```

with:

```js
    if (!["completed", "started"].includes(queueStatus[cursorIndex])) {
      setQueueStatus(prev => {
        const next = [...prev];
        next[cursorIndex] = "prestarted";
        return next;
      });
    }
```

- [ ] **Step 3: Delete dead code**

- `volA`, `volB`, `timeA`, `timeB` consts in `TheatherMusicPlayer` (~1094–1097) — unused, DOM reads in render.
- `firstIncompleteItem` in the `[queue]` effect (~248–250) — computed, never used (keep the `goto(0,"auto")` call and the TODO comment).
- `computePosition` and `yPosition` in `TheaterContent` — already removed in Task 2 Step 7; if any remnant remains, delete.
- In `seekTo` (~1475), delete the unused `const barElement = document.querySelector(".theater-progress-bar");` line.

- [ ] **Step 4: Stable comment keys**

In `CommentFeed`, change `key={index}` to `key={com.id}`.

- [ ] **Step 5: Run tests + quick manual sanity check, commit**

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false
```

Manual: theater loads, plays, comments appear. Then:

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Theater/Theater.js
git commit -m "chore(theater): hygiene — async effects, state mutations, dead code

Wraps async useEffect bodies (cleanups now run), removes in-place state
mutations, deletes unused vars/dead reads, stable comment keys.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Deliberately deferred (tracked in the audit, not this plan)

Keyboard UX changes (Tab/Space hijacks — behavior decisions needing product input), seek-bar ARIA/keyboard support, `canplaythrough` gating of first play (latency tradeoff to discuss), the audit's 3.5 setter-misuse cleanup in `incrementPlaybackSpeed`/`PlaybackSettings.handleInput` (compute-then-set refactor; `cycleVolume`, the worst case, is deleted in Task 6), and any restructuring of the 1882-line Theater.js into modules. The audit's Part 4 list is the backlog.
