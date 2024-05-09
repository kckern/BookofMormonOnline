
import Parser from "html-react-parser";
import ReactTooltip from "react-tooltip";

const key = {
    "0": ["Original Manuscript (𝒪)", "The original manuscript, 1828–1829 (28 percent extant, not counting the lost 116 pages); written down by Oliver Cowdery and other scribes from dictation by Joseph Smith"],
    "1": ["Printer’s Manuscript (𝓟)", "The printer’s manuscript, August 1829–March 1830; a handwritten copy of the original manuscript"],
    "A": ["1830", "The first edition, published in Palmyra, New York; printed by E. B. Grandin, with typesetting by John Gilbert; set from the printer’s manuscript except for Helaman 13– Mormon 9, which was set from the original manuscript"],
    "B": ["1837", "The second edition, published in Kirtland, Ohio; printed by the Church, with major editing by Joseph Smith"],
    "C": ["1840", "The third edition, published in Nauvoo, Illinois; typeset, stereotyped, and printed in Cincinnati, Ohio, by Shepard and Stearns, with minor editing by Joseph Smith (including a few restored phrases from the original manuscript); various impressions printed with stereotyped plates in Nauvoo (up through 1842)"],
    "D": ["1841", "The first British edition, published in Liverpool, England; printed by J. Tompkins for Brigham Young, Heber C. Kimball, and Parley P. Pratt; this edition is basically a retypesetting of the 1837 edition"],
    "E": ["1849", "The second British edition, published in Liverpool, England; printed by Richard James for Orson Pratt, with minor editing by Pratt"],
    "F": ["1852", "The third British edition, published in Liverpool, England; typeset by William Bowden for Franklin D. Richards, with printing from stereotyped plates; the second impression from the stereotyped plates (also in 1852) includes a considerable number of changes based on the 1840 edition; the stereotyped plates were later taken to Utah and used to print additional issues of this edition (up through 1877)"],
    "G": ["1858W", "A private edition published in New York City by James O. Wright (also issued in 1860 with a new introduction by Zadoc Brook); this edition is based on the 1840 edition and was used by RLDS church members until their first edition was published in 1874"],
    "H": ["1874R", "The first RLDS edition, published in Plano, Illinois (later issued from Lamoni, Iowa); this edition is based on both the 1840 Nauvoo edition and the 1858 Wright edition"],
    "I": ["1879", "A major LDS edition published in Liverpool, England; typeset by William Budge for Orson Pratt, with minor editing by Pratt; two sets of stereotyped plates were produced, of which one set remained in England and the other was taken to Utah; for this edition Pratt divided up the original chapters and assigned the verse numbers that have continued in the LDS text"],
    "J": ["1888", "A large-print LDS edition published in Salt Lake City, Utah, by the Juvenile Instructor"],
    "K": ["1892R", "The second RLDS edition, published in Lamoni, Iowa; a large-print edition, printed in double columns"],
    "L": ["1902", "A missionary edition published in Kansas City, Missouri; printed by Burd and Fletcher"],
    "M": ["1905", "A missionary edition published in Chicago, Illinois; prepared by German Ellsworth and printed by Henry C. Etten; for the third impression of this edition (in 1907), Ellsworth made some editorial changes in the plates"],
    "N": ["1906", "A large-print edition published in Salt Lake City, Utah, by The Deseret News"],
    "O": ["1907", "A vest-pocket edition published in Salt Lake City, Utah, by the Deseret Sunday School Union"],
    "P": ["1908R", "The third RLDS edition, a major edition published in Lamoni, Iowa, with numerous corrections based on the printer’s manuscript"],
    "Q": ["1911", "A large-print edition published in Chicago, Illinois; prepared by German Ellsworth and printed by Henry C. Etten (the date 1911 is uncertain)"],
    "R": ["1920", "A major LDS edition published in Salt Lake City, Utah; printed in Hammond, Indiana, by W. B. Conkey; double columns and chapter summaries are introduced into the LDS text, with considerable grammatical editing, plus some restoration of readings from earlier editions"],
    "S": ["1953R", "The current RLDS edition, published in Independence, Missouri; a minor revision of the 1908 RLDS edition"],
    "T": ["1981", "The current LDS edition, published in Salt Lake City, Utah; a revision of the 1920 LDS edition, with some restoration of original readings by examination of the two manuscripts"]
  }

  const changes = {
    ">+": "change w/ more ink",
    ">–": "change w/ less ink",
    ">%": "change w/ erasure of the original ink",
    ">p": "correction is in pencil",
    ">b": "correction is in blue ink",
    ">jg": "corrected by John Gilbert",
    ">js": "corrected by Joseph Smith",
    ">+–": "correction was heavy in ink flow but the second part was weak",
    ">": "change"
  }


function ATVHeader({ atvHTML }) {
    if (!atvHTML) return null;
    atvHTML = atvHTML.replace("\n", " ").replace(/\s+/g, " ");
  
    atvHTML = atvHTML.replace(/\[([^]+?)\]/g, ATVBrackets);
  
    return <>
        <div className="atv">{Parser(atvHTML)}</div>
        <ReactTooltip id="atv-tooltip" place="top" effect="solid" />
    </>
  }
  
function ATVBrackets(a, string) {
    string = string.replace("NULL", "<b>∅</b>");
    const parts = string.split("|").map((i) => {
      let indexes = i.match(/[A-Z01]+$/)[0];
      let content = i.replace(indexes, "").trim();
      if(!content) content = "<b>∅</b>";
      return [content, indexes];
    });
  
    const result =  parts
      .map(
        (i) => {
            const changeKeys = Object.keys(changes);
            let item = i[0]
            .replace(/&gt;/g, ">");

            for(const key of changeKeys) {
                const replacement = changes[key];
                const oitem = item + "";
                item = item.replace(` ${key} `, `<span class="atv-change">⮕ </span>`);
                if(oitem !== item) break;
            }

            const letters = i[1].split("");
            const matches = letters.map((l) => key[l][0]).join("; ");

            return `<span class="atv-string" data-indexes="${i[1]}" data-tip="${matches}" data-for="atv-tooltip">${item}</span>`;
        },
      )
      .join(" / ") ;

    return result; 
}

  
  export { ATVHeader, ATVBrackets };