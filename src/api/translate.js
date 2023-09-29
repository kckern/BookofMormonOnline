
const { queryDB } = require("../library/db");


const loadTranslations = async (lang, items, guidkey = "guid") => {

    if(!items || !items.length) return [];
    if(!Array.isArray(items)) items = [items];
    const guids = items.map(item => item?.[guidkey]);
    const refKeys = [...new Set(items.flatMap(item => Object.keys(item)))].filter(key => ["guid",guidkey].indexOf(key) === -1);
    const sql = `SELECT refkey, value, guid FROM bom_translation 
        WHERE lang = ? AND guid IN (${guids.map((guid) => "?").join(",")}) 
        AND refkey IN (${refKeys.map((key) => "?").join(",")})`;

    const params = [lang, ...guids, ...refKeys];
    const rows = await queryDB(sql, params);
    
    const translations = rows.reduce((acc,row)=>{
        const {guid, refkey, value} = row;
        acc[guid] = acc[guid] || {};
        acc[guid][refkey] = value;
        return acc;
    },{});
    let results =  items.map(item => ({...item, ...translations[item[guidkey]]}));
    //remove empty elements in array objects
    results = results.map(item => {
        Object.keys(item).forEach(key => {
            if(Array.isArray(item[key]) && item[key].length === 0) delete item[key];
        })
        return item;
    })
    return results;
  }


  const postProcessFns= {"ko": (i)=>{
    //console.log("postProcessFn", i)
    i = i.replace(/([\u3131-\uD79D]) *([0-9]+)/ig, "$1 $2장 ");
    i = i.replace(/[–-]+/g,"~");
    i = i.replace(/\s*:\s*([0-9~]+)/g, "$1절");
    i = i.replace(/;/g, "; ").replace(/\s+/g, " ").trim();
    i = i.replace(/제\s*([3-4])장\s*니파이/g, "제$1니파이");
    return i;
    }}



  function translateReferences(lang, text)
  {
      if(lang !== "ko") return text;
      const dictionary = {
          "1 Nephi":{  "ko": "니파이전서" },
          "1 Ne\\.":{  "ko": "니파이전서" },
          "2 Nephi":{  "ko": "니파이후서" },
          "2 Ne\\.":{  "ko": "니파이후서" },
          "Jacob":{  "ko": "야곱서" },
          "Enos":{  "ko": "이노스서" },
          "Jarom":{  "ko": "예이롬서" },
          "Omni":{  "ko": "옴나이서" },
          "Words of Mormon":{  "ko": "몰몬의 말씀" },
          "Mosiah":{  "ko": "모사이야서" },
          "Alma":{  "ko": "앨마서" },
          "Helaman":{  "ko": "힐라맨서" },
          "Hel\\.":{  "ko": "힐라맨서" },
          "3 Nephi":{  "ko": "제3니파이" },
          "3 Ne\\.":{  "ko": "제3니파이" },
          "4 Nephi":{  "ko": "제4니파이" },
          "4 Ne\\.":{  "ko": "제4니파이" },
          "Mormon":{  "ko": "몰몬서" },
          "Morm\\.":{  "ko": "몰몬서" },
          "Ether":{  "ko": "이더서" },
          "Moroni":{  "ko": "모로나이서" },
          "Moro\\.":{  "ko": "모로나이서" }
      };
  
      let books = Object.keys(dictionary).join("|");
      let pattern = new RegExp("("+books+")\\s*\\d+","g");
      text = text.replace(pattern, (match, p1) => {
          if(!dictionary[p1]?.[lang]) return match;
          return match.replace(p1, dictionary[p1][lang]);
      });
  
      if(postProcessFns[lang]) text = postProcessFns[lang](text);
      return text;
  }



module.exports = {loadTranslations,translateReferences};