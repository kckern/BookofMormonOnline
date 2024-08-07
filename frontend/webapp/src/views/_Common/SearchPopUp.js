
import Parser from "html-react-parser";
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardBody, CardHeader } from 'reactstrap';
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import "./SearchPopUp.css";

export function SearchPopUp({ preLoadData, selectItemHandler,placeholder,isOpen,setIsOpen,testFieldNames,assetName,initSearchString = "" }) {

    const [searchResults, setSearchResults] = useState([]);
    const [searchString, setSearchString] = useState(initSearchString);
    const [selectedResult, setSelectedResult] = useState(0);
    const resultsRef = useRef();
    const searchInputRef = useRef(null);


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
                const selected = searchResults[selectedResult] || searchResults[0];
                if (selected) {
                    const selectedSlug = selected.slug;
                    selectItemHandler(selectedSlug);
                }
            }else if (e.key === 'Escape'){
              setSearchString('');
              setIsOpen(false);
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedResult, searchResults.length]);

    // Focus on mount
    useEffect(() => {
        if(isOpen && searchInputRef.current) searchInputRef.current.focus();

        if(!isOpen) {
          setSearchResults([])
          setSearchString('');
        };
    }, [isOpen]);

    // Handle search input changes
    const handleTyping = (e) => {
        if (!preLoadData) return;
        const inputString = e.target.value;
        const results = Object.values(preLoadData).map(i => {
            const pattern = new RegExp(inputString, "ig");
            if (pattern.test(i[testFieldNames.primary])) return { ...i, className: "primaryResult" };
            if (pattern.test(i[testFieldNames.secondary])) return { ...i, className: "secondaryResult" };
            return null;
        }).filter(Boolean)
            .sort((a, b) => a.className.localeCompare(b.className))
            .slice(0, 10);

        setSearchResults(results);
        setSearchString(inputString);
        setSelectedResult(0);  // Reset selected result for new search
    }

    if (!isOpen || !preLoadData) return null;

    const highlight = (needle, haystack) => {
        haystack = haystack.replace(/[0-9]/g, '');
        const full_pattern =  new RegExp(needle.replace(/(ing|s|es|ed)$/,'') + ".*?(\\b| )", 'gi');
        if(full_pattern.test(haystack)) return Parser(haystack.replace(full_pattern, (str) => `<em>${str.trim()}</em> `));

        let needles = needle.split(/[ ,.;!?]+/).map(str=>(new RegExp("\\b"+str.replace(/(ing|s|es|ed)$/,'')  + ".*?\\b", 'gi')));
        for(let i in needles)
        {
          haystack = haystack.replace(needles[i], (str) => `<em>${str}</em>`);
        }
        haystack = haystack.replace(/<\/em>\s+<em>/," ");
        return Parser(haystack);

      }

    return (
        <Card className="search-popup">
            <CardHeader>
                <div className='close'>🔍</div>
                <input type="text" placeholder={label(placeholder)} onChange={handleTyping} defaultValue={""} ref={searchInputRef}/>
                <div onClick={() => setIsOpen(false)} className='close'>×</div>
            </CardHeader>
            <CardBody>
                <div className="search-results" ref={resultsRef}>
                    {searchString && searchResults.length && searchResults.map((result, index) => {
                        const isLastInGroup = index < searchResults.length - 1 && result.className !== searchResults[index + 1].className;
                        return (
                            <div
                            onClick={() => selectItemHandler(result.slug)}
                            onMouseEnter={() => setSelectedResult(index)}
                            key={index} className={`search-result ${result.className} ${index === selectedResult ? 'selected' : ''} ${isLastInGroup ? 'last' : ''}`}>
                                <img alt={`${result.name}`} src={`${assetUrl}/${assetName}/${result.slug}`}  key={`${result.slug}`} />
                                <div>
                                    <div className={`search-result-${testFieldNames.primary}`}>{highlight(searchString, result[testFieldNames.primary])}</div>
                                    <div className={`search-result-${testFieldNames.secondary}`}>{highlight(searchString, result[testFieldNames.secondary])}</div>
                                </div>
                            </div>
                        );
                    }) || searchString &&
                    <div className="search-result no-results">{label("no_results_found")}</div> ||
                    <div className="search-result no-results">{label("start_typing_to_search")}</div>}
                </div>
            </CardBody>
        </Card>
    );
}
