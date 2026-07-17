import { useEffect, useMemo, useRef, useState } from "react";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import { Spinner } from "../../_Common/Loader";
import Parser from "html-react-parser";
import { label } from 'src/models/Utils';
import { t } from "./t";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import { escapeRegex } from "./chiasmUtils";
import ChiasmGlyph from "../../_Common/ChiasmGlyph";
import { openScripture } from "../../Home/tiles/ScripturePopup";


// LRU cache of fetched chiasms — makes arrow-key browsing instant and lets
// prev/next prefetch. Module-level so it survives panel open/close.
const chiasmCache = new Map();
const CACHE_MAX = 10;
const cachePut = (id, val) => {
    if (chiasmCache.has(id)) chiasmCache.delete(id);
    chiasmCache.set(id, val);
    if (chiasmCache.size > CACHE_MAX) chiasmCache.delete(chiasmCache.keys().next().value);
};
export const fetchChiasm = (id) => {
    if (!id) return Promise.resolve(null);
    if (chiasmCache.has(id)) return Promise.resolve(chiasmCache.get(id));
    // useCache:false — on a deep-link cold load the list query holds the
    // IndexedDB transaction; going through the cache made this fetch wait
    // ~15s behind it. The single chiasm is cheap to fetch fresh.
    return BoMOnlineAPI({ chiasm: [id] }, { useCache: false }).then((r) => {
        const c = r?.chiasm?.[id];
        if (c) cachePut(id, c);
        return c;
    });
};
export const __clearChiasmCache = () => chiasmCache.clear(); // test hook

export function addHighlights(text, highlights) {
    // Single pass: build one alternation of escaped patterns, longest first, so
    // overlapping highlights can't nest and special chars can't crash RegExp.
    const patterns = (highlights || []).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!patterns.length) return Parser(text);
    const re = new RegExp(patterns.map(escapeRegex).join("|"), "g");
    return Parser(text.replace(re, (m) => `<span class="highlight">${m}</span>`));
}


// Major-letter depth of a line_key: "A"→0, "B"→1, "Ca"→2; -1 when keyless.
const majorDepth = (key) => {
    const m = (key || "").replace(/[^A-Z]/g, "");
    return m ? m.charCodeAt(0) - 65 : -1;
};

function ChiasticLine({line_key, label, line_text, highlights, isPivot, effectiveScheme, pinnedScheme, setActiveScheme, togglePin}) {

    // Hovering a line flips activeScheme and re-renders every line; the highlight
    // regex + HTML parse only depend on the (static) text, so memoize it or each
    // hover re-parses the whole chiasm.
    const text = useMemo(() => {
        const highlightsArray = JSON.parse(highlights || "[]");
        return addHighlights(line_text.replace(/_/g, "").replace(/\s+/g, " "), highlightsArray);
    }, [line_text, highlights]);
    const upperCaseLetter = line_key.replace(/[^A-Z]/g, "");
    const lowerCaseLetter = line_key.replace(upperCaseLetter, "") || "";
    const alphabetPosition = upperCaseLetter.charCodeAt(0) - 64 -1;
    const indexCSS = {marginLeft: `${alphabetPosition * 1.5}ex`};

    const minorAlphabetPosition = lowerCaseLetter.replace(/[αβγδ]/g, char => String.fromCharCode(char.charCodeAt(0) - 848)).charCodeAt(0) - 96 - 1;

    const minorCSS = {marginLeft: `${minorAlphabetPosition * 1.5}ex`};

    const hasActiveScheme = !!effectiveScheme;
    const isActiveScheme = effectiveScheme === upperCaseLetter;
    const isPinned = pinnedScheme === upperCaseLetter;

    const extraClass = hasActiveScheme ? (isActiveScheme ? "active" : "inactive") : "";

    return <div className={`chiasmus_line ${extraClass}${isPivot ? " pivot" : ""}`} style={indexCSS} onMouseEnter={()=>setActiveScheme(upperCaseLetter)} >
        <button type="button" className={`scheme noselect${isPinned ? " pinned" : ""}`}
            aria-pressed={isPinned}
            aria-label={t("pin_pair", "Pin the $1 pair", [upperCaseLetter])}
            onClick={()=>togglePin(upperCaseLetter)}>{upperCaseLetter}</button>
        {lowerCaseLetter && <div className="scheme minor" style={minorCSS}>{lowerCaseLetter}</div>}
        <div className="text"><span className="label noselect">{label}</span> {text}</div>
    </div>

}

