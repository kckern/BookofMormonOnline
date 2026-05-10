# Audio Read — synchronized audio playback in the Read view

**Status:** Abandoned spike, preserved for revival.
**Source:** `origin/AudioRead` branch, single commit `d9a430c "Audio Read Tmp"` (2024-09-03).
**Branch deletion plan:** Branch will be removed; this spec is the canonical record. The commit can still be retrieved from local reflog or by re-pushing if needed before deletion.

## Concept

Add a per-verse audio player to the scripture Read view. When a verse is highlighted (clicked), the player loads `<assetUrl>/audio/verses/en-legacy/<verse_id>.mp3` and plays it. As audio plays, the spoken word is highlighted in the verse text in real time. When the verse audio ends, the next verse becomes the highlighted one and its audio auto-plays — producing a continuous read-along experience.

## Why it matters

- Accessibility: visually-impaired readers, low-literacy readers, language learners.
- Engagement: synchronized text + audio is a known retention mechanic for scripture study.
- Differentiator: no other BoM tool currently does verse-by-verse synchronized highlighting.

## What was built (in the abandoned commit)

- New `<ReadAudioPlayer />` sub-component using `react-audio-player`.
- `showAudioPlayer` state on `ReadScripture`, toggled by an "Audio" button in the chapter nav.
- A `readController` object passed to the player, exposing `setHighlightedVerse`, `setShowAudioPlayer`, current `highlightedVerse`, full chapter `verseIds`, and `activeText`.
- Word-by-word highlighting via a heuristic: `secondsPerWord = (audioDuration / wordCount) / 2`, then advance current word index based on player's `onListen` callback every 50 ms. Note: this is a coarse approximation that drifts on punctuation-heavy verses.
- `onEnded` handler advances `highlightedVerse` to the next verse in the chapter.
- Asset URL pattern: `https://media.bookofmormon.online/audio/verses/en-legacy/<verse_id>.mp3` (the `en-legacy` namespace exists; other languages would need parallel asset trees).

## Why it didn't ship

- Title was "Audio Read Tmp" — author flagged it as a spike.
- Built against the *pre-refactor* Read.js (the simple version that has since been replaced twice — by the prod-side concurrency refactor, then re-restored on dev as `a0241c7` 2026-05-08). Cannot merge cleanly.
- Word-timing heuristic is too inaccurate for a production read-along; needed real per-word timestamps from the audio source (e.g. forced alignment / Whisper word-level output) to be production-ready.

## How to pick this up later

1. **Don't merge the branch.** Rebuild on top of current `dev`'s `Read.js` (which uses `useConcurrentOperations` + `ChapterContent` per-section rendering).
2. **Player placement:** the cleanest hook is in `ChapterContent.js`'s section render — pass an `audioController` prop down alongside the existing `passageNotesData` prop, and let the new `<AudioPlayer />` live inside each section header or as a fixed footer element on the chapter container.
3. **Timing accuracy:** the spike's per-word timer is the weakest piece. Two upgrade paths:
   - **Server-side:** generate a `.json` sidecar per verse with `[{word, start, end}, …]` from forced alignment (Whisper / Aeneas / Gentle). Asset path: `<assetUrl>/audio/verses/<lang>/<verse_id>.json`. Player consumes this directly.
   - **Client-side:** ship without per-word highlighting; just highlight the active *verse* and rely on the user's reading speed. Lower-fidelity but ships sooner.
4. **Multi-language:** the `en-legacy` URL prefix bakes in a single language. Replace with `${lang}/${verse_id}.mp3` keyed off `determineLanguage()`. Verify which languages have audio assets before listing them in UI.
5. **Auto-advance UX:** the spike auto-advances on `onEnded`. Consider a "play next verse" toggle in the player so users who want to pause/think mid-chapter aren't yanked along.
6. **Mobile:** test that auto-play works under iOS Safari's autoplay restrictions (will likely require a user gesture for the *first* verse, then permission carries forward).

## Out of scope (for the first revival)

- Background play / lock-screen controls (Media Session API). Worth doing eventually.
- Speed controls. The Theater view already has playback-rate UI patterns to copy from.
- Speaker selection (different voice actors). Asset tree would need restructuring.

## Appendix: Original `<ReadAudioPlayer />` component (verbatim, from `d9a430c`)

The whole-file diff is in the abandoned commit; this is the unique component that has no analog elsewhere in the codebase. Captured here so it survives branch deletion.

```jsx
import ReactAudioPlayer from "react-audio-player";

function ReadAudioPlayer({ readController }) {
    const { highlightedVerse, fullVerseIds, activeText } = readController.states;
    const { setShowAudioPlayer, setHighlightedVerse } = readController.functions;

    const [audioDuration, setAudioDuration] = useState(0);
    const [timecode, setTimecode] = useState(0);

    const handleXClick = () => setShowAudioPlayer(false);

    const audioUrl = highlightedVerse
        ? assetUrl + "/audio/verses/en-legacy/" + highlightedVerse + ".mp3"
        : null;

    const handleAudioEnd = () => {
        const verseIndex = fullVerseIds.indexOf(highlightedVerse);
        const nextVerse = fullVerseIds[verseIndex + 1] || null;
        if (nextVerse) setHighlightedVerse(nextVerse);
        else setShowAudioPlayer(false);
    };

    // Word-level highlighting heuristic — split text on non-letters, count letter-only
    // tokens for word count, then advance current word by elapsed time. Coarse and
    // drifts on punctuation; replace with forced-alignment timestamps for production.
    const textArray = activeText
        .map(line => line.text.split(/([^A-z]+)/g))
        .flat()
        .filter(Boolean);
    const wordCount = textArray.filter(i => /^[A-z]+$/.test(i)).length;
    const secondsPerWord = (audioDuration / wordCount) / 2;
    let currentWordIndex = Math.floor((timecode / secondsPerWord) || 0) || 0;
    currentWordIndex = currentWordIndex % 2 !== 0 ? currentWordIndex - 1 : currentWordIndex;

    return (
        <div className={`readAudioPlayerContainer ${readController.states.showAudioPlayer ? "show" : ""}`}>
            <div className="readAudioPlayer">
                <button onClick={handleXClick} className="close">X</button>
                <p>
                    {textArray.map((word, index) => (
                        <span key={index} className={index === currentWordIndex ? "current" : ""}>
                            {word}
                        </span>
                    ))}
                </p>
                <ReactAudioPlayer
                    src={audioUrl}
                    autoPlay
                    controls
                    onEnded={handleAudioEnd}
                    listenInterval={50}
                    onListen={(e) => setTimecode(e)}
                    onCanPlay={(e) => setAudioDuration(e.target.duration)}
                />
            </div>
        </div>
    );
}
```

The `readController` prop is a `{ states, functions }` bundle assembled in `ReadScripture` (now obsolete after the dev refactor) — when reviving, replace it with direct props or a context. The asset URL pattern (`/audio/verses/en-legacy/<verse_id>.mp3`) and the auto-advance behavior are the only parts worth preserving verbatim.
