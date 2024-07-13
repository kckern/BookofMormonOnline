//import Bible.css
import React, { useEffect, useState } from "react";
import "./Bible.css"
import {generateReference, lookupReference} from "scripture-guide";
import { Button } from "reactstrap";
import { index } from "./data";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
import DiffMatchPatch from 'diff-match-patch';
import { Spinner } from "../../_Common/Loader";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";

const diffMatchPatch = new DiffMatchPatch();
DiffMatchPatch.DIFF_EQUAL = 0;

const levels = ["groups", "books"];

const bible = {
    "Torah": [
        ["Genesis", 1, 1533, 50],
        ["Exodus", 1534, 2746, 40],
        ["Leviticus", 2747, 3605, 27],
        ["Numbers", 3606, 4893, 36],
        ["Deuteronomy", 4894, 5852, 34]
    ],
    "Historical": [
        ["Joshua", 5853, 6510, 24],
        ["Judges", 6511, 7128, 21],
        ["Ruth", 7129, 7213, 4],
        ["1 Samuel", 7214, 8023, 31],
        ["2 Samuel", 8024, 8718, 24],
        ["1 Kings", 8719, 9534, 22],
        ["2 Kings", 9535, 10253, 25],
        ["1 Chronicles", 10254, 11195, 29],
        ["2 Chronicles", 11196, 12017, 36],
        ["Ezra", 12018, 12297, 10],
        ["Nehemiah", 12298, 12703, 13],
        ["Esther", 12704, 12870, 10]
    ],
    "Wisdom": [
        ["Job", 12871, 13940, 42],
        ["Psalms", 13941, 16401, 150],
        ["Proverbs", 16402, 17316, 31],
        ["Ecclesiastes", 17317, 17538, 12],
        ["Solomon's Song", 17539, 17655, 8]
    ],
    "Major Prophets": [
        ["Isaiah", 17656, 18947, 66],
        ["Jeremiah", 18948, 20311, 52],
        ["Lamentations", 20312, 20465, 5],
        ["Ezekiel", 20466, 21738, 48],
        ["Daniel", 21739, 22095, 12]
    ],
    "Minor Prophets": [
        ["Hosea", 22096, 22292, 14],
        ["Joel", 22293, 22365, 3],
        ["Amos", 22366, 22511, 9],
        ["Obadiah", 22512, 22532, 1],
        ["Jonah", 22533, 22580, 4],
        ["Micah", 22581, 22685, 7],
        ["Nahum", 22686, 22732, 3],
        ["Habakkuk", 22733, 22788, 3],
        ["Zephaniah", 22789, 22841, 3],
        ["Haggai", 22842, 22879, 2],
        ["Zechariah", 22880, 23090, 14],
        ["Malachi", 23091, 23145, 4]
    ],
    "Gospels & Acts": [
        ["Matthew", 23146, 24216, 28],
        ["Mark", 24217, 24894, 16],
        ["Luke", 24895, 26045, 24],
        ["John", 26046, 26924, 21],
        ["Acts", 26925, 27931, 28]
    ],
    "Pauline Epistles": [
        ["Romans", 27932, 28364, 16],
        ["1 Corinthians", 28365, 28801, 16],
        ["2 Corinthians", 28802, 29058, 13],
        ["Galatians", 29059, 29207, 6],
        ["Ephesians", 29208, 29362, 6],
        ["Philippians", 29363, 29466, 4],
        ["Colossians", 29467, 29561, 4],
        ["1 Thessalonians", 29562, 29650, 5],
        ["2 Thessalonians", 29651, 29697, 3],
        ["1 Timothy", 29698, 29810, 6],
        ["2 Timothy", 29811, 29893, 4],
        ["Titus", 29894, 29939, 3],
        ["Philemon", 29940, 29964, 1]
    ],
    "General Epistles": [
        ["Hebrews", 29965, 30267, 13],
        ["James", 30268, 30375, 5],
        ["1 Peter", 30376, 30480, 5],
        ["2 Peter", 30481, 30541, 3],
        ["1 John", 30542, 30646, 5],
        ["2 John", 30647, 30659, 1],
        ["3 John", 30660, 30673, 1],
        ["Jude", 30674, 30698, 1]
    ],
    "Apocalyptic": [
        ["Revelation", 30699, 31102, 22]
    ]
};

