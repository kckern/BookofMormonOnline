import React, { useEffect, useRef, useState } from 'react';
import { Card, CardBody, CardHeader } from 'reactstrap';
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
//



export function MapPlaceSearch({mapController})
{

    const {searching,setSearching, appController} = mapController;
    


    const [searchResults, setSearchResults] = useState([{
        slug: null,
        name: "No places found",
        info: "try again"
    }]);

    const {preLoad:{placeList}} = appController;
    
    //on mount focus the input
    useEffect(()=>{
        //focus input
        const input = document.querySelector(".map-place-search input");
        if(!input) return false;
        input?.focus();
        const {firstLetter} =  searching || {};
        if(firstLetter) input.value = firstLetter;
        
    },[searching]);

    const handleTyping = (e)=>{
        if(!placeList) return false;
        const inputString = e.target.value;
        const places = Object.values(placeList).map(i=>{
            const pattern = new RegExp(inputString,"ig");
            if(pattern.test(i.name)) return {...i,className:"primaryResult"}
            if(pattern.test(i.info)) return {...i,className:"secondaryResult"}
            return  null
        }).filter(Boolean)
        .sort((a, b) => a.className.localeCompare(b.className))
        .slice(0,10);

        setSearchResults(places)
    }

    if(!searching) return null;

    if(!placeList) return null;

    return <Card className="map-place-search">
        <CardHeader>
            <div>Q</div>
            <input type="text" placeholder="Search for a place" onChange={handleTyping} />
            <div onClick={()=>setSearching(null)} className='close'
            >×</div>
        </CardHeader>
        <CardBody>
            <div className="search-results">
                {searchResults.map((result, index) => {
                    return <div key={index} className={`search-result ${result.className}`}>
                        <img src={`${assetUrl}/places/${result.slug}`}/>
                        <div>
                        <div className="search-result-name">{result.name}</div>
                        <div className="search-result-info">{result.info}</div>
                        </div>
                    </div>
                })}
            </div>
        </CardBody>
    </Card>
}
