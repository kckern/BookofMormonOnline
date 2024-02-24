
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardBody, CardHeader } from 'reactstrap';
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";

export function MapPlaceSearch({ mapController }) {

    const { searching, setSearching, appController } = mapController;
    const [searchResults, setSearchResults] = useState([]);
    const [searchString, setSearchString] = useState("");   
    const [selectedResult, setSelectedResult] = useState(0);
    const resultsRef = useRef();

    const { preLoad: { placeList } } = appController;

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setSearchResults(current => {
                    let newIndex = selectedResult;
                    if (e.key === 'ArrowDown') {
                        newIndex = selectedResult >= current.length - 1 ? 0 : selectedResult + 1;
                    } else {
                        newIndex = selectedResult <= 0 ? current.length - 1 : selectedResult - 1;
                    }
                    setSelectedResult(newIndex);
                    return current;
                });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                //clear search
                setSearching(null);
                const selected = searchResults[selectedResult];
                const selectedSlug = selected.slug;
                //set panel to selected place
                mapController.setPanelContents({slug:selectedSlug});
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedResult, searchResults.length]);

    // Focus on mount
    useEffect(() => {
        const input = document.querySelector(".map-place-search input");
        input?.focus();
        const { firstLetter } = searching || {};
        if (firstLetter) input.value = firstLetter;
    }, [searching]);

    // Handle search input changes
    const handleTyping = (e) => {
        if (!placeList) return;
        const inputString = e.target.value;
        const places = Object.values(placeList).map(i => {
            const pattern = new RegExp(inputString, "ig");
            if (pattern.test(i.name)) return { ...i, className: "primaryResult" };
            if (pattern.test(i.info)) return { ...i, className: "secondaryResult" };
            return null;
        }).filter(Boolean)
            .sort((a, b) => a.className.localeCompare(b.className))
            .slice(0, 10);

        setSearchResults(places);
        setSearchString(inputString);
        setSelectedResult(0);  // Reset selected result for new search
    }

    if (!searching || !placeList) return null;

    return (
        <Card className="map-place-search">
            <CardHeader>
                <div className='close'>🔍</div>
                <input type="text" placeholder="Search for a place" onChange={handleTyping} />
                <div onClick={() => setSearching(null)} className='close'>×</div>
            </CardHeader>
            <CardBody>
                <div className="search-results" ref={resultsRef}>
                    {searchString && searchResults.length && searchResults.map((result, index) => (
                        <div key={index} className={`search-result ${result.className} ${index === selectedResult ? 'selected' : ''}`}>
                            <img alt={`${result.name}`} src={`${assetUrl}/places/${result.slug}`} />
                            <div>
                                <div className="search-result-name">{result.name}</div>
                                <div className="search-result-info">{result.info}</div>
                            </div>
                        </div>
                    )) || searchString && 
                    <div className="search-result no-results">No results found</div> || 
                    <div className="search-result no-results">Start typing to search</div>}
                </div>
            </CardBody>
        </Card>
    );
}