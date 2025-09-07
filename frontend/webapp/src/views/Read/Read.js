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
    const [chapterRef, setChapterRef] = useState(initChapterRef);
    const [highlightedVerses, setHighlightedVerses] = useState(initHighlightedVerses);
    const [hoveredVerse, setHoveredVerse] = useState(null);
    const [nextChapterRef, setNextChapterRef] = useState(initNextChapter);
    const [prevChapterRef, setPrevChapterRef] = useState(initPrevChapter);
    const [chapterVerseIds, setChapterVerseIds] = useState(initChapterVerseIds);

    // Touch/swipe state - only for horizontal swipes
    const [touchStart, setTouchStart] = useState(null);
    const [isHorizontalSwipe, setIsHorizontalSwipe] = useState(false);

    const prevInitChapterRef = useRef(initChapterRef);
    const prevInitHighlightedVerses = useRef(initHighlightedVerses);
    const readContentRef = useRef(null);

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
           const slug = slugify(chapterRef);
              history.push(`/read/${slug}`);
        }
    }, [goToNextChapter, goToPreviousChapter, chapterRef, history, chapterVerseIds]);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        }
    }, [handleKeyDown, chapterRef, history]);

    // Smart swipe handling - only intercepts clear horizontal swipes
    const handleTouchStart = useCallback((e) => {
        setTouchStart({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY,
            time: Date.now()
        });
        setIsHorizontalSwipe(false);
    }, []);

    const handleTouchMove = useCallback((e) => {
        if (!touchStart || isHorizontalSwipe) return;
        
        const currentX = e.targetTouches[0].clientX;
        const currentY = e.targetTouches[0].clientY;
        
        const deltaX = Math.abs(currentX - touchStart.x);
        const deltaY = Math.abs(currentY - touchStart.y);
        
        // Only consider it a swipe if horizontal movement is significantly greater than vertical
        // AND we've moved at least 15px horizontally
        if (deltaX > 15 && deltaX > deltaY * 2) {
            setIsHorizontalSwipe(true);
            // Prevent scrolling only when we're sure it's a horizontal swipe
            e.preventDefault();
        }
    }, [touchStart, isHorizontalSwipe]);

    const handleTouchEnd = useCallback((e) => {
        if (!touchStart || !isHorizontalSwipe) {
            setTouchStart(null);
            setIsHorizontalSwipe(false);
            return;
        }
        
        const endX = e.changedTouches[0].clientX;
        const distance = touchStart.x - endX;
        const timeDiff = Date.now() - touchStart.time;
        
        // Only trigger if it's a fast swipe (< 300ms) with significant distance
        if (timeDiff < 300 && Math.abs(distance) > 50) {
            if (distance > 0) {
                // Left swipe - go to next chapter
                goToNextChapter();
            } else {
                // Right swipe - go to previous chapter  
                goToPreviousChapter();
            }
        }
        
        setTouchStart(null);
        setIsHorizontalSwipe(false);
    }, [touchStart, isHorizontalSwipe, goToNextChapter, goToPreviousChapter]);

    // Add touch event listeners to each section
    useEffect(() => {
        const sections = document.querySelectorAll('.read-section');
        
        sections.forEach(section => {
            section.addEventListener('touchstart', handleTouchStart, { passive: true });
            section.addEventListener('touchmove', handleTouchMove, { passive: false });
            section.addEventListener('touchend', handleTouchEnd, { passive: true });
        });

        return () => {
            sections.forEach(section => {
                section.removeEventListener('touchstart', handleTouchStart);
                section.removeEventListener('touchmove', handleTouchMove);
                section.removeEventListener('touchend', handleTouchEnd);
            });
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd, content]); // Re-run when content changes

    //scroll to highlighted verse on load
    useEffect(() => {
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
    }, [highlightedVerses, chapterRef]);
    


    const buildContent = (readData, { chapterRef, nextChapterRef, prevChapterRef }) => {
        const prevRef = readData?.prev_ref || prevChapterRef;
        const nextRef = readData?.next_ref || nextChapterRef;
        const ref = readData?.ref || chapterRef;

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
            <ChapterNav chapterRef={chapterRef} />
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
            {(readData && !DEBUG_SKELETON) ? readData.sections?.map((section, index) => {
                return <div key={index} className="read-section">
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
                                    underSlug: "read/" + slugify(chapterRef) });
                                
                        }
                        return <div key={index} className="read-block">
                            <div className="left-gutter">
                                <img alt={block.voice} src={assetUrl + `/people/${block.person_slug}`} onClick={handleImgClick} />
                                <div className="read-voice"  onClick={handleImgClick} >{label(block.voice)}</div>
                            </div>
                            <div className="main-content">

                            {paragraphs?.map(p=><p className={`read-scripture ${specialClass} ${p?.[0]?.class || ""}`}>{p?.map((line, index) => {

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
            } ) : <SkeletonLoader />}
            { !!readData && !DEBUG_SKELETON && <div className="read-section-footer">
                {prevRef ? (
                    <button onClick={goToPreviousChapter} className="btn btn-primary">
                        ◀ {prevRef}
                    </button>
                    ) : (
                    <button className="btn btn-primary disabled" disabled>
                        ◀ {prevRef}
                    </button>
                    )}
                {nextRef ? (
                    <button onClick={goToNextChapter} className="btn btn-primary">
                    {nextRef} ▶
                    </button>
                ) : (
                    <button className="btn btn-primary disabled" disabled>
                    {nextRef} ▶
                    </button>
                )}
            </div> }
        </div>
    }


    useEffect((prevChapterRef) => {

        const urlSlug = match.url?.replace(/^\/read\//, "");
        const idealSlug = highlightedVerses ? verseIdToSlug(highlightedVerses) : slugify(chapterRef);
        if(idealSlug && idealSlug !== urlSlug) history.push(`/read/${idealSlug}`);
        let loaderTimeout;
        loaderTimeout = setTimeout(() => {setContent(null);}, 200);
        document.title = chapterRef;
        
        //scroll to top immediately when navigation starts
        window.scrollTo(0, 0);
        
        BoMOnlineAPI({read: chapterRef}).then((data) => {
            clearTimeout(loaderTimeout);
            const mainKey = Object.keys(data.read)[0];
            setContent(data.read[mainKey]);
            //save chapterRef to local storage
            localStorage.setItem("chapterRef", chapterRef);
            //reset highlighted verse if not in URL
            const newHighlightedVerses = !prevChapterRef ? highlightedVerses : prevChapterRef === chapterRef ? highlightedVerses : null;
            setHighlightedVerses(newHighlightedVerses);
        });
    
        return () => clearTimeout(loaderTimeout);
    }, [chapterRef]);

    


    return (<div className="container" style={{ display: 'block' }}>
        <div id="page" className="read">
          {buildContent(content, { chapterRef, nextChapterRef, prevChapterRef })}
        </div></div>
      )


}


function ChapterNav({ chapterRef }) {
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
            boxes.push(<Link to={`/read/${slugify(boxChapterRef)}`}
                className={`chapter-box ${isFirst ? "first" : ""} ${isActive ? "active" : ""}`}
                data-tip={chapter}
                data-for="chapter-nav-tip"
            >{isFirst ? firstLetterOfBook : i}
            </Link>)
        }
    }

    return <div className="chapter-nav">
        <ReactTooltip id="chapter-nav-tip" place="top" effect="solid" />
        {boxes}
    </div>
}