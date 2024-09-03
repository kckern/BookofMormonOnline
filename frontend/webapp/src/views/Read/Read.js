import { useRouteMatch, Link, useHistory } from "react-router-dom";
import "./Read.css";
import React, { useState, useEffect, useCallback } from "react";
import Loader from "../_Common/Loader";
import BoMOnlineAPI, { assetUrl } from "../../models/BoMOnlineAPI";
import { generateReference, lookupReference } from "scripture-guide";
import ReactTooltip from "react-tooltip";
import ReactAudioPlayer from "react-audio-player";

const slugify = (text) => {
    if(!text) return null;
    const slug = text.toLowerCase().replace(/ /g, ".").replace(/:/g, ".").replace(/[.]+/g, ".").replace(/[^a-z0-9.-]/g, "");
    return slug;

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
    const [showAudioPlayer, setShowAudioPlayer] = useState(false);

    const [activeText, setActiveText] = useState([]);

    const readController = {
        functions: {
            setHighlightedVerse,
            setHoveredVerse,
            setShowAudioPlayer,
        },
        states: {
            fullVerseIds,
            highlightedVerse,
            hoveredVerse,
            activeText,
            showAudioPlayer
        }
    }


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

        history.push(`/read/${slugify(bookchapter)}/${verse}`);
        document.title = chapterRef + ":" + verse;

        const activeLines = content?.sections.map(section => {
            return section.blocks.map(block => {
                return block.lines.filter(line => line.verse_id === highlightedVerse);
            });
        }).flat(2).flat(2) || [];
        setActiveText(activeLines);


    }, [highlightedVerse]);


    const buildContent = (readData) => {
        if (readData) {


            const prevSlug = slugify(readData.prev_ref);
            const nextSlug = slugify(readData.next_ref);

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
                <button className="btn btn-primary" onClick={() => setShowAudioPlayer(!showAudioPlayer)}>Audio</button>
                {readData.sections.map((section, index) => {
                    return <div key={index} className="read-section">
                        <div className="read-section-header">
                            <h4>{section.heading.replace(/｢\d+｣/g, "").trim()}</h4>
                            <p><Link to={`/study/${slugify(section.ref)}`}>{section.ref}</Link></p>
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
                                    >{block.voice}</div>
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
          <ReadAudioPlayer readController={readController} />
        </div>
        
        </div>
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


function ReadAudioPlayer({ readController }) {

    const {highlightedVerse,fullVerseIds,activeText} = readController.states;
    const {setShowAudioPlayer, setHighlightedVerse} = readController.functions;

    const [audioDuration, setAudioDuration] = useState(0);

    const handleXClick = () =>  setShowAudioPlayer(false);

    const audioUrl = highlightedVerse ? assetUrl + "/audio/verses/en-legacy/" + highlightedVerse + ".mp3" : null;

    const handleAudioEnd = () => {
        const verseIndex = fullVerseIds.indexOf(highlightedVerse);
        const nextVerse = fullVerseIds[verseIndex + 1] || null;
        if(nextVerse) setHighlightedVerse(nextVerse);
        else setShowAudioPlayer(false);
    }   

    const [timecode, setTimecode] = useState(0);

    const textArray = activeText.map(line => line.text.split(/([^A-z]+)/g)).flat().filter(Boolean);
    const wordCount = textArray.filter(i=>/^[A-z]+$/.test(i)).length;
    const secondsPerWord = (audioDuration / wordCount) /2;
    let currentWordIndex = Math.floor((timecode / secondsPerWord) || 0) || 0;
    currentWordIndex = currentWordIndex % 2 !== 0 ? currentWordIndex - 1 : currentWordIndex;
  


    return <div className={`readAudioPlayerContainer ${readController.states.showAudioPlayer ? "show" : ""}`}>
            <div className="readAudioPlayer">
                <button onClick={handleXClick} className="close">X</button>
                    <p>{textArray.map((word, index) => {
                        const isCurrentWord = index === currentWordIndex;
                        return <span className={isCurrentWord ? "current" : ""}>{word}</span>
                    })}</p>
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


}