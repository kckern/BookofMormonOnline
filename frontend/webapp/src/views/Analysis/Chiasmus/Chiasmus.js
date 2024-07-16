import { useEffect, useRef, useState } from "react";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import Loader from "../../_Common/Loader";
import "./Chiasmus.css";
import Chiasm from "./Chiasm";
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem,Button, Label } from 'reactstrap';
import searchIcon from "../../_Common/svg/search.svg";
import {lookupReference} from "scripture-guide";
import { Switch } from "react-router-dom/cjs/react-router-dom.min";
function ChiasmusControl({chiasmusControls, setChiasmusControls}) {


    const toggleSortOrder = () => {
        setChiasmusControls(prevState => ({...prevState, sortOrder: prevState.sortOrder === 'asc' ? 'desc' : 'asc'}));
    }

    const toggleSortField = () => {
        setChiasmusControls(prevState => ({...prevState, 
            sortFieldButton: prevState.sortFieldButton === 'Reference' ? 'Depth' : 'Reference',
            sortField: prevState.sortField === 'reference' ? 'depth' : 'reference'
        }));
    };

const toggleButton = (depth) => {
    setChiasmusControls(prevState => {
        let newFilteredLevels = [...prevState.filteredLevels];
        const isNumeric = !isNaN(depth);
        depth = isNumeric ? parseInt(depth) : depth;
        const index = newFilteredLevels.indexOf(depth);
        
        if (index === -1) {
            newFilteredLevels.push(depth);
        } else {
            newFilteredLevels.splice(index, 1);
        }

        return {
            ...prevState,
            filteredLevels: newFilteredLevels
        };
    });
};

    const toggleBiblical = () => {
        setChiasmusControls(prevState => ({...prevState, biblical: !prevState.biblical}));
    };

    const toggleCompound = () => {
        setChiasmusControls(prevState => ({...prevState, compound: !prevState.compound}));
    };

    return (
        <div className="chiasmus_controls">
            <DepthFilter depthCounts={chiasmusControls.depthCounts} chiasmusControls={chiasmusControls} toggleButton={toggleButton} toggleBiblical={toggleBiblical} toggleCompound={toggleCompound} />
            <div className="sort_controls" style={{display: 'flex', justifyContent: 'space-between'}}>
            <SortButton chiasmusControls={chiasmusControls} toggleSortField={toggleSortField} />
            <Button onClick={toggleSortOrder}  className="sort_order_button">
                {chiasmusControls.sortOrder === 'asc' ? '⬇' : '⬆'}
            </Button>

            </div>
        </div>
    );
}


function SortButton({chiasmusControls, toggleSortField}) {
    return (
        <Button onClick={toggleSortField} style={{minWidth: '10rem'}}>
            Sort: {chiasmusControls.sortFieldButton}
        </Button>
    );
}

function DepthFilter({depthCounts, chiasmusControls, toggleButton, toggleBiblical, toggleCompound}) {
    return (
        <div className="depth_filter" style={{display: 'flex', flexDirection: 'row'}}>
            <div className="filter_label">  Chiastic<br/>Levels</div>
            {Object.keys(depthCounts).map(depth => <Button 
                className={chiasmusControls.filteredLevels.includes(isNaN(depth) ? depth : parseInt(depth) ) ? 'filtered' : ''}                        
                    onClick={() => toggleButton(depth)} >
                        <div className="counter">{depthCounts[depth]}</div>
                        {depth}
                    </Button>)}
            <div className="filter_label">Biblical</div>
            <Button className={chiasmusControls.biblical ? 'filtered' : ''} onClick={toggleBiblical}>
            <div className="counter">100</div>
            <Switch 
                checked={chiasmusControls.biblical} 
                onChange={toggleBiblical} 
                color="default" 
                />
            </Button>

            <div className="filter_label">Compound</div>
            <Button className={chiasmusControls.compound ? 'filtered' : ''} onClick={toggleCompound}>
            <div className="counter">100</div>        
                    <Switch 
                checked={chiasmusControls.compound}
                onChange={toggleCompound}
                color="default" 
                />
            </Button>
        </div>
    );
}

