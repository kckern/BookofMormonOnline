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
import { useConcurrentOperations, useThrottle, useDebounce } from "../../hooks/useConcurrentOperations";
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
    // Initialize chapter data from route - stabilized to prevent re-renders
    // ---------------------------------------------------------
    const routeKey = useMemo(() => {
        const { bookCh, verseNum } = match.params;
        return `${bookCh || 'default'}_${verseNum || 'none'}`;
    }, [match.params.bookCh, match.params.verseNum]);

    const chapterData = useMemo(() => {
        // Only recalculate when route key actually changes
        return initializeChapterData(match);
    }, [routeKey]);

    const {
        initChapterRef,
        initHighlightedVerses,
        initNextChapter,
        initPrevChapter,
        initChapterVerseIds
    } = chapterData;

    // ---------------------------------------------------------
    // Manage state - optimized with loading state
    // ---------------------------------------------------------
    const [content, setContent] = useState(null);               
    const [allChapters, setAllChapters] = useState([]);         
    const [chapterRef, setChapterRef] = useState(initChapterRef);
    const [activeChapterRef, setActiveChapterRef] = useState(initChapterRef);
    const [highlightedVerses, setHighlightedVerses] = useState(initHighlightedVerses);
    const [hoveredVerse, setHoveredVerse] = useState(null);
    const [nextChapterRef, setNextChapterRef] = useState(initNextChapter);
    const [prevChapterRef, setPrevChapterRef] = useState(initPrevChapter);
    const [chapterVerseIds, setChapterVerseIds] = useState(initChapterVerseIds);
    const [initialLoad, setInitialLoad] = useState(true);       
    const [isContentLoading, setIsContentLoading] = useState(false);  

    // Refs
    const verseRefs = useRef(new Map()); 
    const scrollTimeoutRef = useRef(null);
    const hasUserScrolled = useRef(false); 
    const lastLoadedChapterCount = useRef(0); 
    const lastScrollY = useRef(0); 
    const nextChapterPreloaded = useRef(false); 
    const lastContentLoadTime = useRef(0); 

    // ---------------------------------------------------------
    // Navigate to next/previous chapters - memoized
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
        if (isOperationRunning("loadNext") && !isManualOverride) {
            return;
        }
        if (!nextChapterRef) return;

        if (!isManualOverride) {
            const { scrollHeight, scrollTop, clientHeight } = document.documentElement;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const scrollProgress = scrollTop / (scrollHeight - clientHeight);
            const timeSinceLastLoad = Date.now() - lastContentLoadTime.current;
            
            if (distanceFromBottom > 200 && scrollProgress < 0.7) {
                return;
            }
            
            if (timeSinceLastLoad < 1000) {
                return;
            }
        }

        await executeOperation(
            "loadNext",
            async (signal) => {
                setIsContentLoading(true);
                try {
                    const data = await BoMOnlineAPI({ read: nextChapterRef }, { signal });
                    if (signal.aborted) return null;

                    const mainKey = Object.keys(data.read)[0];
                    const nextChapterData = data.read[mainKey];
                    if (!nextChapterData) return null;

                    const nextChapterVerses = memoizedLookupReference(nextChapterRef).verse_ids;
                    
                    setAllChapters((prev) => {
                        const newChapters = [
                            ...prev,
                            {
                                ref: nextChapterRef,
                                data: nextChapterData,
                                verseIds: nextChapterVerses,
                            },
                        ];
                        lastLoadedChapterCount.current = newChapters.length + 1;
                        lastContentLoadTime.current = Date.now();
                        return newChapters;
                    });

                    const { nextChapter } = getPrevNextChapter(nextChapterVerses);
                    setNextChapterRef(nextChapter || null);

                    return nextChapterData;
                } finally {
                    setIsContentLoading(false);
                }
            },
            { allowMultiple: false }
        );
    }, [nextChapterRef, isOperationRunning, executeOperation]);

    // ---------------------------------------------------------
    // Called when the user explicitly navigates to a new chapter
    // ---------------------------------------------------------
    const handleExplicitChapterNavigation = useCallback(() => {
        abortAllOperations();
        setContent(null);
        setAllChapters([]);
        setHighlightedVerses(null);
        setIsContentLoading(false);
        hasUserScrolled.current = false;
        lastLoadedChapterCount.current = 0;
        lastScrollY.current = 0;
        nextChapterPreloaded.current = false;
        lastContentLoadTime.current = 0;
        window.scrollTo(0, 0);
    }, [abortAllOperations]);

    // ---------------------------------------------------------
    // Monitor changes to route - optimized with batching (React < 18 compatible)
    // ---------------------------------------------------------
    useEffect(() => {
        // Batch state updates using setTimeout to prevent cascade re-renders
        const batchedUpdate = () => {
            setChapterRef(initChapterRef);
            setActiveChapterRef(initChapterRef);
            setHighlightedVerses(initHighlightedVerses);
            setNextChapterRef(initNextChapter);
            setPrevChapterRef(initPrevChapter);
            setChapterVerseIds(initChapterVerseIds);
            setInitialLoad(true);
            setIsContentLoading(false);
            
            // Reset tracking values
            hasUserScrolled.current = false;
            lastLoadedChapterCount.current = 0;
            lastScrollY.current = 0;
            nextChapterPreloaded.current = false;
            lastContentLoadTime.current = 0;
        };

        // Use setTimeout to batch updates and prevent flickering
        const timeoutId = setTimeout(batchedUpdate, 0);
        return () => clearTimeout(timeoutId);
    }, [initChapterRef, initHighlightedVerses, initNextChapter, initPrevChapter, initChapterVerseIds]);

    // ---------------------------------------------------------
    // Keyboard navigation - memoized
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
    // Scroll handler - throttled and optimized
    // ---------------------------------------------------------
    const throttledScrollHandler = useThrottle(() => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > lastScrollY.current + 10) {
            hasUserScrolled.current = true;
        }
        lastScrollY.current = currentScrollY;
        
        if (!isOperationRunning("loadNext") && !isContentLoading) {
            const { scrollHeight, scrollTop, clientHeight } = document.documentElement;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const scrollProgress = scrollTop / (scrollHeight - clientHeight);
            
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
    }, [throttledScrollHandler, loadNextChapter, isContentLoading]);

    // ---------------------------------------------------------
    // Load the initial content - with loading state
    // ---------------------------------------------------------
    useEffect(() => {
        if (!initialLoad) return;
        if (!chapterRef) return;

        setContent(null);
        setAllChapters([]);
        document.title = chapterRef;

        executeOperation(
            "loadContent",
            async (signal) => {
                setIsContentLoading(true);
                try {
                    const data = await BoMOnlineAPI({ read: chapterRef }, { signal });
                    if (signal.aborted) return null;

                    const mainKey = Object.keys(data.read)[0];
                    const chapterData = data.read[mainKey];
                    if (chapterData) {
                        setContent(chapterData);
                        setInitialLoad(false);
                        lastContentLoadTime.current = Date.now();
                        localStorage.setItem("chapterRef", chapterRef);
                        
                        const currentSlug = window.location.pathname.replace(/^\/read\//, "");
                        const expectedSlug = slugify(chapterRef);
                        if (expectedSlug && expectedSlug !== currentSlug) {
                            window.history.replaceState(null, "", `/read/${expectedSlug}`);
                            document.title = chapterRef;
                        }
                    }
                    return chapterData;
                } finally {
                    setIsContentLoading(false);
                }
            },
            { abortPrevious: true }
        );
    }, [chapterRef, initialLoad, executeOperation]);

    // ---------------------------------------------------------
    // Auto-scroll to highlighted verse - debounced to prevent flickering
    // ---------------------------------------------------------
    const debouncedHighlightedVerses = useDebounce(highlightedVerses, 300);
    
    useEffect(() => {
        if (allChapters.length > 0) return;
        if (debouncedHighlightedVerses?.length && !isContentLoading) {
            const maxVerse = Math.max(...debouncedHighlightedVerses);
            const verseElement = verseRefs.current.get(maxVerse);
            if (verseElement) {
                verseElement.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [debouncedHighlightedVerses, allChapters.length, isContentLoading]);

    // ---------------------------------------------------------
    // Pre-load short content - optimized
    // ---------------------------------------------------------
    useEffect(() => {
        if (!content || isContentLoading) return;
        
        const checkShortContent = () => {
            const doc = document.documentElement;
            const contentHeight = doc.scrollHeight;
            const viewportHeight = doc.clientHeight;

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
        
        const t = setTimeout(checkShortContent, 500);
        return () => clearTimeout(t);
    }, [content, nextChapterRef, loadNextChapter, allChapters.length, isContentLoading]);

    // ---------------------------------------------------------
    // Update URL - debounced to prevent excessive updates
    // ---------------------------------------------------------
    const debouncedHighlightedVersesForUrl = useDebounce(highlightedVerses, 500);
    
    useEffect(() => {
        if (!debouncedHighlightedVersesForUrl) return;
        const urlSlug = match.url.replace(/^\/read\//, "");
        const idealSlug = verseIdToSlug(debouncedHighlightedVersesForUrl) || slugify(activeChapterRef);
        if (idealSlug && idealSlug !== urlSlug) {
            history.push(`/read/${idealSlug}`);
        }
    }, [debouncedHighlightedVersesForUrl, activeChapterRef, history, match.url]);

    // ---------------------------------------------------------
    // Render all chapters - memoized to prevent unnecessary re-renders
    // ---------------------------------------------------------
    const buildContent = useCallback((readData) => {
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

                {/* Loading indicator for content */}
                {isContentLoading && <SkeletonLoader />}

                {/* If no data at all and not loading, show skeleton */}
                {!readData && combinedChapters.length === 0 && !isContentLoading && <SkeletonLoader />}

                {/* Manual NEXT button at the bottom */}
                {!!readData && !DEBUG_SKELETON && (
                    <div className="read-section-footer">
                        {nextChapterRef ? (
                            <button 
                                onClick={() => loadNextChapter(true)}
                                className="btn btn-primary btn-lg"
                                style={{ minWidth: '200px' }}
                                disabled={isContentLoading}
                            >
                                {isOperationRunning("loadNext") || isContentLoading ? (
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
    }, [
        chapterRef, 
        allChapters, 
        prevChapterRef, 
        nextChapterRef, 
        goToPreviousChapter, 
        goToNextChapter, 
        activeChapterRef, 
        handleExplicitChapterNavigation,
        highlightedVerses,
        hoveredVerse,
        appController,
        isContentLoading,
        isOperationRunning,
        loadNextChapter
    ]);

    // ---------------------------------------------------------
    // Final render with loading state consideration
    // ---------------------------------------------------------
    return (
        <div className="container" style={{ display: 'block' }}>
            <div id="page" className="read">
                {buildContent(content)}
            </div>
        </div>
    );
}
