import { useRouteMatch, Link, useHistory } from "react-router-dom";
import "./Read.css";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Loader from "../_Common/Loader";
import BoMOnlineAPI, { assetUrl } from "../../models/BoMOnlineAPI";
import { generateReference, lookupReference, setLanguage } from "scripture-guide";
import ReactTooltip from "react-tooltip";
import { determineLanguage, label } from "../../models/Utils";

const slugify = (text,verse_ids) => {
    if(!text) return null;
    const hasAlpha = /[a-z]/.test(text.toLowerCase());
    if(hasAlpha) return  text.toLowerCase().replace(/ /g, ".").replace(/:/g, ".").replace(/[.]+/g, ".").replace(/[^a-z0-9.-]/g, "");
    const slug = text.replace(/ /g, ".").replace(/:/g, ".").replace(/[-]+/g, "~");
    return slug;
}

const verseIdToSlug = (verseIds) => {
    const ref = generateReference(verseIds);
    return slugify(ref).replace(/[.](\d+$)/, "/$1");
}


const lang = determineLanguage();

const getEnglishReference = (ref) => {
    if(lang === "en") return ref;
    setLanguage(lang);
    const verse_ids = lookupReference(ref).verse_ids;
    setLanguage("en");
    const enref = generateReference(verse_ids);
    setLanguage(lang);
    return enref;
}

const getPrevNextChapter = (verse_ids) => {
    const nextVerseId = verse_ids[verse_ids.length - 1] + 1;
    const prevVerseId = verse_ids[0] - 1;
    const nextChapter = nextVerseId > 37706 ? null : generateReference([nextVerseId]).split(":")[0];
    const prevChapter = prevVerseId < 31103 ? null : generateReference([prevVerseId]).split(":")[0];
    return { nextChapter, prevChapter };
}


const reInit = (match) => {
    const { params } = match;
    const { bookCh, verseNum } = params;
    const modifiedBookCh = bookCh?.replace(/[.]/g, " ") || "1 Nephi 1";
    const urlSlug = match.url?.replace(/^\/read\//, "");
    setLanguage(lang || "en");

    const fullReference = verseNum ? `${modifiedBookCh}:${verseNum}` : modifiedBookCh;
    const initChapterVerseIds = lookupReference(modifiedBookCh).verse_ids;
    const initHighlightedVerses = verseNum ? lookupReference(fullReference).verse_ids : null;
    const initChapterRef = modifiedBookCh ? generateReference(initChapterVerseIds) : window.localStorage.getItem("chapterRef") || "1 Nephi 1";
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

    const prevInitChapterRef = useRef(initChapterRef);
    const prevInitHighlightedVerses = useRef(initHighlightedVerses);

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
            setChapterRef(newInitChapterRef);
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

            const next = document.querySelector(".read-section-footer a:last-child");
            if (next) next.click();
        
        } else if (e.key === "ArrowLeft") {
                
                const prev = document.querySelector(".read-section-footer a:first-child");
                if (prev) prev.click();
           
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
    }, []);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        }
    }, [handleKeyDown, chapterRef, history]);


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

        const prevSlug = slugify(prevRef);
        const nextSlug = slugify(nextRef);

        return <div className="read-content">
            <div className="read-header-nav">
                {prevSlug ? (
                    <Link to={`/read/${prevSlug}`} className="btn btn-primary">
                        ◀ {prevRef}
                    </Link>
                    ) : (
                    <button className="btn btn-primary disabled" disabled>  ◀  </button>
                    )}
                    <h3 className="title lg-4 text-center">{ref}</h3>
                {nextSlug ? (
                    <Link to={`/read/${nextSlug}`} className="btn btn-primary">
                    {nextRef} ▶
                    </Link>
                ) : (
                    <button className="btn btn-primary disabled" disabled>  ▶ </button>
                )} </div>
            <ChapterNav chapterRef={chapterRef} />
            {readData ? readData.sections.map((section, index) => {
                return <div key={index} className="read-section">
                    <div className="read-section-header">
                        <h4>{section.heading.replace(/｢\d+｣/g, "").trim()}</h4>
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
            } ) : <Loader top={"30vh"} />}
            { !!readData && <div className="read-section-footer">
                {prevSlug ? (
                    <Link to={`/read/${prevSlug}`} className="btn btn-primary">
                        ◀ {prevRef}
                    </Link>
                    ) : (
                    <button className="btn btn-primary disabled" disabled>
                        ◀ {prevRef}
                    </button>
                    )}
                {nextSlug ? (
                    <Link to={`/read/${nextSlug}`} className="btn btn-primary">
                    {nextRef} ▶
                    </Link>
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
        BoMOnlineAPI({read: chapterRef}).then((data) => {
            clearTimeout(loaderTimeout);
            const mainKey = Object.keys(data.read)[0];
            setContent(data.read[mainKey]);
            //scroll to top
            window.scrollTo(0, 0);
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
    const bookNames = book_keys.map((book) => label(book));
    const bookFirsts = book_keys.map((book) => `${book}_first`).map(i=>label(i));


    const boxes = [];
    let j = 0;
    for(let bookChapterCount of chapterCounts) {
        const book = bookNames[j++];
        const firstLetterOfBook = bookFirsts[j-1];
        for(let i=1; i<=bookChapterCount; i++) {
            const chapter = `${book} ${i}`;
            const boxChapterRef = `${slugify(chapter)}`;
            const isFirst = i === 1;
            const isActive = slugify(chapterRef) === boxChapterRef;
            boxes.push(<Link to={`/read/${boxChapterRef}`}
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