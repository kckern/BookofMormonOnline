// Canon structure for both testaments-of-record: book verse-id ranges,
// chapter counts, group membership, and slug resolution. Verse ids are
// global sequential integers (Bible 1–31102, Book of Mormon 31103–37706).

const BIBLE_RAW = {
  Torah: [
    ["Genesis", 1, 1533, 50],
    ["Exodus", 1534, 2746, 40],
    ["Leviticus", 2747, 3605, 27],
    ["Numbers", 3606, 4893, 36],
    ["Deuteronomy", 4894, 5852, 34],
  ],
  Historical: [
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
    ["Esther", 12704, 12870, 10],
  ],
  Wisdom: [
    ["Job", 12871, 13940, 42],
    ["Psalms", 13941, 16401, 150],
    ["Proverbs", 16402, 17316, 31],
    ["Ecclesiastes", 17317, 17538, 12],
    ["Solomon's Song", 17539, 17655, 8],
  ],
  "Major Prophets": [
    ["Isaiah", 17656, 18947, 66],
    ["Jeremiah", 18948, 20311, 52],
    ["Lamentations", 20312, 20465, 5],
    ["Ezekiel", 20466, 21738, 48],
    ["Daniel", 21739, 22095, 12],
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
    ["Malachi", 23091, 23145, 4],
  ],
  "Gospels & Acts": [
    ["Matthew", 23146, 24216, 28],
    ["Mark", 24217, 24894, 16],
    ["Luke", 24895, 26045, 24],
    ["John", 26046, 26924, 21],
    ["Acts", 26925, 27931, 28],
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
    ["Philemon", 29940, 29964, 1],
  ],
  "General Epistles": [
    ["Hebrews", 29965, 30267, 13],
    ["James", 30268, 30375, 5],
    ["1 Peter", 30376, 30480, 5],
    ["2 Peter", 30481, 30541, 3],
    ["1 John", 30542, 30646, 5],
    ["2 John", 30647, 30659, 1],
    ["3 John", 30660, 30673, 1],
    ["Jude", 30674, 30698, 1],
  ],
  Apocalyptic: [["Revelation", 30699, 31102, 22]],
};

const BOM_RAW = {
  "Small Plates": [
    ["1 Nephi", 31103, 31720, 22],
    ["2 Nephi", 31721, 32499, 33],
    ["Jacob", 32500, 32702, 7],
    ["Enos", 32703, 32729, 1],
    ["Jarom", 32730, 32744, 1],
    ["Omni", 32745, 32774, 1],
  ],
  "Plates of Mormon": [
    ["Words of Mormon", 32775, 32792, 1],
    ["Mosiah", 32793, 33577, 29],
    ["Alma", 33578, 35552, 63],
    ["Helaman", 35553, 36049, 16],
    ["3 Nephi", 36050, 36834, 30],
    ["4 Nephi", 36835, 36883, 1],
    ["Mormon", 36884, 37032, 7],
  ],
  Moroni: [
    ["Mormon", 37033, 37110, 2],
    ["Ether", 37111, 37543, 15],
    ["Moroni", 37544, 37706, 10],
  ],
};

export const slugify = (str) =>
  (str || "")
    .toLowerCase()
    .replace(/['‘’]/g, "")       // drop straight + curly apostrophes
    .replace(/[^a-z0-9]+/g, "-") // any other non-url-safe run → single dash
    .replace(/^-+|-+$/g, "");    // no leading/trailing dashes

const buildCanon = (key, label, raw) => {
  const books = [];
  const groups = [];
  for (const [groupName, rows] of Object.entries(raw)) {
    const group = { name: groupName, slug: slugify(groupName), books: [] };
    for (const [name, start, end, chapters] of rows) {
      const existing = books.find((b) => b.name === name);
      if (existing) {
        // canon splits one book across two groups (e.g. Mormon): merge.
        existing.start = Math.min(existing.start, start);
        existing.end = Math.max(existing.end, end);
        existing.chapters += chapters;
        existing.verses = existing.end - existing.start + 1;
        continue;
      }
      const book = {
        name,
        start,
        end,
        chapters,
        verses: end - start + 1,
        group: groupName,
        slug: slugify(name),
        canon: key,
      };
      books.push(book);
      group.books.push(book);
    }
    groups.push(group);
  }
  return { key, label, books, groups };
};

export const canons = {
  kjv: buildCanon("kjv", "Bible", BIBLE_RAW),
  bom: buildCanon("bom", "Book of Mormon", BOM_RAW),
};

export const bookBySlug = (canonKey, slug) =>
  canons[canonKey]?.books.find((b) => b.slug === slugify(slug));

export const bookOfVid = (canonKey, vid) =>
  canons[canonKey]?.books.find((b) => vid >= b.start && vid <= b.end);
