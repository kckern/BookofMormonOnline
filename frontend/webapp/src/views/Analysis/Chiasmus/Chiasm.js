import { useEffect, useState } from "react";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import Loader from "../../_Common/Loader";




function ChiasticLine({scheme,text,ident}) {

    text = text.replace(/_/g, "").replace(/\s+/g, " ");
    const upperCaseLetter = scheme.replace(/[^A-Z]/g, "");
    const alphabetPosition = upperCaseLetter.charCodeAt(0) - 64 -1;
    const indexCSS = {marginLeft: `${alphabetPosition * 2}ex`};

    return <div className={`chiasmus_line ${ident}`} style={indexCSS}>
        <div className="scheme">{scheme}</div>
        <div className="text">{text}</div>
    </div>

}

function Chiasm({chiasm_id, setChiasmusId, nextId, prevId}) {

    const [chiasm, setChiasm] = useState(null);
    
    useEffect(() => {
        BoMOnlineAPI({chiasm:[chiasm_id]}).then(({chiasm}) => {
            setChiasm(chiasm[chiasm_id]);
        });
    }, [chiasm_id]);

    if(!chiasm) return <Loader/>

    const {lines, reference} = chiasm;

    return <div className="chiasm">
        <button onClick={()=>setChiasmusId(null)}>← Back</button><br/>
        <button onClick={()=>setChiasmusId(prevId)}>← Previous</button>
        <button onClick={()=>setChiasmusId(nextId)}>Next →</button>
        <h4>{reference}</h4>
        <div className="chiasmus_lines">
            {lines.map((line, i) => {
                return <ChiasticLine key={i} text={line.line_text} scheme={line.line_key} ident={1}/>
            })}
        </div>
    </div>
        


}
export default Chiasm;