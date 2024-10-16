//import Bible.css
import React, { useEffect, useState } from "react";
import "./Bible.css";
import { generateReference, lookupReference } from "scripture-guide";
import { index } from "./data";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import { Spinner } from "../../_Common/Loader";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import { highlightTextJSX } from "./highlighter";
import { getStartEnd } from "./Bible";


export default function VerseViewer({ verseViewerContent, setVerseViewerContent }) {
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setVerseViewerContent(null);
            }
        };
    
        document.addEventListener("keydown", handleKeyDown);
    
        // Cleanup function to remove the event listener
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [setVerseViewerContent]);

    const selectedRowBook = verseViewerContent.rowbook.val;
    const selectedColBook = verseViewerContent.colbook.val;

    const [verseContent, setVerseContent] = useState(null);
    const [versehighlights, setVerseHighlights] = useState({});
    const rowKey = verseViewerContent.rowbook.key;
    const colKey = verseViewerContent.colbook.key;
    const rowVerseRange = getStartEnd("books", { key: rowKey });
    const colVerseRange = getStartEnd("books", { key: colKey });
    const matches = index.filter(([rowVid, colVid, isQuote]) => {
        const hasRows = rowVerseRange?.[0] >= 1;
        const hasCols = colVerseRange?.[0] >= 1;
        const rowCondition = hasRows ? rowVid >= rowVerseRange[0] && rowVid <= rowVerseRange[1] : true;
        const colCondition = hasCols ? colVid >= colVerseRange[0] && colVid <= colVerseRange[1] : true;
        return rowCondition && colCondition;
    }).map(([rowVid, colVid, isQuote]) => {
        const rowRef = generateReference(colVid);
        const colRef = generateReference(rowVid);
        return { rowVid, colVid, isQuote, rowRef, colRef };
    });
    const allMatchedVerseIds = matches.map(({ rowVid, colVid }) => [rowVid, colVid]).flat()
    .filter((vid, index, self) => self.indexOf(vid) === index)
    .sort((a, b) => a - b);

    console.log({ allMatchedVerseIds, matches });
    useEffect(() => {
        if (allMatchedVerseIds.length === 0) {
            //console.log(JSON.stringify({ rowVerseRange, colVerseRange }));
            alert("No verses found");
            return setVerseViewerContent(null);
        }

        const versePairs = matches.map(({ rowVid, colVid }) => [rowVid, colVid]);
        BoMOnlineAPI({
           verses: allMatchedVerseIds,
           versehighlights: versePairs
          }, {useCache: false})
            .then(({ verses, versehighlights }) => { 
                setVerseContent(Object.values(verses));
                setVerseHighlights(versehighlights);
            
            });
    }, []);

    const findVerseData = (vid) => {
        return verseContent.find(({ verse_id }) => verse_id === vid);
    }

    const [sort, setSort] = useState({ column: "row", direction: "asc" });
    const handleSort = (column) => {
        const isAsc = sort.column === column && sort.direction === "asc";
        setSort({ column, direction: isAsc ? "desc" : "asc" });
    };

    const history = useHistory();

    const navigateToSearch = (ref) => {
        const verse_id = lookupReference(ref).verse_ids[0];
        //copy to clipboard
        navigator.clipboard.writeText(verse_id);
        alert(`Copied to clipboard: ${ref} (Verse ID: ${verse_id})`);
    };

    if (!verseContent) return <Spinner />;

    const count = matches.length;
    return (
        <div className="verseViewer">
            <div className="verseViewerContent">
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }} className="noselect">
                    <div className="backbutton" onClick={() => setVerseViewerContent(null)}>⬅ Back</div>
                    <h3><span className="book">{selectedRowBook}</span> references to <span className="book">{selectedColBook}</span></h3>
                    <div style={{ flexGrow: 0, width: '100px' }} />
                </div>
                <table className="verseViewerTable">
                    <thead className="noselect">
                        <tr>
                            <th>
                                <h4 style={{ cursor: 'pointer' }} onClick={() => handleSort('row')}>
                                    {selectedRowBook}
                                    <span className={sort.column === 'row' ? 'sort active' : 'sort'}>
                                        {sort.column === 'row' && sort.direction === 'asc' ? '▼' : (sort.column === 'row' ? '▲' : '▽')}
                                    </span>
                                </h4>
                            </th>
                            <th>
                                <h4 style={{ cursor: 'pointer' }} onClick={() => handleSort('col')}>
                                    {selectedColBook}
                                    <span className={sort.column === 'col' ? 'sort active' : 'sort'}>
                                        {sort.column !== 'row' && sort.direction === 'asc' ? '▼' : (sort.column === 'col' ? '▲' : '▽')}
                                    </span>
                                </h4>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {matches
                            .sort((a, b) => {
                                if (sort.column === "row") {
                                    return sort.direction === "asc" ? a.rowVid - b.rowVid : b.rowVid - a.rowVid;
                                } else {
                                    return sort.direction === "asc" ? a.colVid - b.colVid : b.colVid - a.colVid;
                                }
                            })
                            .map(({ rowRef, colRef, isQuote, rowVid, colVid }, i) => {
                                const highlights = versehighlights[`${rowVid},${colVid}`] || [];
                                const prevItem = matches[i - 1] || {};
                                const leftData = findVerseData(rowVid) || {};
                                const rightData = findVerseData(colVid) || {};
                                const { text: leftText, heading: leftHeading } = leftData;
                                const { text: rightText, heading: rightHeading } = rightData;






                                const leftHighlights = highlights.bom_highlight;
                                const rightHighlights = highlights.bible_highlight;

                                const prevVerseIds = prevItem ? [prevItem.rowVid, prevItem.colVid] : [];

                                const prevLeftisSameasCurrentLeft = prevVerseIds.some(vid => vid === rowVid);
                                const prevRightisSameasCurrentRight = prevVerseIds.some(vid => vid === colVid);

                                return (
                                    <React.Fragment key={i}>
                                        <tr key={i + `-tr`} className={isQuote ? "" : ""}>
                                            <td className="scriptureRef left" onClick={() => navigateToSearch(colRef)}>
                                                <div className={`header_container`}>
                                                    <div className="ref">{prevLeftisSameasCurrentLeft ? colRef : colRef}</div>
                                                    <div className="heading noselect">{prevLeftisSameasCurrentLeft ? "" : leftHeading}</div>
                                                </div>
                                            </td>
                                            <td className="scriptureRef right" onClick={() => navigateToSearch(rowRef)}>
                                                <div className={`header_container`}>
                                                <div className="heading noselect">{prevRightisSameasCurrentRight ? "" : rightHeading}</div>
                                                    <div className="ref">{prevRightisSameasCurrentRight ? rowRef : rowRef}</div>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr className={isQuote ? "" : ""}>
                                            <td className="scriptureCell left">
                                                <p>{highlightTextJSX(leftText, leftHighlights, rowVid)}</p>
                                            </td>
                                            <td className="scriptureCell right">
                                                <p>{highlightTextJSX(rightText, rightHighlights, colVid)}</p>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}