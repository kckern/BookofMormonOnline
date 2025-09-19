
import { useRouteMatch, Link, useHistory } from "react-router-dom";
import "./Read.scss";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import BoMOnlineAPI from "../../models/BoMOnlineAPI";
import { label } from "../../models/Utils";

// Utilities & components
import { 
    slugify, 
    verseIdToSlug, 
    memoizedLookupReference, 
    memoizedGenerateReference,
    getPrevNextChapter, 
    initializeChapterData 
} from "../../utils/scriptureUtils";
import { useConcurrentOperations, useThrottle } from "../../hooks/useConcurrentOperations";
import { ChapterNav } from "./components/ChapterNav";
import { SkeletonLoader } from "./components/SkeletonLoader";
import { ChapterContent } from "./components/ChapterContent";

const DEBUG_SKELETON = false;

export default function ReadScripture({ appController }) {
    const match = useRouteMatch();
    const history = useHistory();

    // Concurrency hook
    const { 
        executeOperation, 
        isOperationRunning, 
        abortAllOperations 
    } = useConcurrentOperations();

    // ---------------------------------------------------------
    // Initialize chapter data from route
    // ---------------------------------------------------------
    const {
        initChapterRef,
        initHighlightedVerses,
        initNextChapter,
        initPrevChapter,
        initChapterVerseIds
    } = useMemo(() => initializeChapterData(match), [match.params]);

    // ---------------------------------------------------------
    // Manage state
    // ---------------------------------------------------------
    const [content, setContent] = useState(null);               // The content of the main/current chapter
    const [allChapters, setAllChapters] = useState([]);         // Additional chapters loaded by infinite scroll
    const [chapterRef, setChapterRef] = useState(initChapterRef);
    const [activeChapterRef, setActiveChapterRef] = useState(initChapterRef);
    const [highlightedVerses, setHighlightedVerses] = useState(initHighlightedVerses);
    const [hoveredVerse, setHoveredVerse] = useState(null);
    const [nextChapterRef, setNextChapterRef] = useState(initNextChapter);
    const [prevChapterRef, setPrevChapterRef] = useState(initPrevChapter);
    const [chapterVerseIds, setChapterVerseIds] = useState(initChapterVerseIds);

    const [initialLoad, setInitialLoad] = useState(true);       // Whether we’re on the initial load

    // Refs
    const verseRefs = useRef(new Map()); // to store verse element refs (verseId -> DOM element)
    const scrollTimeoutRef = useRef(null);
    const hasUserScrolled = useRef(false); // Track if user has scrolled
    const lastLoadedChapterCount = useRef(0); // Track number of loaded chapters
    const lastScrollY = useRef(0); // Track last scroll position
    const nextChapterPreloaded = useRef(false); // Track if next chapter is already preloaded
    const lastContentLoadTime = useRef(0); // Track when content was last loaded

    // ---------------------------------------------------------
    // Navigate to next/previous chapters
    // ---------------------------------------------------------
    const goToNextChapter = useCallback(() => {
        const nextSlug = slugify(nextChapterRef);
        if (nextSlug) {
            history.push(`/read/${nextSlug}`);
        }
    }, [nextChapterRef, history]);

    const goToPreviousChapter = useCallback(() => {
        const prevSlug = slugify(prevChapterRef);
        if (prevSlug) {
            history.push(`/read/${prevSlug}`);
        }
    }, [prevChapterRef, history]);

    // ---------------------------------------------------------
    // Load the next chapter: can be called automatically or manually
    // ---------------------------------------------------------
    const loadNextChapter = useCallback(async (isManualOverride = false) => {
        // If already loading, skip (unless user forcibly overrides)
        if (isOperationRunning("loadNext") && !isManualOverride) {
            return;
        }
        if (!nextChapterRef) return;

        // Prevent automatic loading if we're not near the bottom and it's not manual
        if (!isManualOverride) {
            const { scrollHeight, scrollTop, clientHeight } = document.documentElement;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const scrollProgress = scrollTop / (scrollHeight - clientHeight);
            const timeSinceLastLoad = Date.now() - lastContentLoadTime.current;
            
            // Only auto-load if user has scrolled significantly, is near bottom, 
            // and enough time has passed since last load
            if (distanceFromBottom > 200 && scrollProgress < 0.7) {
                return;
            }
            
            // Prevent rapid successive loads
            if (timeSinceLastLoad < 1000) {
                return;
            }
        }

        // Execute next-chapter load
        await executeOperation(
            "loadNext",
            async (signal) => {
                // Load next-chapter data from the API
                const data = await BoMOnlineAPI({ read: nextChapterRef }, { signal });
                if (signal.aborted) return null;

                const mainKey = Object.keys(data.read)[0];
                const nextChapterData = data.read[mainKey];
                if (!nextChapterData) return null;

                const nextChapterVerses = memoizedLookupReference(nextChapterRef).verse_ids;
                // Add it to the ability to render multiple chapters
                setAllChapters((prev) => {
                    const newChapters = [
                        ...prev,
                        {
                            ref: nextChapterRef,
                            data: nextChapterData,
                            verseIds: nextChapterVerses,
                        },
                    ];
                    // Update our tracking of loaded chapters
                    lastLoadedChapterCount.current = newChapters.length + 1; // +1 for main content
                    lastContentLoadTime.current = Date.now(); // Track when content was loaded
                    return newChapters;
                });

                // Update nextChapterRef so user can keep loading further
                const { nextChapter } = getPrevNextChapter(nextChapterVerses);
                setNextChapterRef(nextChapter || null);

                return nextChapterData;
            },
            { allowMultiple: false }
        );
    }, [nextChapterRef, isOperationRunning, executeOperation]);

    // ---------------------------------------------------------
    // Called when the user explicitly navigates to a new chapter
    // Clears everything and sets up for new content
    // ---------------------------------------------------------
    const handleExplicitChapterNavigation = useCallback(() => {
        abortAllOperations();
        setContent(null);
        setAllChapters([]);
        setHighlightedVerses(null);
        hasUserScrolled.current = false; // Reset scroll tracking
        lastLoadedChapterCount.current = 0; // Reset chapter count
        lastScrollY.current = 0; // Reset scroll position
        nextChapterPreloaded.current = false; // Reset preload flag
        lastContentLoadTime.current = 0; // Reset load time tracking
        window.scrollTo(0, 0);
    }, [abortAllOperations]);

    // ---------------------------------------------------------
    // Monitor changes to route, update references accordingly
    // ---------------------------------------------------------
    useEffect(() => {
        const {
            initChapterRef: newRef,
            initHighlightedVerses: newHighlited,
            initNextChapter: newNext,
            initPrevChapter: newPrev,
            initChapterVerseIds: newVerseIds
        } = initializeChapterData(match);

        setChapterRef(newRef);
        setActiveChapterRef(newRef);
        setHighlightedVerses(newHighlited);
        setNextChapterRef(newNext);
        setPrevChapterRef(newPrev);
        setChapterVerseIds(newVerseIds);
        setInitialLoad(true); // Force reload if route changes
        hasUserScrolled.current = false; // Reset scroll tracking for new route
        lastLoadedChapterCount.current = 0; // Reset chapter count
        lastScrollY.current = 0; // Reset scroll position
        nextChapterPreloaded.current = false; // Reset preload flag
        lastContentLoadTime.current = 0; // Reset load time tracking
    }, [match.params]);

    // ---------------------------------------------------------
    // Keyboard navigation for next/previous chapter, verse jumps
    // ---------------------------------------------------------
    const findAdjacentVerse = useCallback((direction) => {
        if (!chapterVerseIds?.length) return null;

        if (!highlightedVerses?.length) {
            return chapterVerseIds[0];
        }

        const maxHighlighted = Math.max(...highlightedVerses);
        const currentIndex = chapterVerseIds.indexOf(maxHighlighted);
        if (currentIndex === -1) return chapterVerseIds[0];

        const nextIndex = currentIndex + direction;
        if (nextIndex >= 0 && nextIndex < chapterVerseIds.length) {
            return chapterVerseIds[nextIndex];
        }
        return maxHighlighted;
    }, [chapterVerseIds, highlightedVerses]);

    const navigateToVerse = useCallback((verseId) => {
        if (!verseId) return;
        const verseElement = verseRefs.current.get(verseId);
        if (verseElement) {
            verseElement.scrollIntoView({ behavior: "smooth", block: "center" });
            history.push(`/read/${verseIdToSlug([verseId])}`);
        }
    }, [history]);

    const handleKeyDown = useCallback((e) => {
        if (
            e.target.tagName === "INPUT" ||
            e.target.tagName === "TEXTAREA" ||
            e.target.isContentEditable
        ) {
            return;
        }
        switch (e.key) {
            case "ArrowRight":
                goToNextChapter();
                break;
            case "ArrowLeft":
                goToPreviousChapter();
                break;
            case "ArrowDown":
            case "Tab": {
                e.preventDefault();
                const nextVerse = findAdjacentVerse(1);
                navigateToVerse(nextVerse);
                break;
            }
            case "ArrowUp": {
                e.preventDefault();
                const prevVerse = findAdjacentVerse(-1);
                navigateToVerse(prevVerse);
                break;
            }
            case "Escape": {
                const slug = slugify(activeChapterRef);
                history.push(`/read/${slug}`);
                break;
            }
            default:
                break;
        }
    }, [
        goToNextChapter,
        goToPreviousChapter,
        findAdjacentVerse,
        navigateToVerse,
        activeChapterRef,
        history,
    ]);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    // ---------------------------------------------------------
    // Scroll handler for near-bottom detection
    // ---------------------------------------------------------
    const throttledScrollHandler = useThrottle(() => {
        const currentScrollY = window.scrollY;
        
        // Only mark as scrolled if user actually scrolled down (not just programmatic scroll)
        if (currentScrollY > lastScrollY.current + 10) {
            hasUserScrolled.current = true;
        }
        lastScrollY.current = currentScrollY;
        
        if (!isOperationRunning("loadNext")) {
            const { scrollHeight, scrollTop, clientHeight } = document.documentElement;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const scrollProgress = scrollTop / (scrollHeight - clientHeight);
            
            // Only load when truly near bottom (within 50px) and significant scroll progress
            if (distanceFromBottom < 50 && scrollProgress > 0.8) {
                loadNextChapter(false);
            }
        }
    }, 200);

    useEffect(() => {
        window.addEventListener("scroll", throttledScrollHandler, { passive: true });
        return () => {
            window.removeEventListener("scroll", throttledScrollHandler);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [throttledScrollHandler, loadNextChapter]);

    // ---------------------------------------------------------
    // Load the initial content
    // ---------------------------------------------------------
    useEffect(() => {
        if (!initialLoad) return;
        if (!chapterRef) return;

        setContent(null);
        setAllChapters([]);
        document.title = chapterRef;

        // Load the chapter content
        executeOperation(
            "loadContent",
            async (signal) => {
                const data = await BoMOnlineAPI({ read: chapterRef }, { signal });
                if (signal.aborted) return null;

                const mainKey = Object.keys(data.read)[0];
                const chapterData = data.read[mainKey];
                if (chapterData) {
                    setContent(chapterData);
                    setInitialLoad(false);
                    lastContentLoadTime.current = Date.now(); // Track when initial content was loaded
                    localStorage.setItem("chapterRef", chapterRef);
                    
                    // Ensure browser URL is correct
                    const currentSlug = window.location.pathname.replace(/^\/read\//, "");
                    const expectedSlug = slugify(chapterRef);
                    if (expectedSlug && expectedSlug !== currentSlug) {
                        window.history.replaceState(null, "", `/read/${expectedSlug}`);
                        document.title = chapterRef;
                    }
                }
                return chapterData;
            },
            { abortPrevious: true }
        );
    }, [chapterRef, initialLoad, executeOperation]);

    // ---------------------------------------------------------
    // Auto-scroll to highlighted verse on load if no multiple chapters
    // ---------------------------------------------------------
    useEffect(() => {
        if (allChapters.length > 0) return; // skip if multi-chapters are already loaded
        if (highlightedVerses?.length) {
            const maxVerse = Math.max(...highlightedVerses);
            const verseElement = verseRefs.current.get(maxVerse);
            if (verseElement) {
                verseElement.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [highlightedVerses, allChapters.length]);

    // ---------------------------------------------------------
    // If the loaded chapter is super short, pre-load next but only after user scrolls
    // ---------------------------------------------------------
    useEffect(() => {
        if (!content) return;
        
        // Delay measurement slightly to ensure the DOM is rendered
        const checkShortContent = () => {
            const doc = document.documentElement;
            const contentHeight = doc.scrollHeight;
            const viewportHeight = doc.clientHeight;

            // Only pre-load if:
            // 1. Content is short (fits in viewport)
            // 2. User has scrolled (showing intent to read)
            // 3. We haven't already preloaded for this chapter
            // 4. Next chapter exists
            // 5. No additional chapters are already loaded
            if (
                contentHeight <= viewportHeight * 1.2 && 
                hasUserScrolled.current && 
                !nextChapterPreloaded.current &&
                nextChapterRef &&
                allChapters.length === 0
            ) {
                nextChapterPreloaded.current = true;
                loadNextChapter(false);
            }
        };
        // Run after small delay to ensure rendering
        const t = setTimeout(checkShortContent, 500);
        return () => clearTimeout(t);
    }, [content, nextChapterRef, loadNextChapter, allChapters.length]);

    // ---------------------------------------------------------
    // Update URL if highlightedVerses changes
    // ---------------------------------------------------------
    useEffect(() => {
        if (!highlightedVerses) return;
        const urlSlug = match.url.replace(/^\/read\//, "");
        const idealSlug = verseIdToSlug(highlightedVerses) || slugify(activeChapterRef);
        if (idealSlug && idealSlug !== urlSlug) {
            history.push(`/read/${idealSlug}`);
        }
    }, [highlightedVerses, activeChapterRef, history, match.url]);

    // ---------------------------------------------------------
    // Render all chapters
    // ---------------------------------------------------------
    const buildContent = (readData) => {
        // Combine the current chapter content with all loaded chapters
        const combinedChapters = [
            { ref: chapterRef, data: readData },
            ...allChapters
        ].filter(ch => ch.data);

        return (
            <div className="read-content">
                {/* TOP NAV */}
                <div className="read-header-nav">
                    {prevChapterRef ? (
                        <button onClick={goToPreviousChapter} className="btn btn-primary">
                            ◀ {prevChapterRef}
                        </button>
                    ) : (
                        <button className="btn btn-primary disabled" disabled>  ◀  </button>
                    )}
                    <h3 className="title lg-4 text-center">
                        {chapterRef || label("menu_read")}
                    </h3>
                    {nextChapterRef ? (
                        <button onClick={goToNextChapter} className="btn btn-primary">
                            {nextChapterRef} ▶
                        </button>
                    ) : (
                        <button className="btn btn-primary disabled" disabled>  ▶ </button>
                    )}
                </div>

                {/* Chapter Navigation Bar */}
                <ChapterNav
                    chapterRef={activeChapterRef}
                    onChapterClick={handleExplicitChapterNavigation}
                />

                <div className="read-mobile-nav">
                    {prevChapterRef ? (
                        <button onClick={goToPreviousChapter} className="btn btn-primary">
                            ◀ {prevChapterRef}
                        </button>
                    ) : (
                        <button className="btn btn-primary disabled" disabled>  ◀  </button>
                    )}
                    {nextChapterRef ? (
                        <button onClick={goToNextChapter} className="btn btn-primary">
                            {nextChapterRef} ▶
                        </button>
                    ) : (
                        <button className="btn btn-primary disabled" disabled>  ▶ </button>
                    )}
                </div>

                {/* MAIN CHAPTER CONTENTS */}
                {combinedChapters.map((chapItem) => (
                    <ChapterContent
                        key={chapItem.ref}
                        chapterItem={chapItem}
                        highlightedVerses={highlightedVerses}
                        hoveredVerse={hoveredVerse}
                        setHoveredVerse={setHoveredVerse}
                        activeChapterRef={activeChapterRef}
                        appController={appController}
                        DEBUG_SKELETON={DEBUG_SKELETON}
                        verseRefs={verseRefs}
                    />
                ))}

                {/* If no data at all, show skeleton */}
                {!readData && combinedChapters.length === 0 && <SkeletonLoader />}

                {/* Manual NEXT button at the bottom */}
                {!!readData && !DEBUG_SKELETON && (
                    <div className="read-section-footer">
                        {nextChapterRef ? (
                            <button 
                                onClick={() => loadNextChapter(true)}
                                className="btn btn-primary btn-lg"
                                style={{ minWidth: '200px' }}
                            >
                                {isOperationRunning("loadNext") ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        <span style={{ marginLeft: '8px' }}>Loading... (Click to retry)</span>
                                    </>
                                ) : (
                                    <>{nextChapterRef} ▶</>
                                )}
                            </button>
                        ) : (
                            <div className="text-muted">
                                <em>End of Book</em>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // ---------------------------------------------------------
    // Final render
    // ---------------------------------------------------------
    return (
        <div className="container" style={{ display: 'block' }}>
            <div id="page" className="read">
                {buildContent(content)}
            </div>
        </div>
    );
}
