import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import Loader from "../../_Common/Loader";
import "./Chiasmus.css";
import Chiasm from "./Chiasm";
import { Button } from 'reactstrap';
import { label, determineLanguage } from 'src/models/Utils';
import { useRouteMatch, useHistory } from "react-router-dom/cjs/react-router-dom.min";
import { enrichChiasmus } from "./chiasmUtils";
import { t } from "./t";
function ChiasmusControl({chiasmusControls, setChiasmusControls, depthCounts, categoryCounts}) {


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
            <DepthFilter depthCounts={depthCounts} categoryCounts={categoryCounts} chiasmusControls={chiasmusControls} toggleButton={toggleButton} toggleBiblical={toggleBiblical} toggleCompound={toggleCompound} setChiasmusControls={setChiasmusControls} />
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
            {t("sort_by", "Sort")}: {chiasmusControls.sortFieldButton === 'Reference' ? t("sort_reference", "Reference") : t("sort_depth", "Depth")}
        </Button>
    );
}

function DepthFilter({depthCounts, categoryCounts, chiasmusControls, toggleButton, toggleBiblical, toggleCompound, setChiasmusControls}) {

    return (
        <div className="depth_filter" style={{display: 'flex', flexDirection: 'row'}}>
            <div className="filter_label">  {t("chiastic_levels", "Chiastic Levels").split(" ").map((word, i, arr) => <Fragment key={i}>{word}{i < arr.length - 1 && <br/>}</Fragment>)}</div>
            {Object.keys(depthCounts).map(depth => (
                <Fragment key={depth}>
                    <Button
                        className={chiasmusControls.filteredLevels.includes(isNaN(depth) ? depth : parseInt(depth)) ? 'filtered' : ''}
                        onClick={() => toggleButton(depth)}>
                            <div className="counter">{depthCounts[depth]}</div>
                            {depth}
                    </Button>
                </Fragment>
            ))}
            <div className="filter_label">{t("biblical", "Biblical")}</div>
            <Button className={chiasmusControls.biblical ? 'filtered' : ''} onClick={toggleBiblical}>
            <div className="counter">{categoryCounts.biblical}</div>
            {/* unicode icons*/ !chiasmusControls.biblical ? '✓' : '✗' }
            </Button>

            <div className="filter_label">{t("compound", "Compound")}</div>
            <Button className={chiasmusControls.compound ? 'filtered' : ''} onClick={toggleCompound}>
            <div className="counter">{categoryCounts.compound}</div>

            {/* unicode icons*/ !chiasmusControls.compound ? '✓' : '✗' }
            </Button>
        </div>
    );
}

const ChiasmCard = memo(function ChiasmCard({ chiasm, active, onSelect }) {
    const { chiasmus_id, reference, depthBucket, title } = chiasm;
    return (
        <div onClick={() => onSelect(chiasmus_id)} className={`chiasmus ${active ? "active" : ""}`}>
            <div className="title"> {title || t("untitled_chiasm", "Untitled")}<span className="depth">{depthBucket}</span></div>
            <div className="reference">{reference}</div>
        </div>
    );
});

function Chiasmus({chiasmus,setChiasmusId,activeChiasmus}) {

    const lang = determineLanguage();
    useEffect(()=>document.title = t("chiasms_doc_title", "Chiasms") + " | " + label("home_title"),[])

    const enriched = useMemo(() => enrichChiasmus(chiasmus, lang), [chiasmus, lang]);
    const depthCounts = useMemo(
        () => enriched.reduce((acc, c) => ({ ...acc, [c.depthBucket]: (acc[c.depthBucket] || 0) + 1 }), {}),
        [enriched]
    );
    const categoryCounts = useMemo(
        () => ({
            biblical: enriched.filter((c) => c.isBiblical).length,
            compound: enriched.filter((c) => c.isCompound).length,
        }),
        [enriched]
    );

    const [chiasmusControls, setChiasmusControls] = useState({
        sortDropdownOpen: false,
        sortField: 'reference', // 'reference' or 'depth'
        sortOrder: 'asc', // 'asc' or 'desc'
        sortFieldButton: 'Reference',
        filteredLevels: [],
        biblical: false,
        compound: false
    });



    if(!Array.isArray(chiasmus) || chiasmus.length===0) return <pre>No chiasmus found {JSON.stringify(chiasmus)}</pre>


    const filterChiasm = (c) => {
        const { filteredLevels, biblical, compound } = chiasmusControls;
        if (compound && c.isCompound) return false;
        if (biblical && c.isBiblical) return false;
        if (filteredLevels.includes(c.depthBucket)) return false;
        return true;
    };

    const sortChiasmus = (a, b) => {
        const {sortField, sortOrder} = chiasmusControls;
        if (sortField === 'depth') {
            return sortOrder === 'asc' ? a.depth - b.depth : b.depth - a.depth;
        } else {
            return sortOrder === 'asc' ? a.verse_id - b.verse_id : b.verse_id - a.verse_id;
        }
    }

    return   <div className="chiasmIndexPanel noselect">
         <ChiasmusControl chiasmusControls={chiasmusControls} setChiasmusControls={setChiasmusControls} depthCounts={depthCounts} categoryCounts={categoryCounts} />
    <div className="chiasmus_list">
        {enriched
        .filter(filterChiasm)
        .sort(sortChiasmus)
        .map((chiasm) => (
            <ChiasmCard
                key={chiasm.chiasmus_id}
                chiasm={chiasm}
                active={activeChiasmus === chiasm.chiasmus_id}
                onSelect={setChiasmusId}
            />
        ))}
    </div>
    </div>

}


function Container() {
    const [chiasmus, setChiasmus] = useState(null);
    // deep link: /analysis/chiasmus/<chiasmus_id> opens that chiasm directly
    const { params } = useRouteMatch();
    const [, urlChiasmId] = params?.value?.split("/") || [];
    const [chiasmus_id, setChiasmusId] = useState(urlChiasmId || null);
    const { replace } = useHistory();
    // stable across renders: setChiasmusId and replace are both stable, so the
    // mount-only keydown effect below can close over this safely
    const closeChiasm = () => { setChiasmusId(null); replace("/analysis/chiasmus"); };
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
            if(e.key === "Escape") closeChiasm();
        };

        //set keyboard shortcuts for left and right arrow keys to navigate chiasmus
        document.addEventListener("keydown", handleKeyDown);

        // Cleanup function to remove the event listener
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };

    }, []); // Empty array ensures this runs on mount and unmount only

        const navigateChiasmus = (direction) => {
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
        <Chiasm chiasm_id={chiasmus_id}  setChiasmusId={setChiasmusId} closeChiasm={closeChiasm} nextId={nextId} prevId={prevId}/>
    </div>

    }

     let indexPanel = <Chiasmus chiasmus={chiasmus} setChiasmusId={setChiasmusId} activeChiasmus={chiasmus_id}/>



    return <div className="container">
         <h3 className="title lg-4 text-center">{t("chiasmus_page_title", "Chiasmus in the Book of Mormon")}</h3>
         <div className="innerChiasmContainer">
        {indexPanel}
        {singlePanel}
         </div>

        </div>
}



export default Container;
