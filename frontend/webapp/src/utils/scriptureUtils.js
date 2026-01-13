import { generateReference, lookupReference } from "scripture-guide";
import { determineLanguage } from "../models/Utils";

const lang = determineLanguage();

// Cache for expensive operations
const referenceCache = new Map();
const slugCache = new Map();
const verseSlugCache = new Map();

/**
 * Memoized slugify function
 * @param {string} text - Text to slugify
 * @param {Array} verse_ids - Optional verse IDs for context
 * @returns {string|null} - Slugified text
 */
export const slugify = (text, verse_ids) => {
    if (!text) return null;
    
    const cacheKey = `${text}_${verse_ids?.join(',') || ''}`;
    if (slugCache.has(cacheKey)) {
        return slugCache.get(cacheKey);
    }
    
    const slug = text.replace(/ /g, ".").replace(/:/g, ".").replace(/[-]+/g, "~").toLowerCase();
    slugCache.set(cacheKey, slug);
    return slug;
};

/**
 * Memoized verse ID to slug conversion
 * @param {Array} verseIds - Array of verse IDs
 * @returns {string} - Slug for verses
 */
export const verseIdToSlug = (verseIds) => {
    if (!verseIds?.length) return '';
    
    const cacheKey = verseIds.join(',');
    if (verseSlugCache.has(cacheKey)) {
        return verseSlugCache.get(cacheKey);
    }
    
    const ref = generateReference(verseIds, lang);
    const slug = slugify(ref).replace(/[.](\d+$)/, "/$1");
    verseSlugCache.set(cacheKey, slug);
    return slug;
};

/**
 * Memoized reference lookup
 * @param {string} ref - Reference string
 * @param {string} language - Language code (defaults to current lang)
 * @returns {Object} - Lookup result with verse_ids
 */
export const memoizedLookupReference = (ref, language = lang) => {
    const cacheKey = `${ref}_${language}`;
    if (referenceCache.has(cacheKey)) {
        return referenceCache.get(cacheKey);
    }
    
    try {
        const result = lookupReference(ref, language);
        referenceCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error looking up reference:', ref, error);
        const errorResult = { verse_ids: [] };
        referenceCache.set(cacheKey, errorResult);
        return errorResult;
    }
};

/**
 * Memoized reference generation
 * @param {Array} verseIds - Array of verse IDs
 * @param {string} language - Language code (defaults to current lang)
 * @returns {string} - Generated reference string
 */
export const memoizedGenerateReference = (verseIds, language = lang) => {
    if (!verseIds?.length) return '';
    
    const cacheKey = `${verseIds.join(',')}_${language}`;
    if (referenceCache.has(cacheKey)) {
        return referenceCache.get(cacheKey);
    }
    
    try {
        const result = generateReference(verseIds, language);
        referenceCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error generating reference:', verseIds, error);
        const errorResult = '';
        referenceCache.set(cacheKey, errorResult);
        return errorResult;
    }
};

/**
 * Get English reference for a given reference
 * @param {string} ref - Reference in current language
 * @returns {string} - English reference
 */
export const getEnglishReference = (ref) => {
    const cacheKey = `en_${ref}`;
    if (referenceCache.has(cacheKey)) {
        return referenceCache.get(cacheKey);
    }
    
    try {
        const verse_ids = memoizedLookupReference(ref, "en").verse_ids;
        const enref = memoizedGenerateReference(verse_ids, "en");
        referenceCache.set(cacheKey, enref);
        return enref;
    } catch (error) {
        console.error('Error getting English reference:', ref, error);
        referenceCache.set(cacheKey, ref);
        return ref;
    }
};

/**
 * Get previous and next chapter references
 * @param {Array} verse_ids - Current chapter's verse IDs
 * @returns {Object} - Object with nextChapter and prevChapter
 */
export const getPrevNextChapter = (verse_ids) => {
    if (!verse_ids?.length) return { nextChapter: null, prevChapter: null };
    
    const cacheKey = `prevnext_${verse_ids.join(',')}`;
    if (referenceCache.has(cacheKey)) {
        return referenceCache.get(cacheKey);
    }
    
    const nextVerseId = verse_ids[verse_ids.length - 1] + 1;
    const prevVerseId = verse_ids[0] - 1;
    const nextChapter = nextVerseId > 37706 ? null : memoizedGenerateReference([nextVerseId], lang).split(":")[0];
    const prevChapter = prevVerseId < 31103 ? null : memoizedGenerateReference([prevVerseId], lang).split(":")[0];
    
    const result = { nextChapter, prevChapter };
    referenceCache.set(cacheKey, result);
    return result;
};

/**
 * Initialize chapter data from route match
 * @param {Object} match - React Router match object
 * @returns {Object} - Initialized chapter data
 */
export const initializeChapterData = (match) => {
    const { params } = match;
    const { bookCh, verseNum } = params;
    const modifiedBookCh = bookCh?.replace(/[.]/g, " ") || memoizedGenerateReference(memoizedLookupReference("1Ne1").verse_ids, lang).trim();
    
    const fullReference = verseNum ? `${modifiedBookCh}:${verseNum}` : modifiedBookCh;
    const initChapterVerseIds = memoizedLookupReference(modifiedBookCh, lang).verse_ids;
    const initHighlightedVerses = verseNum ? memoizedLookupReference(fullReference, lang).verse_ids : null;
    const initChapterRef = modifiedBookCh ? memoizedGenerateReference(initChapterVerseIds, lang).trim() : 
        window.localStorage.getItem("chapterRef")?.trim() || memoizedGenerateReference(memoizedLookupReference("1Ne1").verse_ids, lang).trim();
    const { nextChapter: initNextChapter, prevChapter: initPrevChapter } = getPrevNextChapter(initChapterVerseIds);
    
    return { 
        initChapterRef, 
        initHighlightedVerses, 
        initNextChapter, 
        initPrevChapter, 
        initChapterVerseIds 
    };
};

/**
 * Clear all caches (useful for testing or memory management)
 */
export const clearCaches = () => {
    referenceCache.clear();
    slugCache.clear();
    verseSlugCache.clear();
};
