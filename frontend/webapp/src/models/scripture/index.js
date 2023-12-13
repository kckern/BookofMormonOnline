import scriptdata from "./data/scriptdata.json.js";
import scriptregex from "./data/scriptregex.json.js";

const lookupReference = function(query) {
  //Cleanup
  let ref = cleanReference(query);
  //Break compound reference into array of single references
  let refs = splitReferences(ref);

  //Lookup each single reference individually, return the set
  let verse_ids = [];
  for (let i in refs) {
    verse_ids = verse_ids.concat(lookupSingleRef(refs[i]));
  }
  return {
    query: query,
    ref: ref,
    verse_ids: verse_ids,
  };
};

const lookupSingleRef = function(ref) {
  if (ref.match(/[—-](\d\s)*[A-Za-z]/gi)) return lookupMultiBookRange(ref);
  let book = getBook(ref);
  if (!book) return [];
  let ranges = getRanges(ref);
  let verse_ids = loadVerseIds(book, ranges);
  return verse_ids;
};

const generateReference = function(verse_ids) {
  let ranges = loadVerseStructure(verse_ids);
  let refs = loadRefsFromRanges(ranges);
  let ref = refs.join("; ");
  return ref;
};

const lookupMultiBookRange = function(cleanRef) {
  //eg Matthew 15—Mark 2

  let range = cleanRef.split(/[—-]/);
  if (!range[0].match(/[:]/)) {
    if (range[0].match(/\d+\s*$/)) range[0] = range[0].trim() + ":" + 1;
    else range[0] = range[0].trim() + " 1:1";
  }
  if (!range[1].match(/[:]/)) {
    let matches = range[1].match(/(.*?)\s(\d+)$/);
    if (matches === null) {
      //find end of book
      let maxChapter = loadMaxChapter(range[1]);
      let maxverse = loadMaxVerse(range[1], maxChapter);
      range[1] = range[1] + " " + maxChapter + ":" + maxverse;
      // console.log(range);
    } else {
      let maxverse = loadMaxVerse(cleanReference(matches[1]), matches[2]);
      range[1] = range[1] + ":" + maxverse;
    }
  }
  let start = lookupSingleRef(range[0])[0];
  let end = lookupSingleRef(range[1])[0];
  let all_verse_ids = [];
  for (let i = start; i <= end; i++) all_verse_ids.push(i);
  return all_verse_ids;
};

