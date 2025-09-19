import { useRouteMatch, Link, useHistory } from "react-router-dom";
import "./Read.scss";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import BoMOnlineAPI from "../../models/BoMOnlineAPI";
import { label } from "../../models/Utils";

// Import utilities and components
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

// Debug flag - set to true to always show skeleton loader
const DEBUG_SKELETON = false;
export default function ReadScripture({ appController }) {
    const match = useRouteMatch();
    const history = useHistory();
    const { executeOperation, isOperationRunning, abortAllOperations } = useConcurrentOperations();
    
    // Initialize chapter data using memoized utility
    const { 
        initChapterRef, 
        initHighlightedVerses, 
        initNextChapter, 
        initPrevChapter, 
        initChapterVerseIds 
    } = useMemo(() => initializeChapterData(match), [match.params]);

    // State management
    const [content, setContent] = useState(null);
    const [allChapters, setAllChapters] = useState([]);
    const [chapterRef, setChapterRef] = useState(initChapterRef);
    const [activeChapterRef, setActiveChapterRef] = useState(initChapterRef);
    const [highlightedVerses, setHighlightedVerses] = useState(initHighlightedVerses);
    const [hoveredVerse, setHoveredVerse] = useState(null);
    const [nextChapterRef, setNextChapterRef] = useState(initNextChapter);
    const [prevChapterRef, setPrevChapterRef] = useState(initPrevChapter);
    const [chapterVerseIds, setChapterVerseIds] = useState(initChapterVerseIds);
    const [preloadedChapter, setPreloadedChapter] = useState(null);
    const [isScrolling, setIsScrolling] = useState(false);

    // Refs for managing observers and timeouts
    const prevInitChapterRef = useRef(initChapterRef);
    const prevInitHighlightedVerses = useRef(initHighlightedVerses);
    const readContentRef = useRef(null);
    const nextButtonRef = useRef(null);
    const observerRef = useRef(null);
    const chapterObserverRef = useRef(null);
    const scrollTimeoutRef = useRef(null);
    const verseRefs = useRef(new Map()); // Map to store verse element refs

    // Navigation functions with memoized dependencies
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

    // Preload next chapter with concurrency control
    const preloadNextChapter = useCallback(async (chapterToPreload) => {
        if (!chapterToPreload) return;
        
        return executeOperation(
            `preload-${chapterToPreload}`,
            async (signal) => {
                const data = await BoMOnlineAPI({ read: chapterToPreload }, { signal });
                const mainKey = Object.keys(data.read)[0];
                const chapterData = data.read[mainKey];
                
                if (chapterData && !signal.aborted) {
                    const chapterVerseIds = memoizedLookupReference(chapterToPreload).verse_ids;
                    setPreloadedChapter({
                        ref: chapterToPreload,
                        data: chapterData,
                        verseIds: chapterVerseIds
                    });
                }
                return chapterData;
            },
            { allowMultiple: false, abortPrevious: true }
        );
    }, [executeOperation]);

    // Load next chapter for infinite scroll with race condition prevention
    const loadNextChapter = useCallback(async () => {
        if (!nextChapterRef || isOperationRunning('loadNext')) return;
        
        return executeOperation(
            'loadNext',
            async (signal) => {
                let chapterToAdd;
                
                // Use preloaded chapter if it matches what we need
                if (preloadedChapter && preloadedChapter.ref === nextChapterRef) {
                    chapterToAdd = preloadedChapter;
                    setPreloadedChapter(null);
                } else {
                    // Load chapter if not preloaded
                    const data = await BoMOnlineAPI({ read: nextChapterRef }, { signal });
                    const mainKey = Object.keys(data.read)[0];
                    const nextChapterData = data.read[mainKey];
                    
                    if (nextChapterData && !signal.aborted) {
                        const nextChapterVerseIds = memoizedLookupReference(nextChapterRef).verse_ids;
                        chapterToAdd = {
                            ref: nextChapterRef,
                            data: nextChapterData,
                            verseIds: nextChapterVerseIds
                        };
                    }
                }
                
                if (chapterToAdd && !signal.aborted) {
                    setAllChapters(prev => [...prev, chapterToAdd]);
                    
                    // Update next chapter reference for subsequent loads
                    const { nextChapter } = getPrevNextChapter(chapterToAdd.verseIds);
                    setNextChapterRef(nextChapter);
                    
                    // Immediately preload the new next chapter
                    if (nextChapter) {
                        preloadNextChapter(nextChapter);
                    }
                }
                
                return chapterToAdd;
            },
            { allowMultiple: false }
        );
    }, [nextChapterRef, preloadedChapter, executeOperation, isOperationRunning, preloadNextChapter]);

    // Handle explicit chapter navigation from grid - clear all content and reset
    const handleExplicitChapterNavigation = useCallback(() => {
        console.log('(2) New navigation triggered - clearing all content and resetting state');
        
        // Abort all operations to prevent stale data
        abortAllOperations();
        
        // Disconnect chapter observer to prevent stale container detection
        if (chapterObserverRef.current) {
            chapterObserverRef.current.disconnect();
        }
        
        // Immediately show clean state
        setContent(null);
        setAllChapters([]);
        setPreloadedChapter(null);
        setIsScrolling(false);
        setHighlightedVerses(null);
        
        // Clear any scroll timeout
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        
        // Scroll to top immediately for clean experience
        window.scrollTo(0, 0);
    }, [abortAllOperations]);

    // Update state when route parameters change
    useEffect(() => {
        const { 
            initChapterRef: newInitChapterRef, 
            initHighlightedVerses: newInitHighlightedVerses, 
            initNextChapter: newInitNextChapter, 
            initPrevChapter: newInitPrevChapter,
            initChapterVerseIds: newChapterVerseIds
        } = initializeChapterData(match);

        if (prevInitChapterRef.current !== newInitChapterRef) {
            setChapterRef(newInitChapterRef || memoizedGenerateReference(memoizedLookupReference("1Ne1").verse_ids).trim());
            setActiveChapterRef(newInitChapterRef || memoizedGenerateReference(memoizedLookupReference("1Ne1").verse_ids).trim());
            prevInitChapterRef.current = newInitChapterRef;
        }

        if (prevInitHighlightedVerses.current !== newInitHighlightedVerses) {
            setHighlightedVerses(newInitHighlightedVerses);
            prevInitHighlightedVerses.current = newInitHighlightedVerses;
        }

        setNextChapterRef(newInitNextChapter);
        setChapterVerseIds(newChapterVerseIds);
        setPrevChapterRef(newInitPrevChapter);
    }, [match.params]);



    // Find the next/previous verse for keyboard navigation using React state
    const findAdjacentVerse = useCallback((direction) => {
        if (!chapterVerseIds?.length) return null;
        
        if (!highlightedVerses?.length) {
            // No verses highlighted, start from first verse
            return chapterVerseIds[0];
        }
        
        const maxHighlighted = Math.max(...highlightedVerses);
        const currentIndex = chapterVerseIds.indexOf(maxHighlighted);
        
        if (currentIndex === -1) return chapterVerseIds[0];
        
        const nextIndex = currentIndex + direction;
        if (nextIndex >= 0 && nextIndex < chapterVerseIds.length) {
            return chapterVerseIds[nextIndex];
        }
        
        // Stay at current verse if at boundary
        return maxHighlighted;
    }, [chapterVerseIds, highlightedVerses]);

    // Navigate to a specific verse using refs instead of DOM queries
    const navigateToVerse = useCallback((verseId) => {
        if (!verseId) return;
        
        // Use verse ref if available
        const verseElement = verseRefs.current.get(verseId);
        if (verseElement) {
            verseElement.scrollIntoView({ behavior: "smooth", block: "center" });
            // Navigate to the verse by updating the URL
            const versesToHighlight = [verseId];
            const slug = verseIdToSlug(versesToHighlight);
            history.push(`/read/${slug}`);
        } else {
            console.warn("Verse element not found for ID:", verseId);
        }
    }, [history]);

    // Improved keyboard navigation with accessibility
    const handleKeyDown = useCallback((e) => {
        // Only handle keys when not in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
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
                // Clear highlighted verses
                const slug = slugify(activeChapterRef);
                history.push(`/read/${slug}`);
                break;
            }
        }
    }, [goToNextChapter, goToPreviousChapter, activeChapterRef, history, findAdjacentVerse, navigateToVerse]);

    // Add keyboard event listener
    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleKeyDown]);

    // Throttled scroll handler to improve performance
    const throttledScrollHandler = useThrottle(() => {
        setIsScrolling(true);
        
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        
        scrollTimeoutRef.current = setTimeout(() => {
            setIsScrolling(false);
        }, 150);
        
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;
        
        const contentHeight = scrollHeight - clientHeight;
        const hasSubstantialContent = contentHeight > 200;
        
        // Trigger load when user is near bottom (within 100px) AND has scrolled substantially
        if (hasSubstantialContent && scrollHeight - scrollTop - clientHeight < 100 && !isOperationRunning('loadNext')) {
            loadNextChapter();
        }
    }, 100);

    // Combined effect for intersection observers and scroll handling
    useEffect(() => {
        // Set up intersection observer for infinite scroll
        if (nextButtonRef.current) {
            const intersectionOptions = {
                root: null,
                rootMargin: '50px',
                threshold: 0.1
            };

            observerRef.current = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !isOperationRunning('loadNext')) {
                        const hasScrolled = window.scrollY > 100;
                        if (hasScrolled) {
                            loadNextChapter();
                        }
                    }
                });
            }, intersectionOptions);

            observerRef.current.observe(nextButtonRef.current);
        }

        // Add scroll listener
        window.addEventListener('scroll', throttledScrollHandler, { passive: true });

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
            window.removeEventListener('scroll', throttledScrollHandler);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [loadNextChapter, isOperationRunning, throttledScrollHandler]);
    // Chapter observer for URL updates
    useEffect(() => {
        if (!content) return;
        
        const chapterOptions = {
            root: null,
            rootMargin: '-50% 0px -50% 0px',
            threshold: 0
        };

        chapterObserverRef.current = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const chapterContainer = entry.target;
                    const chapterRefFromContainer = chapterContainer.dataset.chapterRef;
                    if (chapterRefFromContainer && chapterRefFromContainer !== activeChapterRef) {
                        setActiveChapterRef(chapterRefFromContainer);
                        
                        const currentSlug = window.location.pathname.replace(/^\/read\//, "");
                        const newSlug = slugify(chapterRefFromContainer);
                        if (newSlug && newSlug !== currentSlug) {
                            console.log('(3) URL updating from', currentSlug, 'to', newSlug, 'for chapter:', chapterRefFromContainer);
                            window.history.replaceState(null, "", `/read/${newSlug}`);
                            document.title = chapterRefFromContainer;
                        }
                    }
                }
            });
        }, chapterOptions);

        setTimeout(() => {
            const chapterContainers = document.querySelectorAll('.chapter-container');
            chapterContainers.forEach(container => {
                if (chapterObserverRef.current) {
                    chapterObserverRef.current.observe(container);
                }
            });
        }, 100);

        return () => {
            if (chapterObserverRef.current) {
                chapterObserverRef.current.disconnect();
            }
        };
    }, [content, activeChapterRef]);

    // Auto-scroll to highlighted verse on load using React state
    useEffect(() => {
        if (allChapters.length > 0) return; // Skip if infinite scroll has loaded additional chapters
        
        if (highlightedVerses?.length) {
            const maxVerse = Math.max(...highlightedVerses);
            const verseElement = verseRefs.current.get(maxVerse);
            if (verseElement) {
                verseElement.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [highlightedVerses, chapterRef, allChapters.length]);

    const buildContent = (readData, { chapterRef, nextChapterRef, prevChapterRef }) => {
        const prevRef = readData?.prev_ref || prevChapterRef;
        const nextRef = readData?.next_ref || nextChapterRef;
        const ref = readData?.ref || chapterRef;

        // Combine current chapter with all loaded additional chapters
        const allChapterData = [
            { ref: chapterRef, data: readData },
            ...allChapters
        ].filter(chapter => chapter.data);

        return (
            <div className="read-content" ref={readContentRef}>
                <div className="read-header-nav">
                    {prevRef ? (
                        <button onClick={goToPreviousChapter} className="btn btn-primary">
                            ◀ {prevRef}
                        </button>
                    ) : (
                        <button className="btn btn-primary disabled" disabled>  ◀  </button>
                    )}
                    <h3 className="title lg-4 text-center">{ref || label("menu_read")}</h3>
                    {nextRef ? (
                        <button onClick={goToNextChapter} className="btn btn-primary">
                            {nextRef} ▶
                        </button>
                    ) : (
                        <button className="btn btn-primary disabled" disabled>  ▶ </button>
                    )}
                </div>
                
                <ChapterNav chapterRef={activeChapterRef} onChapterClick={handleExplicitChapterNavigation} />
                
                <div className="read-mobile-nav">
                    {prevRef ? (
                        <button onClick={goToPreviousChapter} className="btn btn-primary">
                            ◀ {prevRef}
                        </button>
                    ) : (
                        <button className="btn btn-primary disabled" disabled>  ◀  </button>
                    )}
                    {nextRef ? (
                        <button onClick={goToNextChapter} className="btn btn-primary">
                            {nextRef} ▶
                        </button>
                    ) : (
                        <button className="btn btn-primary disabled" disabled>  ▶ </button>
                    )}
                </div>
                
                {/* Render all chapters using new component */}
                {allChapterData.map((chapterItem) => (
                    <ChapterContent
                        key={chapterItem.ref}
                        chapterItem={chapterItem}
                        highlightedVerses={highlightedVerses}
                        hoveredVerse={hoveredVerse}
                        setHoveredVerse={setHoveredVerse}
                        activeChapterRef={activeChapterRef}
                        appController={appController}
                        DEBUG_SKELETON={DEBUG_SKELETON}
                        verseRefs={verseRefs}
                    />
                ))}
                
                {/* Show skeleton loader if no content at all */}
                {(!readData && allChapters.length === 0) && <SkeletonLoader />}
                
                {/* Single centered Next button */}
                {!!readData && !DEBUG_SKELETON && (
                    <div className="read-section-footer">
                        {nextChapterRef ? (
                            <button 
                                ref={nextButtonRef}
                                onClick={loadNextChapter} 
                                className="btn btn-primary btn-lg"
                                disabled={isOperationRunning('loadNext') || isScrolling}
                                style={{ minWidth: '200px' }}
                            >
                                {isOperationRunning('loadNext') || isScrolling ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
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

    // Load content effect with improved API call using utilities
    useEffect(() => {
        const urlSlug = match.url?.replace(/^\/read\//, "");
        const currentBaseChapter = content ? chapterRef : null;
        const currentChapterRef = initChapterRef;
        
        const isNewNavigation = currentBaseChapter && !allChapters.some(ch => slugify(ch.ref) === urlSlug) && slugify(currentBaseChapter) !== urlSlug;
        
        if (isNewNavigation || !content) {
            console.log('(2.5) Loading content for chapter:', currentChapterRef, 'due to navigation or no content');
            setContent(null);
            document.title = currentChapterRef;
            
            if (isNewNavigation) {
                setAllChapters([]);
                setPreloadedChapter(null);
            }
            
            executeOperation(
                'loadContent',
                async (signal) => {
                    const data = await BoMOnlineAPI({ read: currentChapterRef }, { signal });
                    const mainKey = Object.keys(data.read)[0];
                    const contentData = data.read[mainKey];
                    
                    if (contentData && !signal.aborted) {
                        setContent(contentData);
                        localStorage.setItem("chapterRef", currentChapterRef);
                        
                        const currentSlug = window.location.pathname.replace(/^\/read\//, "");
                        const expectedSlug = slugify(currentChapterRef);
                        if (expectedSlug && expectedSlug !== currentSlug) {
                            console.log('(3) URL updating from', currentSlug, 'to', expectedSlug, 'for initial load of chapter:', currentChapterRef);
                            window.history.replaceState(null, "", `/read/${expectedSlug}`);
                            document.title = currentChapterRef;
                        }
                        
                        if (nextChapterRef) {
                            preloadNextChapter(nextChapterRef);
                        }
                    }
                    
                    return contentData;
                },
                { abortPrevious: true }
            );
        }
    }, [match.params, nextChapterRef, preloadNextChapter, initChapterRef, executeOperation]);
    
    // Handle highlighted verses URL updates
    useEffect(() => {
        const urlSlug = match.url?.replace(/^\/read\//, "");
        const idealSlug = highlightedVerses ? verseIdToSlug(highlightedVerses) : slugify(activeChapterRef);
        
        if (idealSlug && idealSlug !== urlSlug && highlightedVerses) {
            history.push(`/read/${idealSlug}`);
        }
    }, [highlightedVerses, activeChapterRef, history]);

    return (
        <div className="container" style={{ display: 'block' }}>
            <div id="page" className="read">
                {buildContent(content, { chapterRef, nextChapterRef, prevChapterRef })}
            </div>
        </div>
    );
}