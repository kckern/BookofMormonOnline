import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import BoMOnlineAPI, { assetUrl } from "../../../models/BoMOnlineAPI";
import Loader from "../../_Common/Loader";
import ChiasmGlyph from "../../_Common/ChiasmGlyph";
import "./Chiasmus.css";
import Chiasm from "./Chiasm";
import { label, determineLanguage } from 'src/models/Utils';
import { useRouteMatch, useHistory, useLocation } from "react-router-dom/cjs/react-router-dom.min";
import { enrichChiasmus, applyBrowseState } from "./chiasmUtils";
import useBrowseState, { DEFAULTS } from "./useBrowseState";
import { t } from "./t";

// Index-page document title — set on mount and restored when the detail panel
// closes (Chiasm.js owns the title while a chiasm is open).
const indexDocTitle = () => t("chiasms_doc_title", "Chiasmus") + " | " + label("home_title");

// Depth buckets in display order: numeric ascending, the "+" (deepest) last.
const depthOrder = (keys) => keys.slice().sort((a, b) => {
    if (a === "+") return 1;
    if (b === "+") return -1;
    return Number(a) - Number(b);
});

// Voice filter: a single popover trigger (not a 33-avatar wall). Closed it's
// one control; once a speaker is chosen the trigger BECOMES the selection
// (avatar + name + count + clear). The panel is a searchable, scrollable list.
function VoiceFilter({ speakers, value, onPick }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
    }, [open]);
    const active = speakers.find((s) => s.slug === value) || null;
    const needle = q.trim().toLowerCase();
    const shown = needle ? speakers.filter((s) => s.name.toLowerCase().includes(needle)) : speakers;
    return (
        <div className="voice_filter" ref={ref}>
            <div className={`tb_control voice_trigger${active ? " active" : ""}`}>
                <button type="button" className="voice_trigger_main" aria-haspopup="listbox" aria-expanded={open}
                    onClick={() => setOpen((o) => !o)}>
                    {active ? (
                        <>
                            <img className="voice_avatar" loading="lazy" width="22" height="22" alt=""
                                src={`${assetUrl}/people/${active.slug}`} />
                            <span className="voice_name">{active.name}</span>
                            <span className="voice_count">{active.count}</span>
                        </>
                    ) : (
                        <>
                            <img className="voice_avatar" loading="lazy" width="22" height="22" alt=""
                                src={`${assetUrl}/people/mormon2`} />
                            <span className="tb_value">{t("voice", "Voice")}</span>
                        </>
                    )}
                    <span className="tb_caret" aria-hidden="true">▾</span>
                </button>
                {active && (
                    <button type="button" className="voice_clear" aria-label={t("clear_voice", "Clear voice filter")}
                        onClick={() => onPick(null)}>×</button>
                )}
            </div>
            {open && (
                <div className="voice_popover" role="listbox">
                    <input type="search" className="voice_search" autoFocus
                        placeholder={t("search_voices", "Search voices…")}
                        value={q} onChange={(e) => setQ(e.target.value)} />
                    <div className="voice_options">
                        {shown.map((sp) => (
                            <button key={sp.slug} type="button" role="option" aria-selected={sp.slug === value}
                                className={`voice_option${sp.slug === value ? " selected" : ""}`}
                                onClick={() => { onPick(sp.slug === value ? null : sp.slug); setOpen(false); }}>
                                <img className="voice_avatar" loading="lazy" width="24" height="24" alt=""
                                    src={`${assetUrl}/people/${sp.slug}`} />
                                <span className="voice_name">{sp.name}</span>
                                <span className="voice_count">{sp.count}</span>
                            </button>
                        ))}
                        {!shown.length && <div className="voice_empty">{t("no_voices", "No matches")}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}

// Type filter doubles as the colour key: a segmented control whose dots are the
// same rail-* hues the cards carry. Selecting a segment filters by that type.
const TYPES = [["simple", "Simple"], ["compound", "Compound"], ["biblical", "Biblical"]];
function TypeFilter({ value, onSet }) {
    return (
        <div className="type_seg" role="radiogroup" aria-label={t("filter_type", "Filter by type")}>
            <button type="button" role="radio" aria-checked={!value}
                className={`type_seg_item${!value ? " selected" : ""}`} onClick={() => onSet(null)}>
                {t("type_all", "All")}
            </button>
            {TYPES.map(([type, lbl]) => {
                const selected = value === type;
                return (
                    <button key={type} type="button" role="radio" aria-checked={selected}
                        className={`type_seg_item rail-${type}${selected ? " selected" : ""}`}
                        onClick={() => onSet(selected ? null : type)}>
                        <span className="seg_dot" aria-hidden="true" />
                        {t(`type_${type}`, lbl)}
                    </button>
                );
            })}
        </div>
    );
}

// One calm, sticky control bar: Voice · Depth · Type on the left (what you're
// looking at), result count + Sort + direction on the right (how it's arranged).
function BrowseToolbar({ state, set, speakers, depthCounts, resultCount }) {
    const activeDepth = state.depths[0] || "";
    const filtered = !!(state.speaker || state.type || activeDepth);
    return (
        <div className="browse_toolbar">
            <VoiceFilter speakers={speakers} value={state.speaker} onPick={(slug) => set({ speaker: slug })} />
            <select
                className="tb_control"
                value={activeDepth}
                onChange={(e) => set({ depths: e.target.value ? [e.target.value] : [] })}
                aria-label={t("filter_depth", "Filter by depth")}
            >
                <option value="">{t("depth_all", "All depths")}</option>
                {depthOrder(Object.keys(depthCounts)).map((d) => (
                    <option key={d} value={d}>{t("depth_level", "Level $1", [d])} · {depthCounts[d]}</option>
                ))}
            </select>
            <TypeFilter value={state.type} onSet={(v) => set({ type: v })} />
            <span className="browse_spacer" />
            <span className="result_count">
                {t("n_chiasms", "$1 chiasms", [resultCount])}
                {filtered && (
                    <button type="button" className="clear_link" onClick={() => set({ ...DEFAULTS })}>
                        {t("clear", "Clear")}
                    </button>
                )}
            </span>
            <select
                className="tb_control"
                value={state.sort}
                onChange={(e) => set({ sort: e.target.value })}
                aria-label={t("sort_by", "Sort")}
            >
                <option value="canonical">{t("sort_canonical_v", "Sort: Canonical")}</option>
                <option value="depth">{t("sort_depth_v", "Sort: Depth")}</option>
                <option value="length">{t("sort_length_v", "Sort: Length")}</option>
            </select>
            <button
                type="button"
                className="tb_control dir_button"
                aria-pressed={state.dir === "desc"}
                aria-label={t("sort_direction", "Reverse sort direction")}
                onClick={() => set({ dir: state.dir === "asc" ? "desc" : "asc" })}
            >
                {state.dir === "asc" ? "↓" : "↑"}
            </button>
        </div>
    );
}

const ChiasmCard = memo(function ChiasmCard({ chiasm, active, onSelect, onVoice, onDepth }) {
    const { chiasmus_id, reference, depthBucket, title, scheme, typeGroup } = chiasm;
    const speakerSlug = chiasm.speaker?.person_slug;
    // avatar + depth chip are filter shortcuts, not card-open: stop the click
    // from bubbling to the card button (imgs/spans aren't interactive content,
    // so this stays valid inside the card <button> — no nested-button trap).
    // Everything else on the card (title, reference, page) opens the panel.
    const filterVoice = (e) => { e.stopPropagation(); if (speakerSlug) onVoice(speakerSlug); };
    const filterDepth = (e) => { e.stopPropagation(); onDepth(depthBucket); };
    // Reference is plain text styled like the site's scripture pill, NOT a
    // RefPill: RefPill is a span[role=button] and interactive content inside
    // a <button> is invalid HTML (and an a11y trap). Read-in-context lives in
    // the detail panel (Task 13); RefPill appears where there's no button
    // nesting (Task 14's PassageNotes).
    return (
        <button type="button" onClick={() => onSelect(chiasmus_id)}
            className={`chiasmus rail-${typeGroup} ${active ? "active" : ""}`} aria-pressed={active}>
            <div className="card-head">
                {speakerSlug && (
                    <img className="speaker-avatar card-filter" loading="lazy" width="36" height="36"
                        alt={chiasm.speakerName || ""}
                        title={t("filter_this_voice", "Filter by $1", [chiasm.speakerName || ""])}
                        onClick={filterVoice}
                        src={`${assetUrl}/people/${chiasm.speaker.person_slug}`} />
                )}
                <div className="card-titles">
                    <div className="title">{title || t("untitled_chiasm", "Untitled")}</div>
                    {chiasm.speakerName && <div className="speaker-name">{chiasm.speakerName}</div>}
                </div>
                <span className="depth-chip card-filter"
                    title={t("filter_this_depth", "Filter by depth $1", [depthBucket])}
                    onClick={filterDepth}>{depthBucket}</span>
            </div>
            <div className="card-body">
                {/* multi-char line_keys make line_lengths longer than the scheme
                    string; glyphBars detects the mismatch and falls back to
                    uniform bar widths for those chiasms */}
                <ChiasmGlyph scheme={scheme} lineLengths={chiasm.line_lengths} size={44}
                    title={t("chiasm_structure", "Structure: $1", [scheme])} />
                <div className="card-ref-col">
                    <span className="reference">{reference}</span>
                    {chiasm.page?.title && (
                        <span className="card-page" title={chiasm.page.title}>{chiasm.page.title}</span>
                    )}
                </div>
            </div>
        </button>
    );
});

function Chiasmus({ enriched, flat, state, set, setChiasmusId, activeChiasmus }) {

    useEffect(() => { document.title = indexDocTitle(); }, []);

    // one filter avatar per speaker present in the data, most-quoted first
    const speakers = useMemo(() => {
        const m = new Map();
        for (const c of enriched) {
            const slug = c.speaker?.person_slug;
            if (!slug) continue;
            if (!m.has(slug)) m.set(slug, { slug, name: c.speakerName || c.speaker?.name || slug, count: 0 });
            m.get(slug).count += 1;
        }
        return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }, [enriched]);

    // per-depth chiasm counts drive the depth filter options
    const depthCounts = useMemo(
        () => enriched.reduce((acc, c) => { acc[c.depthBucket] = (acc[c.depthBucket] || 0) + 1; return acc; }, {}),
        [enriched]
    );

    // stable filter callbacks (read latest set via a ref) so the ~450 memoized
    // cards don't all re-render whenever browse state changes
    const setRef = useRef(set);
    setRef.current = set;
    const onVoice = useCallback((slug) => setRef.current({ speaker: slug }), []);
    const onDepth = useCallback((d) => setRef.current({ depths: [String(d)] }), []);

    if (enriched.length === 0) return (
        <div className="browse_empty">
            {t("no_chiasms_loaded", "No chiasms available.")}
        </div>
    );

    const cards = (items) => items.map((chiasm) => (
        <ChiasmCard
            key={chiasm.chiasmus_id}
            chiasm={chiasm}
            active={activeChiasmus === chiasm.chiasmus_id}
            onSelect={setChiasmusId}
            onVoice={onVoice}
            onDepth={onDepth}
        />
    ));

    // toolbar lives ABOVE the scroll panel (a sibling, not inside it), so it
    // stays put while the cards scroll under it
    return <div className="chiasmIndexSide">
        <BrowseToolbar state={state} set={set} speakers={speakers} depthCounts={depthCounts} resultCount={flat.length} />
        <div className="chiasmIndexPanel noselect">
            {flat.length === 0 ? (
                <div className="browse_empty">
                    {t("no_chiasms_match", "No chiasms match — clear the voice filter.")}
                    <button type="button" onClick={() => set({ ...DEFAULTS })}>{t("clear_all_filters", "Clear all")}</button>
                </div>
            ) : (
                <div className="chiasmus_list">{cards(flat)}</div>
            )}
        </div>
    </div>;

}


function Container() {
    const [chiasmus, setChiasmus] = useState(null);
    // The URL is the single source of truth for which chiasm is open, so
    // /analysis/chiasmus/<chiasmus_id> deep-links AND Back/Forward work. This
    // was lost when b85e46cf merged the browse redesign over the URL-driven
    // panel (restored from a0797ed2); before the restore, opening a chiasm
    // never changed the URL, so the app read deep links it could not produce.
    const { params } = useRouteMatch();
    const chiasmus_id = params?.value?.split("/")[1] || null;
    const { replace, push } = useHistory();
    // Router search, not window.location.search: under a memory history the two
    // diverge, and window.location can be stale right after a filter change.
    // Read through a ref so the mount-only keydown effect's closures stay right.
    const { search } = useLocation();
    const searchRef = useRef(search);
    useEffect(() => { searchRef.current = search; }, [search]);
    const lang = determineLanguage();

    // Browse state lives here (Container is inside the Router context) so the
    // keyboard navigation below can follow the VISIBLE order, not fetch order.
    const { state, set } = useBrowseState();
    const enriched = useMemo(() => enrichChiasmus(Array.isArray(chiasmus) ? chiasmus : [], lang), [chiasmus, lang]);
    const { flat } = useMemo(() => applyBrowseState(enriched, state), [enriched, state]);

    // Mirrors the URL-derived chiasmus_id for the mount-only keydown effect
    // (kept in sync by the effect below; written eagerly in setChiasmusId).
    const chiasmusIdRef = useRef(chiasmus_id);

    // First open from the index PUSHES one history entry (so Back closes the
    // panel); prev/next/arrow browsing while open REPLACES (no history spam);
    // close REPLACES back to the index. The browse query string is preserved so
    // opening or closing a chiasm doesn't wipe filters out of the URL.
    // useCallback over refs + stable history fns: identity is stable across
    // renders, so the mount-only keydown effect can close over it safely and
    // ChiasmCard's memo isn't defeated by a fresh onSelect every render.
    const setChiasmusId = useCallback((id) => {
        const qs = searchRef.current;
        const wasOpen = !!chiasmusIdRef.current;
        // Eager ref write: the sync effect below is passive, so a second call
        // landing before it flushes (rapid raw keydowns) would see a stale ref
        // and push twice. Back/Forward still rely on the effect.
        chiasmusIdRef.current = id;
        if (!id) { replace("/analysis/chiasmus" + qs); return; }
        if (wasOpen) replace(`/analysis/chiasmus/${id}` + qs);
        else push(`/analysis/chiasmus/${id}` + qs);
    }, [replace, push]);
    const closeChiasm = () => setChiasmusId(null);

    // Chiasm.js owns the title while the panel is open; restore the index title
    // when it closes.
    useEffect(() => {
        if (!chiasmus_id) document.title = indexDocTitle();
    }, [chiasmus_id]);

    // keep the ref following Back/Forward, and centre the now-active card
    useEffect(() => {
        chiasmusIdRef.current = chiasmus_id;
        //scroll into view in chiasmus_list
        const activeElement = document.querySelector(".chiasmus.active");
        if(activeElement){
            activeElement.scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
        }
    }, [chiasmus_id]);

    // Stale-closure fix: the keydown listener registers once on mount and
    // captures render-1's navigateChiasmus. It must read the CURRENT visible
    // list, so the list goes through a ref (same pattern as chiasmusIdRef) —
    // without it, `flat` was frozen at its mount value ([]) and arrows were dead.
    const flatRef = useRef(flat);
    useEffect(() => { flatRef.current = flat; }, [flat]);

    const navigateChiasmus = (direction) => {
        const list = flatRef.current;
        if (!list.length) return;

        const idIndex = list.findIndex(x => x.chiasmus_id === chiasmusIdRef.current);

        // keyboard navigation WRAPS around the ends (panel buttons don't)
        let newIndex = idIndex === -1 ? 0 : idIndex + direction;
        if (newIndex < 0) {
            newIndex = list.length - 1;
        } else if (newIndex >= list.length) {
            newIndex = 0;
        }
        setChiasmusId(list[newIndex].chiasmus_id);
    }

    useEffect(() => {
        // null = loading, undefined = failed (same convention as Chiasm.js)
        BoMOnlineAPI({chiasmus:true}).then(({chiasmus}) => {
            setChiasmus(chiasmus || undefined);
        }).catch(e => {
            console.error(e);
            setChiasmus(undefined);
        });


        const handleKeyDown = e => {
            // don't hijack arrows/Escape while the user is typing in a form field
            if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
            if(e.key === "ArrowRight") navigateChiasmus(1);
            if(e.key === "ArrowLeft") navigateChiasmus(-1);
            if(e.key === "Escape") closeChiasm();
        };

        //set keyboard shortcuts for left and right arrow keys to navigate chiasmus
        document.addEventListener("keydown", handleKeyDown);

        // Cleanup function to remove the event listener
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };

    }, []); // Empty array ensures this runs on mount and unmount only


    // the list must be loaded before we can render anything (deep links set
    // chiasmus_id before the fetch resolves — findIndex on null crashed here)
    if (chiasmus === undefined) return <div className="browse_empty">{t("chiasms_load_failed", "Couldn't load chiasms.")}</div>;
    if(!chiasmus) return <Loader/>
    let singlePanel = <div className="chiasmPanel closed"
    ></div>
    if(chiasmus_id){
        // prev/next follow the VISIBLE order and do NOT wrap: null at the ends
        // (and when the open chiasm is filtered out of view) disables the buttons
        const idIndex = flat.findIndex(x=>x.chiasmus_id===chiasmus_id);
        const nextId = idIndex !== -1 && idIndex < flat.length-1 ? flat[idIndex+1].chiasmus_id : null;
        const prevId = idIndex > 0 ? flat[idIndex-1].chiasmus_id : null;
        singlePanel =
        <div className="chiasmPanel open">
        <Chiasm chiasm_id={chiasmus_id}  setChiasmusId={setChiasmusId} closeChiasm={closeChiasm} nextId={nextId} prevId={prevId}/>
    </div>

    }

     let indexPanel = <Chiasmus enriched={enriched} flat={flat} state={state} set={set} setChiasmusId={setChiasmusId} activeChiasmus={chiasmus_id}/>



    return <div className="container">
         <h3
            className="title lg-4 text-center chiasmus_title"
            // An explicit accessible name, NOT visually-hidden separator spans.
            // Those spans carried leading/trailing spaces to keep the name from
            // reading "…Book of Mormon367", but the accessible-name algorithm
            // trims each text node, so they collapsed to "…Book of Mormon—2chiasms"
            // — separated but unreadable. aria-label states the name outright,
            // so it cannot drift with whitespace rules again.
            aria-label={enriched.length > 0
                ? `${t("chiasmus_page_title", "Chiasmus in the Book of Mormon")} — ${t("n_chiasms", "$1 chiasms", [enriched.length])}`
                : undefined}
         >
            {t("chiasmus_page_title", "Chiasmus in the Book of Mormon")}
            {enriched.length > 0 && (
                <span className="total_count" title={t("total_chiasms", "$1 chiasms total", [enriched.length])}>
                    {enriched.length}
                </span>
            )}
         </h3>
         <div className="innerChiasmContainer">
        {indexPanel}
        {singlePanel}
         </div>

        </div>
}



// Named export for BrowseToolbar.test.js. This existed until c2b72ec2's browse
// redesign rewrote the file and dropped it, which silently broke that suite —
// the test kept importing `undefined`, so React reported only "Element type is
// invalid" with no clue which element. Nothing in the app imports it.
export { BrowseToolbar };
export default Container;