function Chiasmus({chiasmus,setChiasmusId,activeChiasmus}) {


    const [chiasmusControls, setChiasmusControls] = useState({
        sortDropdownOpen: false,
        sortField: 'reference', // 'reference' or 'depth'
        sortOrder: 'asc', // 'asc' or 'desc'
        depthCounts: {2:100, 3:40, 4:20, 5:10, 6:5, 7:2, "+":1},
        sortFieldButton: 'Reference',
        filteredLevels: [],
        biblical: false,
        compound: false
    });



    if(!Array.isArray(chiasmus) || chiasmus.length===0) return <pre>No chiasmus found {JSON.stringify(chiasmus)}</pre>


    const filterChiasm = (chiasm) => {
        const {filteredLevels, biblical, compound} = chiasmusControls;
        let {depth, scheme} = chiasm;
        if(depth > 7) depth = "+";
        const isCompound = /Aa/.test(scheme);
        if(compound && isCompound) return false;
        if (filteredLevels.includes(depth)) return false;
        return true;
    }

    const sortChiasmus = (a, b) => {
        const {sortField, sortOrder} = chiasmusControls;
        if (sortField === 'depth') {
            return sortOrder === 'asc' ? a.depth - b.depth : b.depth - a.depth;
        } else {
            const [aVerseId] = lookupReference(a.reference).verse_ids;
            const [bVerseId] = lookupReference(b.reference).verse_ids;
            return sortOrder === 'asc' ? aVerseId - bVerseId : bVerseId - aVerseId;
        }
    }

    return   <div className="chiasmIndexPanel noselect">
         <ChiasmusControl chiasmusControls={chiasmusControls} setChiasmusControls={setChiasmusControls} />
    <div className="chiasmus_list">
        {chiasmus
        .map((chiasm, i) => {
            const upperLetters = chiasm.scheme.replace(/[^A-Z]/g, "").split("").sort();
            const maxLetter = upperLetters[upperLetters.length-1];
            const depth = maxLetter.charCodeAt(0) - 64;
            chiasm = {...chiasm, depth};
            return chiasm;
        })
        .filter(filterChiasm)
        .sort(sortChiasmus)
        .map((chiasm, i) => {
            const {chiasmus_id, reference, depth, title} = chiasm;
            return <div key={i}  onClick={()=>setChiasmusId(chiasmus_id)} className={`chiasmus ${activeChiasmus===chiasmus_id ? "active" : ""}`}>
                <div className="title"> {title || "Chiasm Title"}<span className="depth">{depth}</span></div>
                <div className="reference">{reference}</div>
            </div>
        })}
    </div>
    </div>
    
}


function Container() {
    const [chiasmus, setChiasmus] = useState(null);
    const [chiasmus_id, setChiasmusId] = useState(null);
    const chiasmusIdRef = useRef(chiasmus_id); // Create a ref
    useEffect(() => {
        chiasmusIdRef.current = chiasmus_id; // Update the ref whenever chiasmus_id changes
        //scroll into view in chiasmus_list
        const activeElement = document.querySelector(".chiasmus.active");
        if(activeElement){
            activeElement.scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
        }
    }, [chiasmus_id]);

    useEffect(() => {
        BoMOnlineAPI({chiasmus:true}).then(({chiasmus}) => {
            setChiasmus(chiasmus);
        });


        const handleKeyDown = e => {
            if(e.key === "ArrowRight") navigateChiasmus(1);
            if(e.key === "ArrowLeft") navigateChiasmus(-1);
            if(e.key === "Escape") setChiasmusId(null);
        };

        //set keyboard shortcuts for left and right arrow keys to navigate chiasmus
        document.addEventListener("keydown", handleKeyDown);

        // Cleanup function to remove the event listener
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };

    }, []); // Empty array ensures this runs on mount and unmount only

        const navigateChiasmus = async (direction) => {
            //wait 1 sec
            await new Promise(resolve => setTimeout(resolve, 1));

            if (!chiasmus) {
                return; // Return early if chiasmus is null or undefined
            }

            const idIndex = chiasmus.findIndex(x => x.chiasmus_id === chiasmusIdRef.current);

            let newIndex = idIndex === -1 ? 0 : idIndex + direction;
            if (newIndex < 0) {
                newIndex = chiasmus.length - 1;
            } else if (newIndex >= chiasmus.length) {
                newIndex = 0;
            }
            setChiasmusId(chiasmus[newIndex].chiasmus_id);
        }


    if(!chiasmus && !chiasmus_id) return <Loader/>
    let singlePanel = <div className="chiasmPanel closed"
    ></div>
    if(chiasmus_id){
        const idIndex = chiasmus.findIndex(x=>x.chiasmus_id===chiasmus_id);
        const nextId = idIndex < chiasmus.length-1 ? chiasmus[idIndex+1].chiasmus_id : null;
        const prevId = idIndex > 0 ? chiasmus[idIndex-1].chiasmus_id : null;
        singlePanel =  
        <div className="chiasmPanel open">
        <Chiasm chiasm_id={chiasmus_id}  setChiasmusId={setChiasmusId} nextId={nextId} prevId={prevId}/>
    </div>
        
    }
  
     let indexPanel = <Chiasmus chiasmus={chiasmus} setChiasmusId={setChiasmusId} activeChiasmus={chiasmus_id}/>
    



    return <div className="container">
         <h3 className="title lg-4 text-center">Chiasmus in the Book of Mormon</h3>
         <div className="innerChiasmContainer">
        {indexPanel}
        {singlePanel}
         </div>
        
        </div>
}   



export default Container;