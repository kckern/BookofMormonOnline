
//import Bible.css
import { useEffect, useState } from "react";
import "./Bible.css"

const verseCounts = {
    "bom": 6000,
    "ot": 23145,
    "nt": 7957
}

function BOMGrid() {

    const [childW, setChildW] = useState(0);
    const [childH, setChildH] = useState(0);

    const updateDimensions = () => {

        const grid = document.querySelector(".bibleBOMgrid");
        const [width, height] = [grid.offsetWidth, grid.offsetHeight];
        const ratio = width / height;
        const area = width * height;
        const childcount = verseCounts.bom;
        const childArea = area / childcount;
        const childWidth = Math.sqrt(childArea * ratio);
        const childHeight = Math.sqrt(childArea / ratio);
        setChildW(childWidth);
        setChildH(childHeight);
    };

    useEffect(() => {
        window.addEventListener("resize", updateDimensions);
        updateDimensions();
        return () => window.removeEventListener("resize", updateDimensions);
    }, []);





    const items = Array.from(Array(verseCounts.bom).keys());
    return <div className="bibleBOMgrid">{
        items.map((item, i) => <div className="verse bomverse" style={{width:childW, height:childH}} key={i} ></div> )
    }</div>

}

function Bible() {

    return <div className="bibleContainer" >

        <div className="bibleDetail"></div>
        <BOMGrid/>
        <div className="bibleOTgrid"></div>
        <div className="bibleNTgrid"></div>
    </div>

}

export default Bible;