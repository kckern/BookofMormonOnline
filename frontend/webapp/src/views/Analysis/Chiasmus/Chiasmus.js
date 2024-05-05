import { useEffect, useState } from "react";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import Loader from "../../_Common/Loader";
import "./Chiasmus.css";
import Chiasm from "./Chiasm";


function ChiasmusControl() {

    return <div className="chiasmus_controls">
        <button>Sort by Depth</button>
        <button>Sort by Reference</button>
        <button>Sort by Author</button>
        <button>Filter By Depth</button>
    </div>
}



function Chiasmus({chiasmus,setChiasmusId}) {


    if(!Array.isArray(chiasmus) || chiasmus.length===0) return <pre>No chiasmus found {JSON.stringify(chiasmus)}</pre>


    return   <div>
         <h3 class="title lg-4 text-center">Chiasmus in the Book of Mormon</h3>
         <ChiasmusControl/>
    <div className="chiasmus_list">
       
        {chiasmus.map((chiasm, i) => {
            const {chiasmus_id, reference, scheme} = chiasm;

            const upperLetters = scheme.replace(/[^A-Z]/g, "").split("").sort();
            const maxLetter = upperLetters[upperLetters.length-1];
            const depth = maxLetter.charCodeAt(0) - 64;

            return <div key={i} className="chiasmus" onClick={()=>setChiasmusId(chiasmus_id)}>
                <span className="reference">{reference}</span>
                <span className="depth">Depth: {depth}</span>
            </div>
        })}
    </div>
    </div>
    
}


function Container() {
    const [chiasmus, setChiasmus] = useState(null);
    const [chiasmus_id, setChiasmusId] = useState(null);
    useEffect(() => {
        BoMOnlineAPI({chiasmus:true}).then(({chiasmus}) => {
            setChiasmus(chiasmus);
        });
    }, []);

    if(!chiasmus && !chiasmus_id) return <Loader/>
    let content = null;
    if(chiasmus_id){
        const idIndex = chiasmus.findIndex(x=>x.chiasmus_id===chiasmus_id);
        const nextId = idIndex < chiasmus.length-1 ? chiasmus[idIndex+1].chiasmus_id : null;
        const prevId = idIndex > 0 ? chiasmus[idIndex-1].chiasmus_id : null;
        content =  <Chiasm chiasm_id={chiasmus_id}  setChiasmusId={setChiasmusId} nextId={nextId} prevId={prevId}/>
    }
    else{
        content = <Chiasmus chiasmus={chiasmus} setChiasmusId={setChiasmusId}/>
    }



    return <div className="container">{content}</div>
}   



export default Container;