const cleanReference = function(messyReference) {
  let ref = messyReference.trim();

  //Build Regex rules
  let regex = scriptregex.pre_rules;
  for (let i in regex) {
    var re = new RegExp(regex[i][0], "ig");
    ref = ref.replace(re, regex[i][1]);
  }
  regex = scriptregex.books;
  //process book Fixes
  for (let i in regex) {
    var re = new RegExp("\\b" + regex[i][0] + "\\.*\\b", "ig");
    ref = ref.replace(re, regex[i][1]);
  }

  regex = scriptregex.post_rules;
  for (let i in regex) {
    var re = new RegExp(regex[i][0], "ig");
    ref = ref.replace(re, regex[i][1]);
  }

  //Treat commas as semicolons in the absence of verses
  if (!ref.match(/:/)) ref = ref.replace(/,/, ";");

  let cleanReference = ref.trim();

  return cleanReference;
};
const splitReferences = function(compoundReference) {
  let refs = compoundReference.split(/\s*;\s*/);
  let runningBook = null;
  let completeRefs = [];
  for (let i in refs) {
    let pieces = refs[i].split(/([0-9:,-]+)$/);
    if (pieces[0].length > 0) runningBook = pieces[0].trim();
    if (pieces[1] == undefined) pieces[1] = "";
    completeRefs.push((runningBook + " " + pieces[1]).trim());
  }
  return completeRefs;
};
const getBook = function(ref) {
  let book = ref.replace(/([ 0-9:,-]+)$/, "").trim();
  if (bookExists(book)) return book;
  return false;
};
const getRanges = function(ref) {
  let ranges = [];
  let numbers = ref.replace(/.*?([0-9: ,-]+)$/, "$1").trim();
  let isChaptersOnly = numbers.match(/:/) ? false : true;
  let isRange = !numbers.match(/-/) ? false : true;
  let isSplit = !numbers.match(/,/) ? false : true;
  // Genesis 1,3-5
  if (isChaptersOnly && isSplit && isRange) {
    let chapterRanges = numbers.split(/,/);
    for (let i in chapterRanges) {
      //3-5
      if (chapterRanges[i].match(/-/)) {
        let chapterStartandEnd = chapterRanges[i].split(/-/);
        let startChapter = parseInt(chapterStartandEnd[0], 0);
        let endChapter = parseInt(chapterStartandEnd[1], 0);
        let chapterRange = [];
        for (var j = startChapter; j <= endChapter; j++) {
          ranges.push(j + ": 1-X");
        }
      }
      //1
      else {
        ranges.push(chapterRanges[i] + ": 1-X");
      }
    }
  }
  // Genesis 1,3
  else if (isChaptersOnly && isSplit) {
    let chapters = numbers.split(/,/);
    ranges = chapters.map((chapter) => chapter + ": 1-X");
  }
  //Genesis 1-2
  else if (isChaptersOnly && isRange) {
    let chapterStartandEnd = numbers.split(/-/);
    let startChapter = parseInt(chapterStartandEnd[0], 0);
    let endChapter = parseInt(chapterStartandEnd[1], 0);
    let chapterRange = [];
    for (var j = startChapter; j <= endChapter; j++) {
      chapterRange.push(j);
    }
    ranges = chapterRange.map((chapter) => chapter + ": 1-X");
  }
  //Genesis 1
  else if (isChaptersOnly) {
    ranges = [numbers + ": 1-X"];
  }
  //Genesis 1:1-5,10
  else if (isRange && isSplit) {
    let mostRecentChapter = null;
    let split = numbers.split(/,/);
    let verses = null;
    for (let i in split) {
      // 2:2   OR   1:1-4
      let chapter = "";
      if (split[i].match(/:/)) {
        let pieces = split[i].split(/:/);
        chapter = mostRecentChapter = pieces[0];
        verses = pieces[1];
      }
      //3   or 6-7
      else {
        chapter = mostRecentChapter;
        verses = split[i];
      }
      ranges.push(chapter + ": " + verses.trim());
    }
  }
  // Genesis 1:3,5
  else if (isSplit) {
    let split = numbers.split(/,/);
    let mostRecentChapter = null;
    let verses = null;
    for (let i in split) {
      //Genesis 1:1-5
      let chapter = "";
      if (split[i].match(/:/)) {
        let pieces = numbers.split(/:/);
        chapter = mostRecentChapter = pieces[0];
        verses = pieces[1];
      }
      //10
      else {
        chapter = mostRecentChapter;
        verses = split[i];
      }
      ranges.push(chapter + ": " + verses.trim());
    }
  }
  //Genesis 1:1-10    OR    Exodus 1-2:15  OR Leviticus 1:10-2:5
  else if (isRange) {
    let chapters = numbers.match(/((\d+)[:]|^\d+)/g);
    let verses = numbers.match(/[:-](\d+)/g);
    if (chapters.length == 1) chapters.push(chapters[0]);
    chapters = chapters.map((c) => parseInt(c.replace(/\D/g, "").trim()));
    verses = verses.map((v) => parseInt(v.replace(/\D/g, "").trim()));
    for (let i = chapters[0]; i <= chapters[1]; i++) {
      let start = 1;
      let end = "X";
      if (chapters[0] == i) start = verses[0];
      if (chapters[1] == i) end = verses[verses.length - 1];
      ranges.push(i + ": " + start + "-" + end);
    }
  } else {
    ranges = [numbers];
  }
  return ranges;
};
let refIndex = null;
let verseIdIndex = null;
const loadVerseIds = function(book, ranges) {
  if (refIndex == null) refIndex = loadRefIndex();
  let verseList = [];
  for (let i in ranges) { //Assumption: 1 range is within a single chapter
    let range = ranges[i];
    let matches = range.match(/(\d+): *([\dX]+)-*([\dX]*)/);
    let chapter = parseInt(matches[1]);
    let start = parseInt(matches[2]);
    let end = matches[3];
    if (end == "") end = start;
    if (end == "X") end = loadMaxVerse(book, chapter);
    else end = parseInt(end);
    for (let verse_num = start; verse_num <= end; verse_num++) {
      if (refIndex[book] == undefined) continue;
      if (refIndex[book][chapter] == undefined) continue;
      if (refIndex[book][chapter][verse_num] == undefined) continue;
      verseList.push(refIndex[book][chapter][verse_num]);
    }
  }
  return verseList;
};
const loadVerseStructure = function(verse_ids) {
  if (verseIdIndex == null) verseIdIndex = loadVerseIdIndex();
  let segments = consecutiveSplitter(verse_ids);
  let structure = [];
  for (let i in segments) {
    let min = segments[i][0];
    let max = segments[i][segments[i].length - 1];
    structure.push([verseIdIndex[min], verseIdIndex[max]]);
  }
  return structure;
};
const consecutiveSplitter = function(verse_ids) {
  let segments = [];
  let segment = [];
  let previousVerseId = 0;
  for (let i in verse_ids) {
    if (verse_ids[i] != previousVerseId + 1 && previousVerseId != 0) {
      segments.push(segment);
      segment = [];
    }
    segment.push(verse_ids[i]);
    previousVerseId = verse_ids[i];
  }
  segments.push(segment);
  return segments;
};
const loadRefsFromRanges = function(ranges) {
  let refs = [];
  let mostRecentBook, mostRecentChapter;
  for (let i in ranges) {
    let ref = "";
    let start_bk = ranges[i][0][0];
    let end_bk = ranges[i][1][0];
    let start_ch = ranges[i][0][1];
    let end_ch = ranges[i][1][1];
    let start_vs = ranges[i][0][2];
    let end_vs = ranges[i][1][2];
    if (start_bk == end_bk) {
      if (start_ch == end_ch) {
        if (start_bk == mostRecentBook) start_bk = "";
        if (start_bk == mostRecentBook && start_ch == mostRecentChapter)
          start_ch = "";
        if (start_vs == end_vs) {
          ref = start_bk + " " + start_ch + ":" + start_vs;
        } else {
          if (start_vs == 1 && end_vs == loadMaxVerse(start_bk, start_ch)) {
            //whole chapter
            ref = start_bk + " " + start_ch;
          } else {
            ref = start_bk + " " + start_ch + ":" + start_vs + "-" + end_vs;
          }
        }
      } else {
        if (start_vs == 1) {
          ref = start_bk + " " + start_ch + "-" + end_ch + ":" + end_vs;
        } else {
          ref =
            start_bk +
            " " +
            start_ch +
            ":" +
            start_vs +
            "-" +
            end_ch +
            ":" +
            end_vs;
        }
      }
    } else {
      if (start_vs == 1 && end_vs == loadMaxVerse(end_bk, end_ch)) {
        ref = start_bk + " " + start_ch + " - " + end_bk + " " + end_ch;
      } else if (end_vs == loadMaxVerse(end_bk, end_ch)) {
        ref =
          start_bk +
          " " +
          start_ch +
          ":" +
          start_vs +
          " - " +
          end_bk +
          " " +
          end_ch;
      } else if (start_vs == 1) {
        ref =
          start_bk +
          " " +
          start_ch +
          " - " +
          end_bk +
          " " +
          end_ch +
          ":" +
          end_vs;
      } else {
        ref =
          start_bk +
          " " +
          start_ch +
          ":" +
          start_vs +
          " - " +
          end_bk +
          " " +
          end_ch +
          ":" +
          end_vs;
      }
    }
    if (start_bk != "") mostRecentBook = start_bk;
    if (start_ch != "") mostRecentChapter = start_ch;
    ref = ref.replace(/^\s+:*/, "").trim();
    refs.push(ref);
  }
  return refs;
};

