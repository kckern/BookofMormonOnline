
//import Bible.css
import { useEffect, useState } from "react";
import "./Bible.css"
import {generateReference, lookupReference} from "scripture-guide";
import { Button } from "reactstrap";
import { index } from "./data";


const levels = ["groups", "books", "chapters", "verses"];

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



    if(level==="groups") { // id is group key, eg "Torah"
        const groups = { ...bible, ...bom };
        const group = groups?.[key] || [];
        const start = group[0]?.[1];
        const end = group[group.length - 1]?.[2];
        return [start, end];
    }
    else if(level==="books") { // id is book name string: eg "1 Nephi"
        const groups = { ...bible, ...bom };
        const books= Object.values(groups).flat();
        const book =books.find(([name]) => name === key);
        const start = book?.[1];
        const end = book?.[2];
        return [start, end];
    }
    else if(level==="chapters") { // id is chapter name string: eg "1 Nephi 1"
        const booklist = Object.values({ ...bible, ...bom }).flat();
        const book_name = key.replace(/\d+$/, "").trim();
        const [_, start, end, chapter_count] = booklist.find(([name]) => name === book_name);
        const firstChapter = lookupReference(`${book_name} 1:1`).verse_ids;
        const lastChapter = lookupReference(`${book_name} ${chapter_count}:`).verse_ids;
        return [firstChapter[0], lastChapter[lastChapter.length - 1]];
    }
    else if(level==="verses") { // id is verse name string: eg "1 Nephi 1:1"
        const verse_ids = lookupReference(key).verse_ids;
        return [verse_ids[0], verse_ids[verse_ids.length - 1]];
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
    const [level_col, setLevelCol] = useState("groups");
    const [level_row, setLevelRow] = useState("groups");
    const [column_id, setColumnId] = useState({key: "bom", val: "bom"}); // BoM as columns
    const [row_id, setRowId] = useState({key: "bible", val: "bible"}); // Bible as rows

    const rows = getColRowValues(level_row, row_id);
    const columns = getColRowValues(level_col, column_id);

    const grid = rows.map(rowId => columns.map(column => {
        const bible = getStartEnd(level_row, {key: rowId.key});
        const bom = getStartEnd(level_col, {key: column.key});
        const bibleVids = Array.from({length: bible[1] - bible[0] + 1}, (_, i) => i + bible[0]);
        const bomVids = Array.from({length: bom[1] - bom[0] + 1}, (_, i) => i + bom[0]);
        const indexItems = index.filter(([bom_vid, bible_vid, isQuote]) => {
            return bibleVids.includes(bible_vid) && bomVids.includes(bom_vid);
        });
        return {indexItems};
    }));

    const maxCount = Math.max(...grid.flat().map(({indexItems}) => indexItems.length));

    const reset = () => {
        setLevelCol("groups");
        setLevelRow("groups");
        setColumnId({key: "bom", val: "bom"});
        setRowId({key: "bible", val: "bible"});  
    };

    const handleColumnClick = (id) => {
        const nextLevel = levels[levels.indexOf(level_col) + 1];
        if (!nextLevel) return;
        setLevelCol(nextLevel);
        setColumnId(id);
    };

    const handleRowClick = (id) => {
        const nextLevel = levels[levels.indexOf(level_row) + 1];
        if (!nextLevel) return;
        setLevelRow(nextLevel);
        setRowId(id);
    };

    return (
        <div className="grid">
            <table className="gridTable">
                <thead>
                    <tr>
                        <th colSpan={2} rowSpan={2}>
                            <button onClick={reset}>RESET</button>
                        </th>
                        <th colSpan={columns.length + 2}>{column_id.val}</th>
                    </tr>
                    <tr>
                        {columns.map((id, i) => (
                            <th key={i} onClick={() => handleColumnClick(id)} className="topHeaders">
                                {id.val}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((rowId, rowIndex) => (
                        <tr key={rowIndex}>
                            
                            {!rowIndex && <td rowSpan={rows.length} className="leftHeader" width={1/rows.length * 100 + "%"} height={1/rows.length * 100 + "%"}>
                                {row_id.val}
                            </td>}
                            <td onClick={() => handleRowClick(rowId)} className="leftHeaders">
                                {rowId.val}
                            </td>
                            {columns.map((column, columnIndex) => (
                                <td key={columnIndex} width={1/columns.length * 100 + "%"} height={1/rows.length * 100 + "%"} align="center">
                                    <GridCell  {...(grid[rowIndex][columnIndex])} maxCount={maxCount}/>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
    
function GridCell({indexItems,maxCount}) {


    const itemCount = indexItems.length;
    const quoteCount = indexItems.filter(([_, __, isQuote]) => isQuote).length;
    const nonQuoteCount = indexItems.length - quoteCount;
    const percentage = (Math.log10(indexItems.length + 1) / Math.log10(maxCount + 1)) * 100;    
    const hex = Math.floor(percentage * 2.55).toString(16);
      const green = "20c997"; 


    const minRadius = "2";
    const maxRadius = "6";
    const unit = "ex";
    const diff = maxRadius - minRadius;
    const itemDiff = diff * percentage / 100;
    const radius = parseInt(minRadius) + itemDiff;

   

    return (
        <div className="gridCell"  >
            {!!quoteCount && <div style={{
                borderRadius: "50%",
                color: "white",
                fontSize: "1.5em",
                lineHeight: radius + "ex",
                width: radius + unit,
                height: radius + "ex",
                backgroundColor:  `#${green}${hex}`,
                display: "inline-block",
                maxWidth: maxRadius + unit,
                maxHeight: maxRadius + unit
            }}>
                {itemCount}
            </div>}
        </div>
    );
}



function Container() {
    return <div className="container">
        <Bible />
    </div>
}   



export default Container;