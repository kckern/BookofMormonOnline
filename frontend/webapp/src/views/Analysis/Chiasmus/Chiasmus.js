import { memo, useEffect, useMemo, useRef, useState } from "react";
import BoMOnlineAPI, { assetUrl } from "../../../models/BoMOnlineAPI";
import Loader from "../../_Common/Loader";
import ChiasmGlyph from "../../_Common/ChiasmGlyph";
import "./Chiasmus.css";
import Chiasm from "./Chiasm";
import { label, determineLanguage } from 'src/models/Utils';
import { useRouteMatch, useHistory, useLocation } from "react-router-dom/cjs/react-router-dom.min";
import { enrichChiasmus, applyBrowseState, BOOK_GROUPS } from "./chiasmUtils";
import useBrowseState, { DEFAULTS } from "./useBrowseState";
import { t } from "./t";

const DEBOUNCE_MS = 250;

function BrowseToolbar({ state, set, depthCounts, categoryCounts }) {
    // Search input strategy: controlled, mirrored into local state so typing
    // stays smooth (no URL replace per keystroke) while still following
    // URL-driven changes (back/forward, Clear all). `lastSent` distinguishes
    // "state.q changed because our own debounce fired" (ignore — the local
    // value is already newer or equal) from "state.q changed externally"
    // (adopt it and drop any in-flight debounce).
    const [q, setQ] = useState(state.q);
    const timer = useRef(null);
    const lastSent = useRef(state.q);
    // set() is recreated whenever state changes; a debounce that fired with a
    // stale set() would merge its patch into stale state and revert any other
    // control changed during the debounce window. Always call through the ref.
    const setRef = useRef(set);
    useEffect(() => { setRef.current = set; });
    useEffect(() => {
        if (state.q !== lastSent.current) {
            clearTimeout(timer.current);
            lastSent.current = state.q;
            setQ(state.q);
        }
    }, [state.q]);
    useEffect(() => () => clearTimeout(timer.current), []);
    const onSearchChange = (e) => {
        const value = e.target.value;
        setQ(value);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            lastSent.current = value;
            setRef.current({ q: value });
        }, DEBOUNCE_MS);
    };

    const depthKeys = Object.keys(depthCounts).sort((a, b) => {
        if (a === "+") return 1;
        if (b === "+") return -1;
        return Number(a) - Number(b);
    });

    const toggleDepth = (d) => {
        const next = state.depths.includes(d)
            ? state.depths.filter((x) => x !== d)
            : [...state.depths, d];
        set({ depths: next }); // single merged call — see useBrowseState
    };

    // Simple gets no count: it isn't total − compound − biblical (a chiasm can
    // be both compound and biblical, so those two overlap).
    const typeChips = [
        ["simple", t("type_simple", "Simple"), null],
        ["compound", t("type_compound", "Compound"), categoryCounts.compound],
        ["biblical", t("type_biblical", "Biblical"), categoryCounts.biblical],
    ];

    return (
        <div className="browse_toolbar">
            <input
                type="search"
                className="browse_search"
                placeholder={t("search_chiasms", "Search chiasms…")}
                aria-label={t("search_chiasms", "Search chiasms…")}
                value={q}
                onChange={onSearchChange}
            />
            <select
                value={state.group}
                onChange={(e) => set({ group: e.target.value })}
                aria-label={t("group_by", "Group by")}
            >
                <option value="none">{t("group_none", "No grouping")}</option>
                <option value="book">{t("group_book", "Book")}</option>
                <option value="speaker">{t("group_speaker", "Speaker")}</option>
                <option value="depth">{t("group_depth", "Depth")}</option>
                <option value="type">{t("group_type", "Type")}</option>
            </select>
            <select
                value={state.sort}
                onChange={(e) => set({ sort: e.target.value })}
                aria-label={t("sort_by", "Sort")}
            >
                <option value="canonical">{t("sort_canonical", "Canonical order")}</option>
                <option value="depth">{t("sort_depth", "Depth")}</option>
                <option value="length">{t("sort_length", "Length")}</option>
                <option value="title">{t("sort_title", "Title")}</option>
            </select>
            <button
                type="button"
                className="dir_button"
                aria-pressed={state.dir === "desc"}
                aria-label={t("sort_direction", "Reverse sort direction")}
                onClick={() => set({ dir: state.dir === "asc" ? "desc" : "asc" })}
            >
                {state.dir === "asc" ? "↓" : "↑"}
            </button>
            {/* depth chips: INCLUSION semantics — selected = shown; none selected = all shown */}
            {depthKeys.map((d) => {
                const selected = state.depths.includes(d);
                return (
                    <button
                        key={d}
                        type="button"
                        className={`chip depth_chip${selected ? " selected" : ""}`}
                        aria-pressed={selected}
                        aria-label={t("depth_chip_label", "Depth $1 — $2 chiasms", [d, depthCounts[d]])}
                        onClick={() => toggleDepth(d)}
                    >
                        <span className="chip_count" aria-hidden="true">{depthCounts[d]}</span>{d}
                    </button>
                );
            })}
            {typeChips.map(([value, chipLabel, count]) => {
                const selected = state.type === value;
                return (
                    <button
                        key={value}
                        type="button"
                        className={`chip type_chip${selected ? " selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => set({ type: selected ? null : value })}
                    >
                        {count != null && <span className="chip_count">{count}</span>}{chipLabel}
                    </button>
                );
            })}
        </div>
    );
}

const ChiasmCard = memo(function ChiasmCard({ chiasm, active, onSelect }) {
    const { chiasmus_id, reference, depthBucket, title, scheme, bookGroup } = chiasm;
    // Reference is plain text styled like the site's scripture pill, NOT a
    // RefPill: RefPill is a span[role=button] and interactive content inside
    // a <button> is invalid HTML (and an a11y trap). Read-in-context lives in
    // the detail panel (Task 13); RefPill appears where there's no button
    // nesting (Task 14's PassageNotes).
    return (
        <button type="button" onClick={() => onSelect(chiasmus_id)}
            className={`chiasmus rail-${bookGroup} ${active ? "active" : ""}`} aria-pressed={active}>
            <div className="card-head">
                {chiasm.speaker?.person_slug && (
                    <img className="speaker-avatar" loading="lazy" width="36" height="36"
                        alt={chiasm.speakerName || ""}
                        src={`${assetUrl}/people/${chiasm.speaker.person_slug}`} />
                )}
                <div className="card-titles">
                    <div className="title">{title || t("untitled_chiasm", "Untitled")}</div>
                    {chiasm.speakerName && <div className="speaker-name">{chiasm.speakerName}</div>}
                </div>
                <span className="depth-chip" title={t("chiastic_depth", "Chiastic depth")}>{depthBucket}</span>
            </div>
            <div className="card-body">
                {/* multi-char line_keys make line_lengths longer than the scheme
                    string; glyphBars detects the mismatch and falls back to
                    uniform bar widths for those chiasms */}
                <ChiasmGlyph scheme={scheme} lineLengths={chiasm.line_lengths} size={44}
                    title={t("chiasm_structure", "Structure: $1", [scheme])} />
                <span className="reference">{reference}</span>
            </div>
        </button>
    );
});

function Chiasmus({ enriched, flat, groups, state, set, setChiasmusId, activeChiasmus }) {

    useEffect(() => { document.title = t("chiasms_doc_title", "Chiasmus") + " | " + label("home_title"); }, []);

    const depthCounts = useMemo(
        () => enriched.reduce((acc, c) => { acc[c.depthBucket] = (acc[c.depthBucket] || 0) + 1; return acc; }, {}),
        [enriched]
    );
    const categoryCounts = useMemo(
        () => ({
            biblical: enriched.filter((c) => c.isBiblical).length,
            compound: enriched.filter((c) => c.isCompound).length,
        }),
        [enriched]
    );

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
        />
    ));

    return <div className="chiasmIndexPanel noselect">
        <BrowseToolbar state={state} set={set} depthCounts={depthCounts} categoryCounts={categoryCounts} />
        {flat.length === 0 ? (
            <div className="browse_empty">
                {t("no_chiasms_match", "No chiasms match — clear a filter or search term.")}
                <button type="button" onClick={() => set({ ...DEFAULTS })}>{t("clear_all_filters", "Clear all")}</button>
            </div>
        ) : groups ? (
            groups.map((group) => (
                // when grouped by BOOK the section carries the same rail-* class as
                // its cards (group.key is a book name → map through BOOK_GROUPS);
                // the header underline picks up --rail-color from it
                <section
                    className={`chiasm_group${state.group === "book" ? ` rail-${BOOK_GROUPS[group.key] || "other"}` : ""}`}
                    key={group.key}
                >
                    <h4 className="group-header">{group.key} <span className="count">{group.items.length}</span></h4>
                    <div className="chiasmus_list">{cards(group.items)}</div>
                </section>
            ))
        ) : (
            <div className="chiasmus_list">{cards(flat)}</div>
        )}
    </div>;

}


function Container() {
    const [chiasmus, setChiasmus] = useState(null);
    // URL is the source of truth for the open chiasm:
    // /analysis/chiasmus/<chiasmus_id> — react-router re-renders on every
    // navigation, so Back/Forward open and close the panel by themselves.
    const { params } = useRouteMatch();
    const chiasmus_id = params?.value?.split("/")[1] || null;
    const { replace, push } = useHistory();
    // Router search (not window.location.search — under a memory history the
    // two diverge, and window.location could be stale right after a filter
    // change). Read through a ref so the mount-only keydown effect's captured
    // closures stay correct.
    const { search } = useLocation();
    const searchRef = useRef(search);
    useEffect(() => { searchRef.current = search; }, [search]);
    const lang = determineLanguage();

    // Browse state lives here (Container is inside the Router context) so the
    // keyboard navigation below can follow the VISIBLE order, not fetch order.
    const { state, set } = useBrowseState();
    const enriched = useMemo(() => enrichChiasmus(Array.isArray(chiasmus) ? chiasmus : [], lang), [chiasmus, lang]);
    const { flat, groups } = useMemo(() => applyBrowseState(enriched, state), [enriched, state]);

    const chiasmusIdRef = useRef(chiasmus_id); // Create a ref

    // First open from the index PUSHES one history entry (so Back closes the
    // panel); prev/next/arrow browsing while open REPLACES (no history spam);
    // close REPLACES back to the index. The browse query string is preserved
    // so opening/closing a chiasm doesn't wipe filters out of the URL.
    // Stable across renders: only refs + stable history fns are captured, so
    // the mount-only keydown effect below can close over these safely.
    const setChiasmusId = (id) => {
        const qs = searchRef.current;
        const wasOpen = !!chiasmusIdRef.current;
        // Eager ref write: the sync effect below runs in a passive effect, so a
        // second call landing before it flushes (e.g. rapid raw keydowns) would
        // see a stale ref and push twice. Back/Forward still rely on the effect.
        chiasmusIdRef.current = id;
        if (!id) { replace("/analysis/chiasmus" + qs); return; }
        if (wasOpen) replace(`/analysis/chiasmus/${id}` + qs);
        else push(`/analysis/chiasmus/${id}` + qs);
    };
    const closeChiasm = () => setChiasmusId(null);

    // when the panel closes, restore the index page title (Chiasm.js sets the
    // per-chiasm title while it is open)
    useEffect(() => {
        if (!chiasmus_id) document.title = t("chiasms_doc_title", "Chiasmus") + " | " + label("home_title");
    }, [chiasmus_id]);
    useEffect(() => {
        chiasmusIdRef.current = chiasmus_id; // Update the ref whenever chiasmus_id changes
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

     let indexPanel = <Chiasmus enriched={enriched} flat={flat} groups={groups} state={state} set={set} setChiasmusId={setChiasmusId} activeChiasmus={chiasmus_id}/>



    return <div className="container">
         <h3 className="title lg-4 text-center">{t("chiasmus_page_title", "Chiasmus in the Book of Mormon")}</h3>
         <div className="innerChiasmContainer">
        {indexPanel}
        {singlePanel}
         </div>

        </div>
}



export default Container;
