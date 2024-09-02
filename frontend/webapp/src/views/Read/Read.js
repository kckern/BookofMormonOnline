import { useRouteMatch, Link } from "react-router-dom";
import "./Read.css";
import React, { useState, useEffect, useCallback } from "react";
import Loader from "../_Common/Loader";
import BoMOnlineAPI, { assetUrl } from "../../models/BoMOnlineAPI";

const slugify = (text) => {
    if(!text) return null;
    return text.toLowerCase().replace(/ /g, ".").replace(/:/g, ".").replace(/[.]+/g, ".").replace(/[^a-z0-9.]/g, "");
}

export default function ReadScripture({ appController }) {

    //react router
    const match = useRouteMatch();
    const [content, setContent] = useState(<Loader />);


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
    }, []);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        }
    }, [handleKeyDown]);
    


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
                
                {readData.sections.map((section, index) => {
                    return <div key={index} className="read-section">
                        <div className="read-section-header">
                            <h4>{section.heading.replace(/｢\d+｣/g, "").trim()}</h4>
                            <p>{section.ref}</p>
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


                            return <div key={index} className="read-block">
                                <div className="left-gutter">
                                    <img alt={block.voice} src={assetUrl + `/people/${block.person_slug}`} />
                                    <div className="read-voice">{block.voice}</div>
                                </div>
                                <div className="main-content">

                                {paragraphs?.map(p=><p className={`read-scripture ${specialClass} ${p[0].class}`}>{p?.map((line, index) => {



                                    return <span key={index}><sup>{line.verse_num}</sup>{line.text}</span>
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
        const slug = match.params?.value || "1Ne1";
        let loaderTimeout;
    
        loaderTimeout = setTimeout(() => {
            setContent(<Loader />);
        }, 100);
    
        BoMOnlineAPI({read: slug}).then((data) => {
            clearTimeout(loaderTimeout);
            const mainKey = Object.keys(data.read)[0];
            setContent(buildContent(data.read[mainKey]));
            //scroll to top
            window.scrollTo(0, 0);
        });
    
        return () => clearTimeout(loaderTimeout);
    }, [match?.params?.value]);


    return (<div className="container" style={{ display: 'block' }}>
        <div id="page" className="read">
          {content}
        </div></div>
      )


}