function Chiasm({chiasm_id, setChiasmusId, closeChiasm, nextId, prevId}) {

    const [chiasm, setChiasm] = useState(null);
    const [activeScheme, setActiveScheme] = useState(null); // hover
    const [pinnedScheme, setPinnedScheme] = useState(null); // click/tap — wins over hover
    const [copied, setCopied] = useState(false);
    const copyTimer = useRef(null);


    useEffect(() => {
        let cancelled = false;
        setChiasm(null);
        setPinnedScheme(null);
        setCopied(false);
        fetchChiasm(chiasm_id).then((c) => {
            if (!cancelled) setChiasm(c);
        }).catch((e) => {
            console.error(e);
            if (!cancelled) setChiasm(undefined);
        });
        return () => { cancelled = true; };
    }, [chiasm_id]);

    // warm the cache for the neighbors so prev/next (and arrow keys) are instant
    useEffect(() => {
        [prevId, nextId].filter(Boolean).forEach((id) => { fetchChiasm(id).catch(() => {}); });
    }, [prevId, nextId]);

    const {replace} = useHistory();
    useEffect(() => {
        // keep the browse-state query string (useBrowseState) — without it,
        // opening a chiasm reset every filter/sort/group in the index panel
        replace(`/analysis/chiasmus/${chiasm_id}${window.location.search}`);
    }, [chiasm_id]);

    const {lines, reference, title, scheme} = chiasm || {};
    useEffect(() => {
        if (title) document.title = title + " | " + label("home_title");
    }, [title]);

    // The pivot is the chiasm's payoff — the deepest major-letter line(s).
    const pivotDepth = useMemo(
        () => (lines?.length ? Math.max(...lines.map((l) => majorDepth(l.line_key))) : -1),
        [lines]
    );

    // clear the transient "Copied!" timer if the panel unmounts mid-countdown
    useEffect(() => () => clearTimeout(copyTimer.current), []);

    if (chiasm === undefined) return <div className="chiasm error">{t("chiasm_load_failed", "Couldn't load this chiasm.")}</div>;
    if (!chiasm) return <div className="chiasm"><Spinner/></div>

    // Pinned pair (tap/click a badge) wins over hover; hover works when unpinned.
    const effectiveScheme = pinnedScheme || activeScheme;
    const togglePin = (letter) => setPinnedScheme((p) => (p === letter ? null : letter));

    const copyLink = () => {
        if (!navigator.clipboard?.writeText) return;
        navigator.clipboard.writeText(window.location.href).then(() => {
            setCopied(true);
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopied(false), 2000);
        }).catch(() => {});
    };

    return <div className="chiasm">
        <div className="chiasm-header">
            <ChiasmGlyph scheme={scheme} size={64}
                lineLengths={lines?.map((l) => (l.line_text || "").length)}
                title={t("chiasm_structure", "Structure: $1", [scheme])} />
            <div className="chiasm-titles">
                <h4 className="title">{title || t("untitled_chiasm", "Untitled")}</h4>
                <h4 className="title reference">{reference}</h4>
            </div>
            <button type="button" className="close noselect" aria-label={t("close", "Close")} onClick={closeChiasm}>×</button>
        </div>
        <div className="chiasm-actions noselect">
            <button type="button" onClick={() => openScripture(reference)}>{t("read_in_context", "Read in context")}</button>
            <button type="button" disabled={!navigator.clipboard} onClick={copyLink}>
                {copied ? t("link_copied", "Copied!") : t("copy_link", "Copy link")}
            </button>
        </div>
        <div className="chiasmus_lines" onMouseLeave={()=>setActiveScheme(null)}>
            {lines.map((line, i) => {
                return <ChiasticLine key={i} {...line}
                    isPivot={pivotDepth >= 0 && majorDepth(line.line_key) === pivotDepth}
                    effectiveScheme={effectiveScheme}
                    pinnedScheme={pinnedScheme}
                    setActiveScheme={setActiveScheme}
                    togglePin={togglePin}/>
            })}
        </div>

        <div  className="chiasmus_nav noselect">
        <button type="button" disabled={!prevId} onClick={()=>setChiasmusId(prevId)}>⬅ {t("previous", "Previous")}</button>
        <button type="button" disabled={!nextId} onClick={()=>setChiasmusId(nextId)}>{t("next", "Next")} ⮕</button>
        </div>
    </div>
        


}
export default Chiasm;