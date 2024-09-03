import { useRouteMatch, Link, useHistory } from "react-router-dom";
import "./Read.css";
import React, { useState, useEffect, useCallback } from "react";
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



export default function ReadScripture({ appController }) {

    //react router
    const match = useRouteMatch();
    const { params } = match;
    const fullReference = params?.verseNum ? `${params.bookCh}:${params.verseNum}` : params?.value;
    const fullVerseIds = lookupReference(params?.verseNum ? `${params.bookCh}` : params?.value).verse_ids;
    const initHighlightedVerse = params?.verseNum ? lookupReference(fullReference).verse_ids[0] : null;
    const chapterRef = generateReference(fullVerseIds);

    const history = useHistory();
    const [content, setContent] = useState(null);


    const refFromUrl = match.params?.value?.replace(/\//g, ":");
    const hasVerse = /:/.test(refFromUrl);

    const [highlightedVerse, setHighlightedVerse] = useState(initHighlightedVerse);
    const [hoveredVerse, setHoveredVerse] = useState(null);
    
    // add listener to to keyboard left right arrows to got next and previous
    const handleKeyDown = useCallback((e) => {
        if (e.key === "ArrowRight") {
            const next = document.querySelector(".read-section-footer a:last-child");
            if (next) {
                next.click();
            }
        } else if (e.key === "ArrowLeft") {
            const prev = document.querySelector(".read-section-footer a:first-child");
            if (prev) {
                prev.click();
            }
        }
        //up down arrows increment highlighted verse, if none then start at first verse
        //TODO FIX ME
        if (e.key === "ArrowUp") {
            const verseIndex = fullVerseIds.indexOf(highlightedVerse);
            const nextVerse = fullVerseIds[verseIndex - 1] || fullVerseIds[0];
            setHighlightedVerse(nextVerse);
        }
        if (e.key === "ArrowDown") {
            const verseIndex = fullVerseIds.indexOf(highlightedVerse);
            const nextVerse = fullVerseIds[verseIndex + 1] || fullVerseIds[fullVerseIds.length - 1];
            setHighlightedVerse(nextVerse);
        }

        //escape clear highlighted verse
        if (e.key === "Escape") {
            setHighlightedVerse(null);
            history.push(`/read/${slugify(chapterRef)}`);
            //update title
            document.title = chapterRef;
        }
    }, []);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        }
    }, [handleKeyDown]);
    
    useEffect(() => {
        if(!highlightedVerse) return 
        const highlightedref = generateReference(highlightedVerse);
        const [bookchapter,verse] = highlightedref.split(":");

        history.push(`/read/${slugify(getEnglishReference(bookchapter))}/${verse}`);
        document.title = chapterRef + ":" + verse;

    }, [highlightedVerse]);


    const buildContent = (readData) => {
        if (readData) {


            const prevSlug = slugify(getEnglishReference(readData.prev_ref));
            const nextSlug = slugify(getEnglishReference(readData.next_ref));

            return <div className="read-content">
                <div className="read-header-nav">
                    {prevSlug ? (
                        <Link to={`/read/${prevSlug}`} className="btn btn-primary">
                            ◀ {readData.prev_ref}
                        </Link>
                        ) : (
                        <button className="btn btn-primary disabled" disabled>
                            ◀ {readData.prev_ref}
                        </button>
                        )}
                        <h3 className="title lg-4 text-center">{readData.ref}</h3>
                    {nextSlug ? (
                      <Link to={`/read/${nextSlug}`} className="btn btn-primary">
                        {readData.next_ref} ▶
                      </Link>
                    ) : (
                      <button className="btn btn-primary disabled" disabled>
                        {readData.next_ref} ▶
                      </button>
                    )} </div>
                <ChapterNav chapterRef={chapterRef} />
                {readData.sections.map((section, index) => {
                    return <div key={index} className="read-section">
                        <div className="read-section-header">
                            <h4>{section.heading.replace(/｢\d+｣/g, "").trim()}</h4>
                            <p><Link to={`/study/${slugify(getEnglishReference(section.ref))}`}>{section.ref}</Link></p>
                        </div>                      
                        {section.blocks.map((block, index) => { 
                            const blockLineWordCount = block.lines.reduce((acc, line) => {
                                return acc + line.text.split(" ").length;
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
                                    <div className="read-voice"
                                     onClick={handleImgClick}
                                    >{label(block.voice)}</div>
                                </div>
                                <div className="main-content">

                                {paragraphs?.map(p=><p className={`read-scripture ${specialClass} ${p?.[0]?.class || ""}`}>{p?.map((line, index) => {

                                    const lineVerseId = line.verse_id;
                                    const lineClass = lineVerseId === highlightedVerse ? "highlighted" : lineVerseId === hoveredVerse ? "hovered" : "";
                                    return <span key={index} className={lineClass}
                                        onClick={() => setHighlightedVerse(lineVerseId)} 
                                        onMouseEnter={() => {
                                            setHoveredVerse(lineVerseId);
                                        }}
                                        onMouseLeave={() => setHoveredVerse(null)}
                                    
                                    ><sup>{line.verse_num}</sup>{line.text}</span>
                                })}</p>)}
                                </div>
                                
                            </div>

                        })}
                    </div>
                })}
                <div className="read-section-footer">
                    {prevSlug ? (
                        <Link to={`/read/${prevSlug}`} className="btn btn-primary">
                            ◀ {readData.prev_ref}
                        </Link>
                        ) : (
                        <button className="btn btn-primary disabled" disabled>
                            ◀ {readData.prev_ref}
                        </button>
                        )}
                    {nextSlug ? (
                      <Link to={`/read/${nextSlug}`} className="btn btn-primary">
                        {readData.next_ref} ▶
                      </Link>
                    ) : (
                      <button className="btn btn-primary disabled" disabled>
                        {readData.next_ref} ▶
                      </button>
                    )}
                </div>
            </div>
        } else {
            return <Loader />
        }
    }


    useEffect(() => {
        
        let loaderTimeout;
    
        loaderTimeout = setTimeout(() => {
            setContent(null);
        }, 200);
        
        document.title = chapterRef || "1 Nephi 1";
        BoMOnlineAPI({read: chapterRef || "1 Nephi 1"}).then((data) => {
            clearTimeout(loaderTimeout);
            const mainKey = Object.keys(data.read)[0];
            setContent(data.read[mainKey]);
            //scroll to top
            window.scrollTo(0, 0);
        });
    
        return () => clearTimeout(loaderTimeout);
    }, [match?.params?.value]);


    return (<div className="container" style={{ display: 'block' }}>
        <div id="page" className="read">
          {content ? buildContent(content) : <Loader />}
        </div></div>
      )


}


function ChapterNav({ chapterRef }) {

    const chapterCounts = [22,33,7,1,1,1,1,29,63,16,30,1,9,15,10];
    const bookNames = ["1 Nephi", "2 Nephi", "Jacob", "Enos", "Jarom", "Omni", "Words of Mormon", "Mosiah", "Alma", "Helaman", "3 Nephi", "4 Nephi", "Mormon", "Ether", "Moroni"];

    const boxes = [];
    let j = 0;
    for(let bookChapterCount of chapterCounts) {
        const book = bookNames[j++];
        for(let i=1; i<=bookChapterCount; i++) {
            const chapter = `${book} ${i}`;
            const boxChapterRef = `${slugify(chapter)}`;
            const isFirst = i === 1;
            const firstLetterOfBook = book?.[0].toUpperCase() || i;
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