const bom = {
    "Small Plates": [
        ["1 Nephi", 31103, 31720, 22],
        ["2 Nephi", 31721, 32499, 33],
        ["Jacob", 32500, 32702, 7],
        ["Enos", 32703, 32729, 1],
        ["Jarom", 32730, 32744, 1],
        ["Omni", 32745, 32774, 1]
    ],
    "Plates of Mormon": [
        ["Words of Mormon", 32775, 32792, 1],
        ["Mosiah", 32793, 33577, 29],
        ["Alma", 33578, 35552, 63],
        ["Helaman", 35553, 36049, 16],
        ["3 Nephi", 36050, 36834, 30],
        ["4 Nephi", 36835, 36883, 1],
        ["Mormon", 36884, 37032, 7]
    ],
    "Moroni": [
        ["Mormon",37033,37110, 2],
        ["Ether", 37111, 37543, 15],
        ["Moroni", 37544, 37706, 10]
    ]
};


function getStartEnd(level, {key}) {

    const allGroups = { ...bible, ...bom };
    const allBooks = Object.values(allGroups).flat();
    if(level==="groups") { // id is group key, eg "Torah"
        const group = allGroups?.[key] || [];
        const start = group[0]?.[1];
        const end = group[group.length - 1]?.[2];
        return [start, end];
    }
    if(level==="books") { // id is book name string: eg "1 Nephi"
        const book = allBooks.find(([name]) => name === key);
        if(!book) return [0, 0];
        return [book[1], book[2]];
    }

    return [0, 0];
}


const getColRowValues = (level, id) => {
    const items = { ...bible, ...bom };

    if(level === "groups") { // id is bible or bom
        if(id.key === "bible") return Object.keys(bible).map(key => ({key, val: key}));
        if(id.key === "bom") return Object.keys(bom).map(key => ({key, val: key}));
    } 
    else if(level === "books") { // id is group key, eg "Torah"
        return items[id.key].map(([name]) => ({key: name, val: name}));
    }
    else if(level === "chapters") { // id is book name string: eg "1 Nephi"
        const books = Object.values(items).flat();
        const book = books.find(([name]) => name === id.key);
        const [book_name, start, end, chapters] = book;
        const chaptersArray = Array.from({length: chapters}, (_, i) => i + 1);
        return chaptersArray.map(chapter => ({key: `${book_name} ${chapter}`, val: `${chapter}`}));
    }
    else if(level === "verses") { // id is chapter name string: eg "1 Nephi 1"
        const verse_ids = lookupReference(id.key).verse_ids;
        const verseArray = Array.from({length: verse_ids.length}, (_, i) => i + 1);
        return verseArray.map(verse => ({key: `${id.key}:${verse}`, val: `v${verse}`}));

    }



    return ["A", "B", "C", "D"];
}



