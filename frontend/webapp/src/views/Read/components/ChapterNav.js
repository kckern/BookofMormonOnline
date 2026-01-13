import React, { useMemo, memo } from 'react';
import { Link, useHistory } from 'react-router-dom';
import ReactTooltip from 'react-tooltip';
import { slugify, memoizedLookupReference } from '../../../utils/scriptureUtils';
import { label, determineLanguage } from '../../../models/Utils';

const lang = determineLanguage();

/**
 * Chapter navigation grid component - memoized for performance
 * @param {string} chapterRef - Current chapter reference
 * @param {Function} onChapterClick - Callback when chapter is clicked
 */
export const ChapterNav = memo(({ chapterRef, onChapterClick }) => {
    const history = useHistory();
    
    // Static data - these never change
    const chapterCounts = [22,33,7,1,1,1,1,29,63,16,30,1,9,15,10];
    const book_keys = ["1_ne", "2_ne", "jacob", "enos", "jarom", "omni", "w_of_m", "mosiah", "alma", "helaman", "3_ne", "4_ne", "mormon", "ether", "moroni"];
    
    // Memoize book names and firsts - these are expensive label lookups
    const { bookNames, bookFirsts } = useMemo(() => ({
        bookNames: book_keys.map((book) => label(book)),
        bookFirsts: book_keys.map((book) => `${book}_first`).map(i => label(i))
    }), []);

    // Memoize current chapter's first verse ID
    const currentChapterFirstVerseId = useMemo(() => {
        try {
            return memoizedLookupReference(chapterRef, lang).verse_ids[0];
        } catch (error) {
            console.error("Error looking up current chapter reference:", chapterRef, error);
            return null;
        }
    }, [chapterRef]);

    // Memoize all chapter verse IDs with efficient caching
    const allChapterVerseIds = useMemo(() => {
        const chapterVerseMap = new Map();
        let bookIndex = 0;
        
        for(let bookChapterCount of chapterCounts) {
            const book = bookNames[bookIndex++];
            for(let i = 1; i <= bookChapterCount; i++) {
                const chapter = `${book} ${i}`;
                try {
                    const verseIds = memoizedLookupReference(chapter, lang).verse_ids;
                    chapterVerseMap.set(chapter, verseIds[0]);
                } catch (error) {
                    console.error("Error looking up chapter reference:", chapter, error);
                    chapterVerseMap.set(chapter, null);
                }
            }
        }
        return chapterVerseMap;
    }, [bookNames]);

    // Memoize the boxes to avoid rebuilding on every render
    const boxes = useMemo(() => {
        const result = [];
        let bookIndex = 0;
        
        for(let bookChapterCount of chapterCounts) {
            const book = bookNames[bookIndex];
            const firstLetterOfBook = bookFirsts[bookIndex];
            const bookKey = book_keys[bookIndex]; // Use original book key for unique keys
            
            for(let i = 1; i <= bookChapterCount; i++) {
                const chapter = `${book} ${i}`;
                const isFirst = i === 1;
                const boxChapterFirstVerseId = allChapterVerseIds.get(chapter);
                const isActive = boxChapterFirstVerseId && currentChapterFirstVerseId && 
                    boxChapterFirstVerseId === currentChapterFirstVerseId;
                
                const handleChapterClick = (e) => {
                    e.preventDefault();
                    console.log('(1) Grid item clicked for chapter:', chapter);
                    if (onChapterClick) {
                        onChapterClick();
                    }
                    history.push(`/read/${slugify(chapter)}`);
                };
                
                result.push(
                    <Link 
                        to={`/read/${slugify(chapter)}`}
                        onClick={handleChapterClick}
                        className={`chapter-box ${isFirst ? "first" : ""} ${isActive ? "active" : ""}`}
                        data-tip={chapter}
                        data-for="chapter-nav-tip"
                        key={`${bookKey}-${i}`} // Use bookKey instead of translated book name
                    >
                        {isFirst ? firstLetterOfBook : i}
                    </Link>
                );
            }
            bookIndex++;
        }
        return result;
    }, [bookNames, bookFirsts, chapterCounts, allChapterVerseIds, currentChapterFirstVerseId, onChapterClick, history]);

    return (
        <div className="chapter-nav">
            <ReactTooltip id="chapter-nav-tip" place="top" effect="solid" />
            {boxes}
        </div>
    );
});

ChapterNav.displayName = 'ChapterNav';
