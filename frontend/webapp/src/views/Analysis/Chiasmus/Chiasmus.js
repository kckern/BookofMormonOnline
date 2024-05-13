import { useEffect, useRef, useState } from "react";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import Loader from "../../_Common/Loader";
import "./Chiasmus.css";
import Chiasm from "./Chiasm";
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem,Button, Label } from 'reactstrap';
import searchIcon from "../../_Common/svg/search.svg";

function ChiasmusControl() {
    const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
    const [sortField, setSortField] = useState('reference'); // 'reference' or 'depth'
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
    const depthCounts = {2:100, 3:40, 4:20, 5:10, 6:5, 7:2, 8:1};

    const toggleSort = () => setSortDropdownOpen(prevState => !prevState);

    const handleSort = (field) => {
        setSortField(field);
    }

    const toggleSortOrder = () => {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    }

    return (
        <div className="chiasmus_controls">
            <DepthFilter depthCounts={depthCounts} />
            <div className="sort_controls" style={{display: 'flex', justifyContent: 'space-between'}}>
            <Dropdown isOpen={sortDropdownOpen} toggle={toggleSort} >
                <DropdownToggle caret style={{minWidth: '10rem'}}>
                    Sort By: {sortField}
                </DropdownToggle>
                <DropdownMenu>
                    <DropdownItem onClick={() => handleSort('reference')}>
                        Reference
                    </DropdownItem>
                    <DropdownItem onClick={() => handleSort('depth')}>
                        Depth
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>
            <Button onClick={toggleSortOrder}>
                {sortOrder === 'asc' ? '⬇' : '⬆'}
            </Button>

            </div>
        </div>
    );
}


function DepthFilter({ depthCounts }) {
    const [filteredItems, setFilters] = useState({});

    const toggleButton = (depth) => {
        setFilters(prevState => ({
            ...prevState,
            [depth]: !prevState[depth]
        }));
    };

    return (
        <div className="depth_filter" style={{display: 'flex', flexDirection: 'row'}}>
            {Object.keys(depthCounts).map(depth => <Button 
                        className={filteredItems[depth] ? 'filtered' : ''} 
                        onClick={() => toggleButton(depth)}
                    >
                        <div className="counter">{depthCounts[depth]}</div>
                        {depth}
                    </Button>)}
        </div>
    );
}


function Chiasmus({chiasmus,setChiasmusId,activeChiasmus}) {


    if(!Array.isArray(chiasmus) || chiasmus.length===0) return <pre>No chiasmus found {JSON.stringify(chiasmus)}</pre>


    return   <div className="chiasmIndexPanel noselect">
        
         <ChiasmusControl/>
    <div className="chiasmus_list">
       
        {chiasmus.map((chiasm, i) => {
            const {chiasmus_id, reference, scheme, title} = chiasm;

            const upperLetters = scheme.replace(/[^A-Z]/g, "").split("").sort();
            const maxLetter = upperLetters[upperLetters.length-1];
            const depth = maxLetter.charCodeAt(0) - 64;

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