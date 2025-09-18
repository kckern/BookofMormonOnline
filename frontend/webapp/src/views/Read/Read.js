import { useRouteMatch, Link, useHistory } from "react-router-dom";
import "./Read.scss";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Loader, { Spinner } from "../_Common/Loader";
import BoMOnlineAPI, { assetUrl } from "../../models/BoMOnlineAPI";
import { generateReference, lookupReference } from "scripture-guide";
import ReactTooltip from "react-tooltip";
import { determineLanguage, label, isMobile } from "../../models/Utils";

// Debug flag - set to true to always show skeleton loader
const DEBUG_SKELETON = false;

const SkeletonLoader = () => {
    const [skeletonData] = useState(() => {
        const getRandomWidth = () => Math.floor(Math.random() * (80 - 40 + 1)) + 40;
        const getRandomParagraphs = () => Math.floor(Math.random() * 5) + 1; // 1-5 paragraphs
        const getRandomLines = () => Math.floor(Math.random() * 6) + 2; // 2-7 lines
        const getRandomLineWidth = (isLast) => {
            if (isLast) {
                // Last line in paragraph: 50-75% width for ragged edge
                return Math.floor(Math.random() * 26) + 50;
            }
            // Regular lines: 90-100% width with some variation in last 10%
            return Math.floor(Math.random() * 11) + 90;
        };

        // Generate skeleton data once
        return [1, 2, 3].map((sectionIndex) => ({
            id: sectionIndex,
            headingWidth: getRandomWidth(),
            paragraphs: Array.from({ length: getRandomParagraphs() }, (_, paragraphIndex) => {
                const numLines = getRandomLines();
                return {
                    id: paragraphIndex,
                    lines: Array.from({ length: numLines }, (_, lineIndex) => {
                        const isLastLine = lineIndex === numLines - 1;
                        return {
                            id: lineIndex,
                            width: getRandomLineWidth(isLastLine)
                        };
                    })
                };
            })
        }));
    });
    
    return (
        <div className="read-content">
            {skeletonData.map((section) => (
                <div key={section.id} className="read-section skeleton-section">
                    <div className="read-section-header skeleton-header">
                        <div className="skeleton-heading" style={{ width: `${section.headingWidth}%` }}></div>
                        <div className="skeleton-study-btn"></div>
                    </div>
                    <div className="read-block skeleton-block">
                        <div className="left-gutter skeleton-gutter">
                            <div className="skeleton-avatar"></div>
                            <div className="skeleton-voice"></div>
                        </div>
                        <div className="main-content skeleton-content">
                            {section.paragraphs.map((paragraph) => (
                                <div key={paragraph.id} className="skeleton-paragraph">
                                    {paragraph.lines.map((line) => (
                                        <div 
                                            key={line.id} 
                                            className="skeleton-text-line" 
                                            style={{ width: `${line.width}%` }}
                                        ></div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const slugify = (text,verse_ids) => {
    if(!text) return null;
    //const hasAlpha = /[a-z]/.test(text.toLowerCase());
    //if(hasAlpha) return  text.toLowerCase().replace(/ /g, ".").replace(/:/g, ".").replace(/[.]+/g, ".").replace(/[^a-z0-9.-]/g, "");
    const slug = text.replace(/ /g, ".").replace(/:/g, ".").replace(/[-]+/g, "~").toLowerCase();    
    return slug;
}

const verseIdToSlug = (verseIds) => {
    const ref = generateReference(verseIds, lang);
    return slugify(ref).replace(/[.](\d+$)/, "/$1");
}


const lang = determineLanguage();

const getEnglishReference = (ref) => {
    const verse_ids = lookupReference(ref,"en").verse_ids;
    const enref = generateReference(verse_ids, "en");
    return enref;
}

const getPrevNextChapter = (verse_ids) => {
    const nextVerseId = verse_ids[verse_ids.length - 1] + 1;
    const prevVerseId = verse_ids[0] - 1;
    const nextChapter = nextVerseId > 37706 ? null : generateReference([nextVerseId], lang).split(":")[0];
    const prevChapter = prevVerseId < 31103 ? null : generateReference([prevVerseId], lang).split(":")[0];
    return { nextChapter, prevChapter };
}


const reInit = (match) => {
    const { params } = match;
    const { bookCh, verseNum } = params;
    const modifiedBookCh = bookCh?.replace(/[.]/g, " ") || generateReference(lookupReference("1Ne1").verse_ids, lang).trim();
    const urlSlug = match.url?.replace(/^\/read\//, "");

    const fullReference = verseNum ? `${modifiedBookCh}:${verseNum}` : modifiedBookCh;
    //alert(fullReference);
    const initChapterVerseIds = lookupReference(modifiedBookCh, lang).verse_ids;
    const initHighlightedVerses = verseNum ? lookupReference(fullReference, lang).verse_ids : null;
    const initChapterRef = modifiedBookCh ? generateReference(initChapterVerseIds, lang).trim() : window.localStorage.getItem("chapterRef").trim() || generateReference(lookupReference("1Ne1").verse_ids, lang).trim();
    const { nextChapter: initNextChapter, prevChapter: initPrevChapter } = getPrevNextChapter(initChapterVerseIds);
    return { initChapterRef, initHighlightedVerses, initNextChapter, initPrevChapter,initChapterVerseIds };
};

export default function ReadScripture({ appController }) {
    const match = useRouteMatch();
    const history = useHistory();
    const { initChapterRef, initHighlightedVerses, initNextChapter, initPrevChapter, initChapterVerseIds } = reInit(match);

    const [content, setContent] = useState(null);
    const [allChapters, setAllChapters] = useState([]); // Array to store multiple loaded chapters
    const [chapterRef, setChapterRef] = useState(initChapterRef);
    const [activeChapterRef, setActiveChapterRef] = useState(initChapterRef); // Currently viewed chapter for URL/grid
    const [highlightedVerses, setHighlightedVerses] = useState(initHighlightedVerses);
    const [hoveredVerse, setHoveredVerse] = useState(null);
    const [nextChapterRef, setNextChapterRef] = useState(initNextChapter);
    const [prevChapterRef, setPrevChapterRef] = useState(initPrevChapter);
    const [chapterVerseIds, setChapterVerseIds] = useState(initChapterVerseIds);
    const [isLoadingNext, setIsLoadingNext] = useState(false);
    const [preloadedChapter, setPreloadedChapter] = useState(null); // Preloaded next chapter for instant display
    const [isScrolling, setIsScrolling] = useState(false); // Track if user is currently scrolling

    const prevInitChapterRef = useRef(initChapterRef);
    const prevInitHighlightedVerses = useRef(initHighlightedVerses);
    const readContentRef = useRef(null);
    const nextButtonRef = useRef(null);
    const observerRef = useRef(null);
    const chapterObserverRef = useRef(null);
    const scrollTimeoutRef = useRef(null);

    // Navigation functions
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

    // Preload next chapter for instant infinite scroll
    const preloadNextChapter = useCallback(async (chapterToPreload) => {
        if (!chapterToPreload) return;
        
        try {
            const data = await BoMOnlineAPI({read: chapterToPreload});
            const mainKey = Object.keys(data.read)[0];
            const chapterData = data.read[mainKey];
            
            if (chapterData) {
                const chapterVerseIds = lookupReference(chapterToPreload, lang).verse_ids;
                setPreloadedChapter({
                    ref: chapterToPreload,
                    data: chapterData,
                    verseIds: chapterVerseIds
                });
            }
        } catch (error) {
            console.error('Error preloading next chapter:', error);
        }
    }, []); // Empty dependencies since this function doesn't depend on any state

    // Load next chapter for infinite scroll - use preloaded if available
    const loadNextChapter = useCallback(async () => {
        if (isLoadingNext || !nextChapterRef) return;
        
        setIsLoadingNext(true);
        
        try {
            let chapterToAdd;
            
            // Use preloaded chapter if it matches what we need
            if (preloadedChapter && preloadedChapter.ref === nextChapterRef) {
                chapterToAdd = preloadedChapter;
                setPreloadedChapter(null); // Clear preloaded chapter since we're using it
            } else {
                // Load chapter if not preloaded
                const data = await BoMOnlineAPI({read: nextChapterRef});
                const mainKey = Object.keys(data.read)[0];
                const nextChapterData = data.read[mainKey];
                
                if (nextChapterData) {
                    const nextChapterVerseIds = lookupReference(nextChapterRef, lang).verse_ids;
                    chapterToAdd = {
                        ref: nextChapterRef,
                        data: nextChapterData,
                        verseIds: nextChapterVerseIds
                    };
                }
            }
            
            if (chapterToAdd) {
                setAllChapters(prev => [...prev, chapterToAdd]);
                
                // Update next chapter reference for subsequent loads
                const { nextChapter } = getPrevNextChapter(chapterToAdd.verseIds);
                setNextChapterRef(nextChapter);
                
                // Immediately preload the new next chapter
                if (nextChapter) {
                    preloadNextChapter(nextChapter);
                }
            }
        } catch (error) {
            console.error('Error loading next chapter:', error);
        } finally {
            setIsLoadingNext(false);
        }
    }, [isLoadingNext, nextChapterRef, preloadedChapter]); // Removed preloadNextChapter since it's now stable

    // Handle explicit chapter navigation from grid - clear all content and reset
    const handleExplicitChapterNavigation = useCallback(() => {
        // Clear all infinite scroll content
        setAllChapters([]);
        setPreloadedChapter(null);
        setContent(null);
        setIsLoadingNext(false);
        setIsScrolling(false);
        
        // Clear any scroll timeout
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        
        // Scroll to top
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        //console.log("Reinitializing");
        const { 
            initChapterRef: newInitChapterRef, 
            initHighlightedVerses: newInitHighlightedVerses, 
            initNextChapter: newInitNextChapter, 
            initPrevChapter: newInitPrevChapter ,
            chapterVerseIds: newChapterVerseIds
        } = reInit(match);

        if (prevInitChapterRef.current !== newInitChapterRef) {

            setChapterRef(newInitChapterRef || generateReference(lookupReference("1Ne1").verse_ids, lang).trim());
            setActiveChapterRef(newInitChapterRef || generateReference(lookupReference("1Ne1").verse_ids, lang).trim());
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



    // add listener to to keyboard left right arrows to got next and previous
    const handleKeyDown = useCallback((e) => {
        if (e.key === "ArrowRight") {
            goToNextChapter();
        } else if (e.key === "ArrowLeft") {
            goToPreviousChapter();
        }
        //or tab
        if (e.key === "ArrowDown" || e.key === "Tab" || e.key === "ArrowUp") {
            e.preventDefault();

            const direction = e.key === "ArrowUp" ? -1 : 1;
            let highlightedVersesFromDom = [...document.querySelectorAll(".highlighted")].map((el) => {
                const match = el.className.match(/verse_(\d+)/);
                return match ? parseInt(match[1]) : null;
            }).filter(Boolean);
    
            const maxVerse = highlightedVersesFromDom.length ? Math.max(...highlightedVersesFromDom) : 0;

            const nextVerse = maxVerse ? maxVerse + direction : chapterVerseIds?.[0] || 1;
            const goTo = chapterVerseIds.includes(nextVerse) ? nextVerse : chapterVerseIds?.[0] || 1;
            const classNameGoto = `verse_${goTo}`;
            const goToDom = document.querySelector(`.${classNameGoto}`);
            if (goToDom) {
                goToDom.scrollIntoView({ behavior: "smooth", block: "center" });
                goToDom.click();
            } else {
                console.error("Verse not found:", classNameGoto);
            }
    
        }

        //escape clear highlighted verse
        if (e.key === "Escape") {
           const slug = slugify(activeChapterRef);
              history.push(`/read/${slug}`);
        }
    }, [goToNextChapter, goToPreviousChapter, activeChapterRef, history, chapterVerseIds]);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        }
    }, [handleKeyDown, activeChapterRef, history]);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        if (!nextButtonRef.current) return;

        const options = {
            root: null,
            rootMargin: '50px', // Reduced margin so it only triggers closer to button
            threshold: 0.1
        };

        observerRef.current = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && !isLoadingNext) {
                    // Only trigger if user has actually scrolled (not just short content)
                    const hasScrolled = window.scrollY > 100; // At least 100px of scroll
                    if (hasScrolled) {
                        loadNextChapter();
                    }
                }
            });
        }, options);

        observerRef.current.observe(nextButtonRef.current);

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [loadNextChapter, isLoadingNext]);

    // Scroll event listener for bottom detection and scroll state tracking
    useEffect(() => {
        const handleScroll = () => {
            // Set scrolling state
            setIsScrolling(true);
            
            // Clear existing timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            
            // Set timeout to detect when scrolling stops
            scrollTimeoutRef.current = setTimeout(() => {
                setIsScrolling(false);
            }, 150); // 150ms after scrolling stops
            
            const scrollHeight = document.documentElement.scrollHeight;
            const scrollTop = document.documentElement.scrollTop;
            const clientHeight = document.documentElement.clientHeight;
            
            // Only trigger if there's substantial content to scroll through
            const contentHeight = scrollHeight - clientHeight;
            const hasSubstantialContent = contentHeight > 200; // At least 200px of scrollable content
            
            // Trigger load when user is near bottom (within 100px) AND has scrolled substantially
            if (hasSubstantialContent && scrollHeight - scrollTop - clientHeight < 100 && !isLoadingNext) {
                loadNextChapter();
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [loadNextChapter, isLoadingNext]);

    // Observer for tracking which chapter is currently in view (for URL updates)
    useEffect(() => {
        const options = {
            root: null,
            rootMargin: '-50% 0px -50% 0px', // Trigger when chapter is in center of viewport
            threshold: 0
        };

        chapterObserverRef.current = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const chapterContainer = entry.target;
                    const chapterRefFromContainer = chapterContainer.dataset.chapterRef;
                    if (chapterRefFromContainer && chapterRefFromContainer !== activeChapterRef) {
                        // Update active chapter state
                        setActiveChapterRef(chapterRefFromContainer);
                        
                        // Update URL without triggering content reload - use replace to avoid navigation
                        const currentSlug = window.location.pathname.replace(/^\/read\//, "");
                        const newSlug = slugify(chapterRefFromContainer);
                        if (newSlug && newSlug !== currentSlug) {
                            // Use window.history directly to avoid React Router triggers
                            window.history.replaceState(null, "", `/read/${newSlug}`);
                            document.title = chapterRefFromContainer;
                        }
                    }
                }
            });
        }, options);

        // Observe all chapter containers
        const chapterContainers = document.querySelectorAll('.chapter-container');
        chapterContainers.forEach(container => {
            chapterObserverRef.current.observe(container);
        });

        return () => {
            if (chapterObserverRef.current) {
                chapterObserverRef.current.disconnect();
            }
        };
    }, [allChapters, content, activeChapterRef]); // Removed history and match.url to avoid triggers

    //scroll to highlighted verse on load
    useEffect(() => {
        // Don't auto-scroll to verses during infinite scroll - only on initial page load
        if (allChapters.length > 0) return; // Skip if infinite scroll has loaded additional chapters
        
        const highlightedVersesFromDom = [...document.querySelectorAll(".highlighted")].map((el) => {
            const match = el.className.match(/verse_(\d+)/);
            return match ? parseInt(match[1]) : null;
        }).filter(Boolean);

        const maxVerse = highlightedVersesFromDom.length ? Math.max(...highlightedVersesFromDom) : 0;
        const classNameGoto = `verse_${maxVerse}`;
        const goToDom = document.querySelector(`.${classNameGoto}`);
        if (goToDom) {
            goToDom.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
            //console.error("Verse not found:", classNameGoto);
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
        ].filter(chapter => chapter.data); // Filter out null/undefined data

        return <div className="read-content" ref={readContentRef}>
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
                )} </div>
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
                )} </div>
            
            {/* Render all chapters */}
            {allChapterData.map((chapterItem, chapterIndex) => (
                <div key={chapterItem.ref} className="chapter-container" data-chapter-ref={chapterItem.ref}>
                    {(chapterItem.data && !DEBUG_SKELETON) ? chapterItem.data.sections?.map((section, index) => {
                        return <div key={`${chapterItem.ref}-${index}`} className="read-section">
                            <div className="read-section-header">
                                <h4>{section.heading?.replace(/｢\d+｣/g, "").trim()}</h4>
                                <p><Link to={`/study/${slugify(getEnglishReference(section.ref))}`}>
                        
                                {section.ref}<button className="btn btn-sm btn-outline-secondary" >{label("study_button")}</button></Link></p>    
                            </div>                      
                            {section.blocks.map((block, index) => { 
                                const blockLineWordCount = block.lines.reduce((acc, line) => {
                                    return acc + line.text?.split(" ").length || 0;
                                }, 0);
                                const specialClass = blockLineWordCount > 150 ? "split" : "";
                                const paragraphs = [];
                                let paragraphCursor = 0;
                                for(let line of block.lines) {
                                    if(/¶/.test(line.format) && paragraphs.length > 0) paragraphCursor++;
                                    if(/i/.test(line.format)) line.class = "italic";
                                    if(/§/.test(line.format)) line.class = "heading";
                                    if(!line.format) line.class = "normal";
                                    if(!paragraphs[paragraphCursor]) paragraphs[paragraphCursor] = [];
                                    paragraphs[paragraphCursor].push(line);
                                }

                                const handleImgClick = (e) => {
                                        appController.functions.setPopUp({ type: "people", ids: [block.person_slug],
                                            underSlug: "read/" + slugify(activeChapterRef) });
                                        
                                }
                                return <div key={`${chapterItem.ref}-${index}`} className="read-block">
                                    <div className="left-gutter">
                                        <img alt={block.voice} src={assetUrl + `/people/${block.person_slug}`} onClick={handleImgClick} />
                                        <div className="read-voice"  onClick={handleImgClick} >{label(block.voice)}</div>
                                    </div>
                                    <div className="main-content">

                                    {paragraphs?.map((p, pIndex) => <p key={pIndex} className={`read-scripture ${specialClass} ${p?.[0]?.class || ""}`}>{p?.map((line, index) => {

                                        const lineVerseId = line.verse_id;

                                        const verseIsHighlighted = Array.isArray(highlightedVerses) && highlightedVerses?.includes(lineVerseId);
                                        const verseIsHovered = lineVerseId === hoveredVerse;

                                        const lineClass = `verse_`+lineVerseId +  " " +`${line.class || ""} ${verseIsHighlighted ? "highlighted" : ""} ${verseIsHovered ? "hovered" : ""}`;


                                        const slugToVerse = verseIdToSlug([lineVerseId]);

                                        return <Link key={index} className={lineClass}
                                            to={`/read/${slugToVerse}`}
                                            onMouseEnter={() => {
                                                setHoveredVerse(lineVerseId);
                                            }}
                                            onMouseLeave={() => setHoveredVerse(null)}
                                        
                                        ><sup>{line.verse_num}</sup>{line.text}</Link>
                                    })}</p>)}
                                    </div>
                                    
                                </div>

                            })}
                        </div>
                    } ) : (!chapterItem.data && !DEBUG_SKELETON) && <SkeletonLoader />}
                </div>
            ))}
            
            {/* Show skeleton loader if no content at all */}
            {(!readData && allChapters.length === 0 && !DEBUG_SKELETON) && <SkeletonLoader />}
            
            {/* Single centered Next button */}
            { !!readData && !DEBUG_SKELETON && (
                <div className="read-section-footer" >
                    {nextChapterRef ? (
                        <button 
                            ref={nextButtonRef}
                            onClick={loadNextChapter} 
                            className="btn btn-primary btn-lg"
                            disabled={isLoadingNext || isScrolling}
                            style={{ minWidth: '200px' }}
                        >
                            {isLoadingNext ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>

                                </>
                            ) : isScrolling ? (
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
    }


    // Separate effect for handling URL-based navigation (when user actually navigates to a new page)
    useEffect(() => {
        const urlSlug = match.url?.replace(/^\/read\//, "");
        const currentBaseChapter = content ? chapterRef : null;
        
        // Only reload content if this is a completely new navigation (not from infinite scroll)
        // Check if the URL represents a chapter that's not already loaded
        const isNewNavigation = currentBaseChapter && !allChapters.some(ch => slugify(ch.ref) === urlSlug) && slugify(currentBaseChapter) !== urlSlug;
        
        if (isNewNavigation || !content) {
            let loaderTimeout = setTimeout(() => {setContent(null);}, 200);
            document.title = chapterRef;
            
            // Only scroll to top and clear chapters for true navigation
            if (isNewNavigation) {
                // Don't auto-scroll to top for infinite scroll - let user maintain their position
                // window.scrollTo(0, 0);
                setAllChapters([]);
                setPreloadedChapter(null); // Clear preloaded chapter on new navigation
            }
            
            BoMOnlineAPI({read: chapterRef}).then((data) => {
                clearTimeout(loaderTimeout);
                const mainKey = Object.keys(data.read)[0];
                setContent(data.read[mainKey]);
                localStorage.setItem("chapterRef", chapterRef);
                
                // Preload next chapter immediately after main content loads
                if (nextChapterRef) {
                    preloadNextChapter(nextChapterRef);
                }
            });
            
            return () => clearTimeout(loaderTimeout);
        }
    }, [match.params, nextChapterRef, preloadNextChapter]); // Added dependencies for preload
    
    // Separate effect for handling highlighted verses from URL
    useEffect(() => {
        const urlSlug = match.url?.replace(/^\/read\//, "");
        const idealSlug = highlightedVerses ? verseIdToSlug(highlightedVerses) : slugify(activeChapterRef);
        
        if(idealSlug && idealSlug !== urlSlug && highlightedVerses) {
            history.push(`/read/${idealSlug}`);
        }
    }, [highlightedVerses, activeChapterRef]);

    


    return (<div className="container" style={{ display: 'block' }}>
        <div id="page" className="read">
          {buildContent(content, { chapterRef, nextChapterRef, prevChapterRef })}
        </div></div>
      )


}


function ChapterNav({ chapterRef, onChapterClick }) {
    const history = useHistory();
    const chapterCounts = [22,33,7,1,1,1,1,29,63,16,30,1,9,15,10];
    const book_keys = ["1_ne", "2_ne", "jacob", "enos", "jarom", "omni", "w_of_m", "mosiah", "alma", "helaman", "3_ne", "4_ne", "mormon", "ether", "moroni"];
    
    // Static references that don't change
    const bookNames = React.useMemo(() => book_keys.map((book) => label(book)), []);
    const bookFirsts = React.useMemo(() => book_keys.map((book) => `${book}_first`).map(i=>label(i)), []);

    // Memoize the current chapter's first verse ID to avoid repeated lookups
    const currentChapterFirstVerseId = React.useMemo(() => {
        try {
            return lookupReference(chapterRef, lang).verse_ids[0];
        } catch (error) {
            console.error("Error looking up current chapter reference:", chapterRef, error);
            return null;
        }
    }, [chapterRef]);

    // Memoize all chapter verse IDs with efficient caching
    const allChapterVerseIds = React.useMemo(() => {
        const chapterVerseMap = new Map();
        let bookIndex = 0;
        
        for(let bookChapterCount of chapterCounts) {
            const book = bookNames[bookIndex++];
            for(let i=1; i<=bookChapterCount; i++) {
                const chapter = `${book} ${i}`;
                try {
                    const verseIds = lookupReference(chapter, lang).verse_ids;
                    chapterVerseMap.set(chapter, verseIds[0]);
                } catch (error) {
                    console.error("Error looking up chapter reference:", chapter, error);
                    chapterVerseMap.set(chapter, null);
                }
            }
        }
        return chapterVerseMap;
    }, [bookNames]); // Only recalculate when bookNames change (which should be never)

    const boxes = [];
    let j = 0;
    for(let bookChapterCount of chapterCounts) {
        const book = bookNames[j++];
        const firstLetterOfBook = bookFirsts[j-1];
        for(let i=1; i<=bookChapterCount; i++) {
            const chapter = `${book} ${i}`;
            const boxChapterRef = chapter;//`${slugify(chapter)}`;
            const isFirst = i === 1;
            const boxChapterFirstVerseId = allChapterVerseIds.get(chapter);
            const isActive = boxChapterFirstVerseId && currentChapterFirstVerseId && boxChapterFirstVerseId === currentChapterFirstVerseId;
            
            const handleChapterClick = (e) => {
                e.preventDefault();
                if (onChapterClick) {
                    onChapterClick();
                }
                history.push(`/read/${slugify(boxChapterRef)}`);
            };
            
            boxes.push(<Link to={`/read/${slugify(boxChapterRef)}`}
                onClick={handleChapterClick}
                className={`chapter-box ${isFirst ? "first" : ""} ${isActive ? "active" : ""}`}
                data-tip={chapter}
                data-for="chapter-nav-tip"
                key={`${book}-${i}`}
            >{isFirst ? firstLetterOfBook : i}
            </Link>)
        }
    }

    return <div className="chapter-nav">
        <ReactTooltip id="chapter-nav-tip" place="top" effect="solid" />
        {boxes}
    </div>
}