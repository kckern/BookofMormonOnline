const postProcessFns = {
  ko: i => {
    i = i.replace(/([\u3131-\uD79D]) *([0-9]+)/gi, "$1 $2장  ");
    i = i.replace(/[–-]+/g, "~"); 
    i = i.replace(/\s*:\s*([0-9~]+)/g, "$1절");
    i = i
      .replace(/;/g, "; ")
      .replace(/\s+/g, " ")
      .trim();
    i = i.replace(/제\s*([3-4])장\s*니파이/g, "제$1니파이");
    i = i.replace(/장([0-9]+)/g, "장 $1");
    return i;
  }
};

//TEMPORARY FUNCTION UNTIL THIS BECOME NATIVE IN SCRIPTURE_GUIDE
export const translateReferences = (text, lang) => {
  //we assume the text is english and has already been processed by scripture guide

  if (lang !== "ko") return text;
  const dictionary = {
    "1 Nephi": { ko: "니파이전서" },
    "2 Nephi": { ko: "니파이후서" },
    Jacob: { ko: "야곱서" },
    Enos: { ko: "이노스서" },
    Jarom: { ko: "예이롬서" },
    Omni: { ko: "옴나이서" },
    "Words of Mormon": { ko: "몰몬의 말씀" },
    Mosiah: { ko: "모사이야서" },
    Alma: { ko: "앨마서" },
    Helaman: { ko: "힐라맨서" },
    "3 Nephi": { ko: "제3니파이" },
    "4 Nephi": { ko: "제4니파이" },
    Mormon: { ko: "몰몬서" },
    Ether: { ko: "이더서" },
    Moroni: { ko: "모로나이서" },
    "Doctrine and Covenants": { ko: "교리와 성약" },
    Moses: { ko: "모세서" },
    Abraham: { ko: "아브라함서" },
    "Joseph Smith—Matthew": { ko: "조셉 스미스—마태복음" },
    "Joseph Smith—History": { ko: "조셉 스미스—역사" },
    "Articles of Faith": { ko: "신앙개조" },
    Genesis: { ko: "창세기" },
    Exodus: { ko: "출애굽기" },
    Leviticus: { ko: "레위기" },
    Numbers: { ko: "민수기" },
    Deuteronomy: { ko: "신명기" },
    Joshua: { ko: "여호수아" },
    Judges: { ko: "사사기" },
    Ruth: { ko: "룻기" },
    "1 Samuel": { ko: "사무엘상" },
    "2 Samuel": { ko: "사무엘하" },
    "1 Kings": { ko: "열왕기상" },
    "2 Kings": { ko: "열왕기하" },
    "1 Chronicles": { ko: "역대상" },
    "2 Chronicles": { ko: "역대하" },
    Ezra: { ko: "에스라" },
    Nehemiah: { ko: "느헤미야" },
    Esther: { ko: "에스더" },
    Job: { ko: "욥기" },
    Psalms: { ko: "시편" },
    Proverbs: { ko: "잠언" },
    Ecclesiastes: { ko: "전도서" },
    "Song of Solomon": { ko: "아가" },
    Isaiah: { ko: "이사야" },
    Jeremiah: { ko: "예레미야" },
    Lamentations: { ko: "예레미야애가" },
    Ezekiel: { ko: "에스겔" },
    Daniel: { ko: "다니엘" },
    Hosea: { ko: "호세아" },
    Joel: { ko: "요엘" },
    Amos: { ko: "아모스" },
    Obadiah: { ko: "오바댜" },
    Jonah: { ko: "요나" },
    Micah: { ko: "미가" },
    Nahum: { ko: "나훔" },
    Habakkuk: { ko: "하박국" },
    Zephaniah: { ko: "스바냐" },
    Haggai: { ko: "학개" },
    Zechariah: { ko: "스가랴" },
    Malachi: { ko: "말라기" },
    Matthew: { ko: "마태복음" },
    Mark: { ko: "마가복음" },
    Luke: { ko: "누가복음" },
    John: { ko: "요한복음" },
    Acts: { ko: "사도행전" },
    Romans: { ko: "로마서" },
    "1 Corinthians": { ko: "고린도전서" },
    "2 Corinthians": { ko: "고린도후서" },
    Galatians: { ko: "갈라디아서" },
    Ephesians: { ko: "에페소서" },
    Philippians: { ko: "빌립보서" },
    Colossians: { ko: "골로새서" },
    "1 Thessalonians": { ko: "데살로니가전서" },
    "2 Thessalonians": { ko: "데살로니가후서" },
    "1 Timothy": { ko: "디모데전서" },
    "2 Timothy": { ko: "디모데후서" },
    Titus: { ko: "디도서" },
    Philemon: { ko: "빌레몬서" },
    Hebrews: { ko: "히브리서" },
    James: { ko: "야고보서" },
    "1 Peter": { ko: "베드로전서" },
    "2 Peter": { ko: "베드로후서" },
    "1 John": { ko: "요한1서" },
    "2 John": { ko: "요한2서" },
    "3 John": { ko: "요한3서" },
    Jude: { ko: "유다서" },
    Revelation: { ko: "요한 계시록" }
  };

  let books = Object.keys(dictionary).join("|");
  let pattern = new RegExp("(" + books + ")\\s*\\d+", "g");
  text = text.replace(pattern, (match, p1) => {
    if (!dictionary[p1]?.[lang]) return match;
    return match.replace(p1, dictionary[p1][lang]);
  });

  if (postProcessFns[lang]) text = postProcessFns[lang](text);
  return text;
};
