import { useEffect, useMemo, useRef, useState } from "react";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import Loader from "../../_Common/Loader";
import "./Chiasmus.css";
import Chiasm from "./Chiasm";
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem,Button, Label } from 'reactstrap';
import searchIcon from "../../_Common/svg/search.svg";
import {lookupReference} from "scripture-guide";
import { label, determineLanguage } from 'src/models/Utils';
import { Switch, useRouteMatch } from "react-router-dom/cjs/react-router-dom.min";
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

const toggleButton = (depth, onoff) => {
    setChiasmusControls(prevState => {
        let newFilteredLevels = [...prevState.filteredLevels];
        const isNumeric = !isNaN(depth);
        depth = isNumeric ? parseInt(depth) : depth;
        const index = newFilteredLevels.indexOf(depth);

        if (onoff===true) {
            // Force on: Add depth if it's not already present
            if (index === -1) {
                newFilteredLevels.push(depth);
            }
        } else if (onoff===false) {
            // Force off: Remove depth if it's present
            if (index !== -1) {
                newFilteredLevels.splice(index, 1);
            }
        }
        else //toggle
        {
            if (index === -1) {
                newFilteredLevels.push(depth);
            } else {
                newFilteredLevels.splice(index, 1);
            }
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
            <DepthFilter depthCounts={chiasmusControls.depthCounts} chiasmusControls={chiasmusControls} toggleButton={toggleButton} toggleBiblical={toggleBiblical} toggleCompound={toggleCompound} setChiasmusControls={setChiasmusControls} />
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

function DepthFilter({depthCounts, chiasmusControls, toggleButton, toggleBiblical, toggleCompound, setChiasmusControls}) {


    const setOnlyFilter = (depth) => {
        //turn off all levels
        chiasmusControls.filteredLevels.forEach(depth => toggleButton(depth, true));
        //turn on only this level
        toggleButton(depth, false);

    }


    return (
        <div className="depth_filter" style={{display: 'flex', flexDirection: 'row'}}>
            <div className="filter_label">  Chiastic<br/>Levels</div>
            {Object.keys(depthCounts).map(depth => (
                <>
                    <Button 
                        className={chiasmusControls.filteredLevels.includes(isNaN(depth) ? depth : parseInt(depth)) ? 'filtered' : ''}                        
                        onClick={() => toggleButton(depth)}>
                            <div className="counter">{depthCounts[depth]}</div>
                            {depth}
                    </Button>

                    {false && <Button 
                        className="only-filter"                        
                        onClick={() => setOnlyFilter(depth)}>
                            Only
                    </Button>}
                </>
            ))}
            <div className="filter_label">Biblical</div>
            <Button className={chiasmusControls.biblical ? 'filtered' : ''} onClick={toggleBiblical}>
            <div className="counter">{chiasmusControls.categoryCounts.biblical}</div>
            {/* unicode icons*/ !chiasmusControls.biblical ? '✓' : '✗' }
            </Button>

            <div className="filter_label">Compound</div>
            <Button className={chiasmusControls.compound ? 'filtered' : ''} onClick={toggleCompound}>
            <div className="counter">{chiasmusControls.categoryCounts.compound}</div>    

            {/* unicode icons*/ !chiasmusControls.compound ? '✓' : '✗' }
            </Button>
        </div>
    );
}

function Chiasmus({chiasmus,setChiasmusId,activeChiasmus}) {

    const lang = determineLanguage();
    useEffect(()=>document.title = "Chiasms | " + label("home_title"),[])

    // Bible-passage verse set — one reference parse, O(1) membership afterward.
    const bibleVerseSet = useMemo(() => {
        const bibleRefs = `2 Nephi 12-24, 1 Nephi 20-21, 3 Nephi 12-14, 3 Nephi 24-25, Mosiah 14`;
        return new Set(lookupReference(bibleRefs, lang).verse_ids);
    }, [lang]);

    // Enrich each chiasm ONCE (depth, first verse_id, compound/biblical flags).
    // Previously depth-parsing ran per render and — the real killer —
    // lookupReference() ran inside the sort comparator, i.e. O(n log n) scripture
    // parses on every keystroke/toggle/mount. Precomputing collapses that to O(n),
    // memoized, so filtering and sorting are plain numeric compares.
    const enriched = useMemo(() => (Array.isArray(chiasmus) ? chiasmus : []).map((c) => {
        const upper = c.scheme.replace(/[^A-Z]/g, "").split("").sort();
        const maxLetter = upper[upper.length - 1];
        const depth = maxLetter ? maxLetter.charCodeAt(0) - 64 : 0;
        // Prefer the backend's start_verse_id — avoids re-parsing hundreds of
        // reference strings on the client (the old hot path). Fall back to
        // lookupReference only if the field is missing.
        const verseId = c.start_verse_id ?? (lookupReference(c.reference, lang).verse_ids[0] || 0);
        return { ...c, depth, verseId, isCompound: /Aa/.test(c.scheme), isBiblical: bibleVerseSet.has(verseId) };
    }), [chiasmus, lang, bibleVerseSet]);

    const depthCounts = useMemo(() => enriched.reduce((acc, c) => {
        const d = c.depth > 7 ? "+" : c.depth;
        acc[d] = (acc[d] || 0) + 1;
        return acc;
    }, {}), [enriched]);

    const categoryCounts = useMemo(() => enriched.reduce((acc, c) => ({
        biblical: acc.biblical + (c.isBiblical ? 1 : 0),
        compound: acc.compound + (c.isCompound ? 1 : 0),
    }), {biblical: 0, compound: 0}), [enriched]);

    const [chiasmusControls, setChiasmusControls] = useState({
        sortDropdownOpen: false,
        sortField: 'reference', // 'reference' or 'depth'
        sortOrder: 'asc', // 'asc' or 'desc'
        depthCounts,
        categoryCounts,
        sortFieldButton: 'Reference',
        filteredLevels: [],
        biblical: false,
        compound: false
    });

    // Filter + sort only when the data or the controls change — not on every
    // unrelated re-render (e.g. a hover elsewhere).
    const visibleChiasms = useMemo(() => {
        const {filteredLevels, biblical, compound, sortField, sortOrder} = chiasmusControls;
        const filtered = enriched.filter((c) => {
            const d = c.depth > 7 ? "+" : c.depth;
            if (compound && c.isCompound) return false;
            if (biblical && c.isBiblical) return false;
            if (filteredLevels.includes(d)) return false;
            return true;
        });
        filtered.sort((a, b) => (sortField === 'depth'
            ? (sortOrder === 'asc' ? a.depth - b.depth : b.depth - a.depth)
            : (sortOrder === 'asc' ? a.verseId - b.verseId : b.verseId - a.verseId)));
        return filtered;
    }, [enriched, chiasmusControls]);

    if(!Array.isArray(chiasmus) || chiasmus.length===0) return <pre>No chiasmus found {JSON.stringify(chiasmus)}</pre>

    return   <div className="chiasmIndexPanel noselect">
         <ChiasmusControl chiasmusControls={chiasmusControls} setChiasmusControls={setChiasmusControls} />
    <div className="chiasmus_list">
        {visibleChiasms.map((chiasm) => {
            const {chiasmus_id, reference, depth, title} = chiasm;
            return <div key={chiasmus_id}  onClick={()=>setChiasmusId(chiasmus_id)} className={`chiasmus ${activeChiasmus===chiasmus_id ? "active" : ""}`}>
                <div className="title"> {title || "Chiasm Title"}<span className="depth">{depth}</span></div>
                <div className="reference">{reference}</div>
            </div>
        })}
    </div>
    </div>

}


function Container() {
    const [chiasmus, setChiasmus] = useState(null);
    // deep link: /analysis/chiasmus/<chiasmus_id> opens that chiasm directly
    const { params } = useRouteMatch();
    const [, urlChiasmId] = params?.value?.split("/") || [];
    const [chiasmus_id, setChiasmusId] = useState(urlChiasmId || null);
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


    // the list must be loaded before we can render anything (deep links set
    // chiasmus_id before the fetch resolves — findIndex on null crashed here)
    if(!chiasmus) return <Loader/>
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