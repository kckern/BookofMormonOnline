import { useEffect, useState } from "react";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import Loader from "../../_Common/Loader";
import Parser from "html-react-parser";


function addHighlights(text, highlights) {
    //use replace callbacks to make and array of jsx elements
    let highlightedText = text;
    highlights.forEach(highlight => {
        highlightedText = highlightedText.replace(new RegExp(highlight, 'g'), (match, offset) => {
            if(!match) return match;
            //if match already contains span, return 
            if(match.includes("span")) return match;
            return `<span class="highlight">${match}</span>`;
        });
    });
    return Parser(highlightedText);



}


function ChiasticLine({line_key, label, line_text, highlights, activeScheme, setActiveScheme}) {

    const highlightsArray = JSON.parse(highlights || "[]");
    const text = addHighlights(line_text.replace(/_/g, "").replace(/\s+/g, " "), highlightsArray);  
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
    
    useEffect(() => {
        setChiasm(null);
        BoMOnlineAPI({chiasm:[chiasm_id]}).then(({chiasm}) => {
            setChiasm(chiasm[chiasm_id]);
            
        });
    }, [chiasm_id]);

    if(!chiasm) return <Loader/>

    const {lines, reference, title} = chiasm;

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