const loadRefIndex = function() {
  let refIndex = {};
  let verse_id = 1;
  let book_list = Object.keys(scriptdata);
  for (let a in book_list) {
    let book_title = book_list[a];
    refIndex[book_title] = {};
    for (let b in scriptdata[book_title]) {
      let chapter_num = parseInt(b) + 1;
      let verse_max = scriptdata[book_title][b];
      refIndex[book_title][chapter_num] = {};
      for (var verse_num = 1; verse_num <= verse_max; verse_num++) {
        refIndex[book_title][chapter_num][verse_num] = verse_id;
        verse_id++;
      }
    }
  }
  return refIndex;
};

const loadVerseIdIndex = function() {
  let verseIdIndex = [null];
  let book_list = Object.keys(scriptdata);
  for (let a in book_list) {
    let book_title = book_list[a];
    for (let b in scriptdata[book_title]) {
      let chapter_num = parseInt(b) + 1;
      let verse_max = scriptdata[book_title][b];
      for (var verse_num = 1; verse_num <= verse_max; verse_num++) {
        verseIdIndex.push([book_title, chapter_num, verse_num]);
      }
    }
  }
  return verseIdIndex;
};

const bookExists = function(book) {
  if (scriptdata[book] === undefined) return false;
  return true;
};

const loadMaxChapter = function(book) {
  if (!bookExists(book)) return 0;
  return scriptdata[book].length;
};

const loadMaxVerse = function(book, chapter) {
  if (!bookExists(book)) return 0;
  return scriptdata[book][parseInt(chapter) - 1];
};