function Bible() {
    const [level_row, setLevelRow] = useState("groups");
    const [level_col, setLevelCol] = useState("groups");
    const [row_id, setRowId] = useState({key: "bom", val: "Book of Mormon"}); // BoM as rows
    const [column_id, setColumnId] = useState({key: "bible", val: "Bible"}); // Bible as columns
    const [verse_viewer_content, setVerseViewerContent] = useState(null);

    const columns = getColRowValues(level_col, column_id);
    const rows = getColRowValues(level_row, row_id);

    const grid = rows.map(rowId => columns.map(column => {
        const bom = getStartEnd(level_row, {key: rowId.key});
        const bible = getStartEnd(level_col, {key: column.key});
        const bomVids = Array.from({length: bom[1] - bom[0] + 1}, (_, i) => i + bom[0]);
        const bibleVids = Array.from({length: bible[1] - bible[0] + 1}, (_, i) => i + bible[0]);
        const indexItems = index.filter(([bom_vid, bible_vid, isQuote]) => {
            // Ensure bom_vid and bible_vid are treated as the same type as elements in bomVids and bibleVids
            const bom_vid_num = Number(bom_vid);
            const bible_vid_num = Number(bible_vid);
            return bibleVids.includes(bible_vid_num) && bomVids.includes(bom_vid_num);
        });
        return {indexItems};
    }));
    const maxCount = Math.max(...grid.flat().map(({indexItems}) => indexItems.length));

    const openVerseViewer = (rowbook, colbook) => {
        setVerseViewerContent({rowbook, colbook});
    };


    const isBaseState = () => {
        return level_row === "groups" && level_col === "groups";
    }

    const handleRowClick = (id, count) => {
        if(!count) return;
        const nextLevel = levels[levels.indexOf(level_row) + 1];
        if (!nextLevel) return openVerseViewer(id, column_id);
        setLevelRow(nextLevel);
        setRowId(id);
    };

    const handleColumnClick = (id, count) => {
        if(!count) return;
        const nextLevel = levels[levels.indexOf(level_col) + 1];
        if (!nextLevel) return openVerseViewer(row_id, id);
        setLevelCol(nextLevel);
        setColumnId(id);
    };
    const handleBackClick = () => {

        setLevelRow("groups");
        setLevelCol("groups");
        setRowId({key: "bom", val: "Book of Mormon"});
        setColumnId({key: "bible", val: "Bible"}); 
       
    };

    const handleCircleClick = (rowId, colId) => {
        const nextRowLevel = levels[levels.indexOf(level_row) + 1];
        const nextColLevel = levels[levels.indexOf(level_col) + 1];
        if(nextRowLevel && nextColLevel) {
            handleRowClick(rowId);
            handleColumnClick(colId);
        }
        else{
            openVerseViewer(rowId, colId);
        }
    }

    const gridState = {level_row, level_col, row_id, column_id, handleRowClick, handleColumnClick, handleCircleClick};

    if(verse_viewer_content) return <VerseViewer verse_viewer_content={verse_viewer_content} setVerseViewerContent={setVerseViewerContent} />;

    
    const columnSums = columns.map((_, i) => grid.map(row => row[i].indexItems.length).reduce((a, b) => a + b, 0));
    const rowSums = grid.map(row => row.map(({indexItems}) => indexItems.length).reduce((a, b) => a + b, 0));
    return (
        <div className="grid">
            <h4>Bible Quotes and Phrases</h4>
            <table className="gridTable">
                <thead className="noselect">
                    <tr>
                        <th colSpan={2} rowSpan={2}>
                            { !isBaseState() && <div className="backbutton" onClick={() => handleBackClick()}>⬅ Back</div>}
                        </th>
                        <th colSpan={columns.length + 2}>{column_id.val}</th>
                    </tr>
                    <tr>
                        {columns.map((id, i) => (
                            <th key={i} onClick={() => handleColumnClick(id, columnSums[i])} className="topHeaders">
                                <div className="topHeaderContainer">
                                    <div>{id.val}</div>
                                    {!!columnSums[i] && <div className="topHeaderCount">{columnSums[i]}</div>}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((rowId, rowIndex) => (
                        <tr key={rowIndex}>
                            {!rowIndex && (
                                <td rowSpan={rows.length} className="leftHeader noselect" width={(1 / rows.length) * 100 + "%"} height={(1 / rows.length) * 100 + "%"}>
                                    {row_id.val}
                                </td>
                            )}
                            <td onClick={() => handleRowClick(rowId, rowSums[rowIndex])} className="leftHeaders noselect">
                                <div className="leftHeaderContainer">
                                    <div>{rowId.val.split(' of ').map((part, index, array) => (
                                        <React.Fragment key={index}>
                                            {part}{index < array.length - 1 ? <> of <br /></> : ''}
                                        </React.Fragment>
                                    ))}</div>
                                
                                    {!!rowSums[rowIndex] && <div className="leftHeaderCount">{rowSums[rowIndex]}</div>}
                                </div>
                                
                            </td>
                            {columns.map((colId, columnIndex) => (
                                <td key={columnIndex} width={(1 / columns.length) * 100 + "%"} height={(1 / rows.length) * 100 + "%"} align="center" className="gridCellContainer noselect">
                                    <GridCell  
                                        {...(grid[rowIndex][columnIndex])} 
                                        maxCount={maxCount} 
                                        gridState={{...gridState, rowId, colId}} // Pass rowId and colId to gridState
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
    
    
}

function GridCell({ indexItems, maxCount, gridState }) {
    const itemCount = indexItems.length;

    // Extract row and column labels directly from gridState, which contains current iteration values
    const rowLabel = gridState.rowId.val;
    const colLabel = gridState.colId.val;

    const quoteCount = indexItems.filter(([_, __, isQuote]) => isQuote).length;
    const nonQuoteCount = indexItems.length - quoteCount;
    const percentage = (Math.log10(indexItems.length + 1) / Math.log10(maxCount + 1)) * 100;

    const minRadius = 2; // Assuming these should be numbers for mathematical operations
    const maxRadius = 6;
    const unit = "ex";
    const logBase = 10; // Base for logarithmic calculation, can be adjusted as needed

    // Calculate the logarithmic scale factor
    const scaleFactor = Math.log(maxRadius / minRadius) / Math.log(logBase);

    // Apply the logarithmic scale based on the percentage
    const radius = minRadius * Math.pow(logBase, scaleFactor * percentage / 100);

    const handleClick = () => {
        const { rowId, colId } = gridState;
        gridState.handleCircleClick(rowId, colId);
    }

    return (
        <div className="gridCell noselect">
            {!!itemCount ? <div style={{
                borderRadius: "50%",
                color: "white",
                fontSize: "1.5em",
                lineHeight: radius + "ex",
                width: radius + unit,
                height: radius + "ex",
                opacity: percentage / 100,
                display: "inline-block",
                maxWidth: maxRadius + unit,
                maxHeight: maxRadius + unit
            }} onClick={handleClick} className="quoteCountCircle">
                {itemCount}
            </div> : <div className="emptyCell" />}
        </div>
    );
}



function Container() {
    return <div className="container">
        <Bible />
    </div>
}   



function VerseViewer({verse_viewer_content, setVerseViewerContent}) {
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

    const selectedRowBook = verse_viewer_content.rowbook.val
    const selectedColBook = verse_viewer_content.colbook.val

    const [verseContent, setVerseContent] = useState(null);
    const rowKey = verse_viewer_content.rowbook.key;
    const colKey = verse_viewer_content.colbook.key;
    const rowVerseRange = getStartEnd("books", {key: rowKey});
    const colVerseRange = getStartEnd("books", {key: colKey});

        const matches = index.filter(([rowVid, colVid, isQuote]) => {
            const hasRows = rowVerseRange?.[0] > 1;
            const hasCols = colVerseRange?.[0] > 1;
            const rowCondition = hasRows ? rowVid >= rowVerseRange[0] && rowVid <= rowVerseRange[1] : true;
            const colCondition = hasCols ? colVid >= colVerseRange[0] && colVid <= colVerseRange[1] : true;
            return rowCondition && colCondition;
        }).map(([rowVid, colVid, isQuote]) => {
            const rowRef = generateReference(colVid);
            const colRef = generateReference(rowVid);
            return {rowVid, colVid, isQuote, rowRef, colRef};
        });



    useEffect(() => {
        const allMatchedVerseIds = matches.map(({rowVid, colVid}) => [rowVid, colVid]).flat(); 
        if(allMatchedVerseIds.length === 0) {
            console.log(JSON.stringify({rowVerseRange, colVerseRange}));
            alert("No verses found");
            return setVerseViewerContent(null);
        }
        BoMOnlineAPI({verses:allMatchedVerseIds})
            .then(({verses}) => { setVerseContent(Object.values(verses)); });
    }, []);

    const findVerseData = (vid) => {
        return verseContent.find(({verse_id}) => verse_id === vid);
    }

    const [sort, setSort] = useState({ column: "row", direction: "asc" });
    const handleSort = (column) => {
        const isAsc = sort.column === column && sort.direction === "asc";
        setSort({ column, direction: isAsc ? "desc" : "asc" });
    };
    
    const history = useHistory();

    const navigateToSearch = (ref) => {
      history.push(`/search/${ref}`);
    };

    if (!verseContent) return <Spinner />;


    const count = matches.length;
    return (
        <div className="verseViewer">
            <div className="verseViewerContent">
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }} className="noselect">
                    <div className="backbutton" onClick={() => setVerseViewerContent(null)}>⬅ Back</div>
                    <h3><span className="count">{count}</span> references to <span className="book">{selectedColBook}</span> in <span className="book">{selectedRowBook}</span></h3>
                    <div style={{ flexgrow: 0, width: '100px' }}/>
                </div>
                <table className="verseViewerTable ">
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
                        .map(({rowRef, colRef, isQuote, rowVid, colVid}, i) => {
                            const prevItem = matches[i - 1]||{};
                            console.log(JSON.stringify({i,prevItem}));
                            const leftData = findVerseData(colVid) || {};
                            const rightData = findVerseData(rowVid) || {};
                            const {text: leftText, heading: leftHeading} = leftData;
                            const {text: rightText, heading: rightHeading} = rightData;

                            const smallWords = ["and", "the", "their", "of", "an", 
                            "in", "to", "with", "for", "on", "as", "by", "at",
                            "from", "that", "which", "this", "these", "those", "there", "here"];

                            const isOnlySmallWords = (text) => text.toLowerCase().trim().split(" ").every(word => smallWords.includes(word));

                            const commonStrings = diffMatchPatch.diff_main(leftText || "", rightText || "");
                            const common = commonStrings.filter(([type]) => type === DiffMatchPatch.DIFF_EQUAL).map(([, text]) => text).map(i => i.trim())
                            .map(i => i.replace(/^[a-z]{0,1}[^a-z]+/i, "").replace(/[^a-z]+[a-z]{0,1}$/i, ""))
                            .filter(i => i.length > 5 && !isOnlySmallWords(i))
                            .sort((a, b) => b.length - a.length).slice(0, 10);

                            const highlightTextJSX = (text, arrayOfStrings) => {
                                if (!arrayOfStrings || arrayOfStrings.length === 0) return text;

                                let parts = [];
                                let currentIndex = 0;

                                arrayOfStrings.forEach(str => {
                                    let match;
                                    const regex = new RegExp(str, "gi");
                                    while ((match = regex.exec(text)) !== null) {
                                        parts.push({ start: match.index, end: regex.lastIndex, match: match[0] });
                                    }
                                });

                                parts.sort((a, b) => a.start - b.start);

                                const result = [];
                                parts.forEach(part => {
                                    if (part.start >= currentIndex) {
                                        if (part.start > currentIndex) {
                                            result.push(<span key={currentIndex}>{text.substring(currentIndex, part.start)}</span>);
                                        }
                                        result.push(<span key={part.start} className="highlight">{part.match}</span>);
                                        currentIndex = part.end;
                                    }
                                });

                                if (currentIndex < text.length) {
                                    result.push(<span key={currentIndex}>{text.substring(currentIndex)}</span>);
                                }

                                return <>{result}</>;
                            };

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
                                <td className="scriptureRef right" onClick={() => navigateToSearch(colRef)}>
                                    <div className={`header_container`}>
                                        <div className="ref">{prevRightisSameasCurrentRight ? rowRef : rowRef}</div>
                                        <div className="heading noselect">{prevRightisSameasCurrentRight ? "" : rightHeading}</div>
                                    </div>
                                </td>
                                </tr>
                                <tr className={isQuote ? "" : ""}>
                                <td className="scriptureCell left" >
                                    <p>{highlightTextJSX(rightText, common)}</p>
                                </td>
                                <td className="scriptureCell right" >
                                    <p>{highlightTextJSX(leftText, common)}</p>
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


export default Container;