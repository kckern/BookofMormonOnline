import { useEffect, useState } from "react";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import Loader from "../../_Common/Loader";
import "./Chiasmus.css";
import Chiasm from "./Chiasm";



function Chiasmus({chiasmus,setChiasmusId}) {


    if(!Array.isArray(chiasmus) || chiasmus.length===0) return <pre>No chiasmus found {JSON.stringify(chiasmus)}</pre>


    return <div className="chiasmus_list">
        {chiasmus.map((chiasm, i) => {
            const {chiasmus_id, reference, scheme} = chiasm;
            return <div key={i} className="chiasmus" onClick={()=>setChiasmusId(chiasmus_id)}>
                <div className="reference">{reference}</div>
                <div className="scheme">{scheme}</div>
            </div>
        })}
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