const linkScriptureRefs = (content) => {
  content = content.replace(/<a.*?>scripture.guide\/(.*?)<\/a>/gi, function(
    match,
    contents,
  ) {
    return contents
      .split(/[ .]+/)
      .map(function(item) {
        //title case
        item = item.toLowerCase();
        item = item.charAt(0).toUpperCase() + item.slice(1);
        return item;
      })
      .join(" ");
  });

  const pattern = preparePattern();
  const blacklist_pattern = prepareBlacklist();
  var matches = content.match(pattern);
  if (matches) {
    content = content.replace(/&nbsp;/g, " ");
    //process blacklist

    let highlighted = content.replace(pattern, function(
      match,
      contents,
      offset,
      s,
    ) {
      if (!contents) return "";

      contents = contents.trim();
      var link = contents;
      link = link.trim().toLowerCase();
      link = link.split(/[\s:]+/).join(".");
      link = link.split(/\.+/).join(".");
      link = link.split(";.").join(";");
      link = link.split(",.").join(",");

      if (contents.match(blacklist_pattern)) {
        try {
          return contents.trim();
        } catch (err) {
          return "";
        }
      }

      return (
        ' <a className="scripture_link" onClick="sgshow" sg-flag="true" href="https://scripture.guide/' +
        link +
        '" target="_blank">' +
        contents +
        "</a> "
      );
    });

    highlighted = highlighted.replace(/([;, ]+(?:and)*)\s*<\/a>/gi, "</a>$1 ");
    highlighted = highlighted.replace(/[;, ]+(?:and)*\s*\"/gi, '"');

    //remove surrounding parenthses
    highlighted = highlighted.replace(
      /\(\s*<a className="scripture_link"(.*?)<\/a>\s*\)/gi,
      function(match, contents, punct, s) {
        match = match.replace(/^\(/, "").trim();
        match = match.replace(/\)$/, "").trim();
        return match;
      },
    );

    return highlighted;
  }
  return content;
};

const prepareBlacklist = () => {
  var blacklist = [];
  blacklist.push("\\d{4,}"); // 4 Digit references
  blacklist.push("^Ch\\. \\d+"); //Chapter with no book
  blacklist.push("\\w\\w\\d\\d"); //Words with numbers together KGURO43KEAJFK

  //Oneoff Blacklist
  blacklist.push("\\bro \\d+\\b"); //lowecase letters followed by numbers
  blacklist.push("\\bETH \\d+.\\d+\\b");
  blacklist.push("\\b(BC|AD|BCE)[––—−]+\\d+\\b"); //550 BC–330 BC
  blacklist.push("\\b(AC3|PS2|PS3|PS4)\\b"); //Common file extentions
  blacklist.push("\\b(ps|PS)[1-9]\\b"); //Common file extentions'

  var blacklist_pattern = new RegExp("(" + blacklist.join("|") + ")", "g");

  return blacklist_pattern;
};

const preparePattern = () => {
  var bookregex = scriptregex.books2.map((b) => {
    return b[0];
  });

  //Combine Books
  const books = "(?:" + bookregex.join("|") + ")\\s*"; //   \\(*

  //Books that have a digit before them
  var numbooks = [];
  numbooks.push("ne");
  numbooks.push("sam");
  numbooks.push("ki*n*gs");
  numbooks.push("chr");
  numbooks.push("cor");
  numbooks.push("ti");
  numbooks.push("thes");
  numbooks.push("pet");
  numbooks.push("jo*h*n");

  //Meta data components
  var jst =
    "(?:[, —\\-]*(?:Joseph Smith[']*s* Translation *o*f*|\\(Joseph Smith[']*s* Translation *o*f*\\)|jst|\\(jst\\))[, \\—\\-)]*)*";
  var ordinals =
    "(?:[I1-4]*(?:3rd|1st|2n*d|4th|first|sec*o*n*d*\\.*|third|fourt*h*)* *\\b)*";
  var booksof = "(?:\\s*books* of\\s*)*";
  var prechapter = "(?:\\s|\\-|–|,)*";
  var chapter = "(?:,*\\s*" + ordinals + "\\bcha*p*t*e*r*s*\\.*,*\\s*)";
  var verse = "(?:,*\\s*" + ordinals + "\\bv*ve*r*s*e*s*\\.*,*\\s*)";
  var versenums = "\\s*[0-9]+"; //[a-f]*
  var joiners = "(?:[,;&\\/](?:\\s*and\\s*)*\\s*(?!$))*";
  var bumper = "(?![^<>]*>)"; //prevents matching inside of quotes

  //Punctuations, etc
  var punct = [];
  punct.push("\\s*[:\\-\\.–—]" + versenums); //[a-z]{0,1} //colons,dots and dashes
  punct.push("\\s*(?:" + chapter + "|" + verse + ")" + versenums); //spelled out chapter and verse words
  punct.push(
    "\\s*(?:;|,|,* *and|&amp;|&| *to *)\\s*[1-9]\\d*(?!\\s*\\.*(" +
      numbooks.join("|") +
      "))",
  ); //passage breakers (a new book may appear after)

  //combine punctuation
  var punct = "(?:[1-9]\\d*(?:" + punct.join("|") + ")*)";

  //Full Regex
  var match =
    bumper +
    "((?:(?:" +
    jst +
    "\\b" +
    ordinals +
    booksof +
    books +
    prechapter +
    chapter +
    "*" +
    punct +
    jst +
    ")" +
    joiners +
    ")+)";

  var pattern = new RegExp(match, "gi");

  return pattern;
};

export { lookupReference, generateReference, linkScriptureRefs };
