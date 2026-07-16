import { useEffect, useMemo, useState } from "react";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import { Spinner } from "../../_Common/Loader";
import Parser from "html-react-parser";
import { label } from 'src/models/Utils';
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import { escapeRegex } from "./chiasmUtils";


export function addHighlights(text, highlights) {
    // Single pass: build one alternation of escaped patterns, longest first, so
    // overlapping highlights can't nest and special chars can't crash RegExp.
    const patterns = (highlights || []).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!patterns.length) return Parser(text);
    const re = new RegExp(patterns.map(escapeRegex).join("|"), "g");
    return Parser(text.replace(re, (m) => `<span class="highlight">${m}</span>`));
}


function ChiasticLine({line_key, label, line_text, highlights, activeScheme, setActiveScheme}) {

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

    const hasActiveScheme = !!activeScheme;
    const isActiveScheme = activeScheme === upperCaseLetter;

    const extraClass = hasActiveScheme ? (isActiveScheme ? "active" : "inactive") : "";

    return <div className={`chiasmus_line ${extraClass}`} style={indexCSS} onMouseEnter={()=>setActiveScheme(upperCaseLetter)} >
        <div className="scheme noselect">{upperCaseLetter}</div>
        {lowerCaseLetter && <div className="scheme minor" style={minorCSS}>{lowerCaseLetter}</div>}
        <div className="text"><span className="label noselect">{label}</span> {text}</div>
    </div>

}

function Chiasm({chiasm_id, setChiasmusId, nextId, prevId}) {

    const [chiasm, setChiasm] = useState(null);
    const [activeScheme, setActiveScheme] = useState(null);

    
    const {push} = useHistory();
    useEffect(() => {
        setChiasm(null);
        // useCache:false — on a deep-link cold load the list query holds the
        // IndexedDB transaction; going through the cache made this fetch wait
        // ~15s behind it. The single chiasm is cheap to fetch fresh.
        BoMOnlineAPI({chiasm:[chiasm_id]}, {useCache:false}).then((r) => {
            setChiasm(r?.chiasm?.[chiasm_id]);
        });
    }, [chiasm_id]);


    const {lines, reference, title} = chiasm || {};
    useEffect(()=>{
        
        push(`/analysis/chiasmus/${chiasm_id}`);
        
        document.title =title + " | " + label("home_title")},[title])

    if(!chiasm) return <div className="chiasm"><Spinner/></div>


    return <div className="chiasm">
        <h4 className="title text-center title">{title || "Chiasm Title"}
            <span className="close noselect" onClick={()=>setChiasmusId(null)}>×</span>
        </h4>
        <h4 className="title text-center reference">{reference}</h4>
        <div className="chiasmus_lines" onMouseLeave={()=>setActiveScheme(null)}>
            {lines.map((line, i) => {
                return <ChiasticLine key={i} {...line} activeScheme={activeScheme} setActiveScheme={setActiveScheme}/>
            })}
        </div>

        <div  className="chiasmus_nav noselect">
        <div onClick={()=>setChiasmusId(prevId)}>⬅ Previous</div>
        <div onClick={()=>setChiasmusId(nextId)}>Next ⮕</div>
        </div>
    </div>
        


}
export default Chiasm;