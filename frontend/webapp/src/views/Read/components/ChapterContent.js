import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { assetUrl } from '../../../models/BoMOnlineAPI';
import { slugify, getEnglishReference, verseIdToSlug } from '../../../utils/scriptureUtils';
import { label } from '../../../models/Utils';
import { useAppController } from "src/contexts/AppControllerContext";
import PassageNotes from '../PassageNotes';
import { HIDE_PASSAGE_NOTES } from "src/models/featureFlags";

// Feature flag: PassageNotes panels are gated OFF in prod builds (perf/design
// WIP); ON in dev/test. Source: config/features.yml -> HIDE_PASSAGE_NOTES.
const PASSAGE_NOTES_ENABLED = !HIDE_PASSAGE_NOTES;

const sectionPassageNotesKey = (chapterRef, sectionIndex, sectionRef) =>
    `${chapterRef}__section_${sectionIndex}_${(sectionRef || "").replace(/[^a-zA-Z0-9]/g, '_')}`;

const collectSectionVerseIds = (section) => {
    const ids = [];
    section.blocks?.forEach(block => {
        block.lines?.forEach(line => {
            if (line.verse_id && !ids.includes(line.verse_id)) ids.push(line.verse_id);
        });
    });
    return ids;
};

/**
 * Individual chapter content component
 * @param {Object} chapterItem - Chapter data with ref, data, and verseIds
 * @param {Array} highlightedVerses - Array of highlighted verse IDs
 * @param {number} hoveredVerse - Currently hovered verse ID
 * @param {Function} setHoveredVerse - Function to set hovered verse
 * @param {string} activeChapterRef - Currently active chapter reference
 * @param {Object} appController - App controller for popups
 * @param {boolean} DEBUG_SKELETON - Debug flag for skeleton loader
 */
export const ChapterContent = memo(({
    chapterItem,
    highlightedVerses,
    hoveredVerse,
    setHoveredVerse,
    activeChapterRef,
    DEBUG_SKELETON,
    passageNotesData,
    passageNotesLoading,
}) => {
    if (!chapterItem.data && !DEBUG_SKELETON) {
        return null; // Will be handled by parent component
    }

    return (
        <div className="chapter-container" data-chapter-ref={chapterItem.ref}>
            {chapterItem.data && !DEBUG_SKELETON && chapterItem.data.sections?.map((section, index) => {
                const sectionVerseIds = collectSectionVerseIds(section);
                const sectionKey = sectionPassageNotesKey(chapterItem.ref, index, section.ref);
                const sectionPassageNotes = passageNotesData ? passageNotesData[sectionKey] : null;
                return (
                    <div key={`${chapterItem.ref}-${index}`} className="read-section">
                        <div className="read-section-header">
                            <h4>{section.heading?.replace(/｢\d+｣/g, "").trim()}</h4>
                            <p>
                                <Link to={`/study/${slugify(getEnglishReference(section.ref))}`}>
                                    {section.ref}
                                    <button className="btn btn-sm btn-outline-secondary">
                                        {label("study_button")}
                                    </button>
                                </Link>
                            </p>
                        </div>
                        {section.blocks.map((block, blockIndex) => (
                            <ScriptureBlock
                                key={`${chapterItem.ref}-${blockIndex}`}
                                block={block}
                                highlightedVerses={highlightedVerses}
                                hoveredVerse={hoveredVerse}
                                setHoveredVerse={setHoveredVerse}
                                activeChapterRef={activeChapterRef}
                            />
                        ))}
                        {PASSAGE_NOTES_ENABLED && (
                            <PassageNotes
                                passageNotesLoading={passageNotesLoading}
                                sectionPassageNotes={sectionPassageNotes}
                                sectionVerseIds={sectionVerseIds}
                                animationDelay={index * 300}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
});

/**
 * Individual scripture block component
 */
const ScriptureBlock = memo(({
    block,
    highlightedVerses,
    hoveredVerse,
    setHoveredVerse,
    activeChapterRef
}) => {
    const appController = useAppController();
    const blockLineWordCount = block.lines.reduce((acc, line) => {
        return acc + (line.text?.split(" ").length || 0);
    }, 0);
    
    const specialClass = blockLineWordCount > 150 ? "split" : "";
    
    // Process lines into paragraphs
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
        appController.functions.setPopUp({ 
            type: "people", 
            ids: [block.person_slug],
            underSlug: "read/" + slugify(activeChapterRef) 
        });
    };

    return (
        <div className="read-block">
            <div className="left-gutter">
                <img 
                    alt={block.voice} 
                    src={assetUrl + `/people/${block.person_slug}`} 
                    onClick={handleImgClick} 
                />
                <div className="read-voice" onClick={handleImgClick}>
                    {label(block.voice)}
                </div>
            </div>
            <div className="main-content">
                {paragraphs?.map((paragraph, pIndex) => (
                    <p key={pIndex} className={`read-scripture ${specialClass} ${paragraph?.[0]?.class || ""}`}>
                        {paragraph?.map((line, lineIndex) => (
                            <VerseLine
                                key={lineIndex}
                                line={line}
                                isHighlighted={Array.isArray(highlightedVerses) && highlightedVerses?.includes(line.verse_id)}
                                isHovered={line.verse_id === hoveredVerse}
                                onMouseEnter={() => setHoveredVerse(line.verse_id)}
                                onMouseLeave={() => setHoveredVerse(null)}
                            />
                        ))}
                    </p>
                ))}
            </div>
        </div>
    );
});

/**
 * Individual verse line component
 */
const VerseLine = memo(({ 
    line, 
    isHighlighted, 
    isHovered, 
    onMouseEnter, 
    onMouseLeave 
}) => {
    const lineClass = `verse_${line.verse_id} ${line.class || ""} ${isHighlighted ? "highlighted" : ""} ${isHovered ? "hovered" : ""}`;
    const slugToVerse = verseIdToSlug([line.verse_id]);

    return (
        <Link 
            className={lineClass}
            to={`/read/${slugToVerse}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <sup>{line.verse_num}</sup>{line.text}
        </Link>
    );
});

ChapterContent.displayName = 'ChapterContent';
ScriptureBlock.displayName = 'ScriptureBlock';
VerseLine.displayName = 'VerseLine';
