

const {lookup,generateReference,setLang} = require("scripture-guide");
import { models as Models } from '../config/database';
import logger from "../library/utils/logger.cjs";
const { processPassages, loadHeadings} = require('./lib')
const log = (msg:any,obj?:any) => obj ? logger.info(`utils ${msg} ${JSON.stringify(obj)}`) : logger.info(`utils ${msg}`);

export const loadScripture = async (lang:string, reference:string, arg_verse_ids:any) => {

    setLang(lang || "en");
    const backupVerse_ids = lookup(reference)?.verse_ids;
    try{

        let { verse_ids, ref } = arg_verse_ids ?   { verse_ids: arg_verse_ids, ref: generateReference(arg_verse_ids) }  : lookup(reference);
        if(!verse_ids.length && backupVerse_ids.length) verse_ids = backupVerse_ids;
        const config = { raw:true, where: {  verse_id:verse_ids  } };
        const versedata = await Models.LdsScripturesVerses.findAll(config);
        if(versedata.length===0) {
          log("No verses found",{reference,lang,verse_ids})
          return {ref,passages:[],verses:[]}
        }

      if(lang && lang!=='en') {
        const translations = await Models.LdsScripturesTranslations.findAll({
          raw:true,
          where: {  verse_id:verse_ids, lang  }
        });

        //replace the text with the translation
        versedata.forEach((verse:any)=>{
          let translation:any = translations.find((t:any)=>t.verse_id===verse.verse_id);
          if(translation) verse.verse_scripture = translation.text;
        });
      }

  
      const verses = versedata.map((verse:any)=>{
        return {
          verse_id:verse.verse_id,
          book:verse.book_id,
          chapter:verse.chapter,
          verse:verse.verse,
          text:verse.verse_scripture
        }
      });

      let groups = verse_ids.reduce((acc:any, verse_id:any) => {
        let lastGroup = acc[acc.length-1];
        if(!lastGroup || lastGroup[lastGroup.length-1] !== verse_id-1) acc.push([verse_id]);
        else lastGroup.push(verse_id);
        return acc;
      }, []);

      const resolvedPassages = (await Promise.all(groups.map(passage_verse_ids => processPassages(passage_verse_ids, verses, lang)).flat())).flat();
      return {ref, passages: resolvedPassages, verses}
  
    }
    catch(e){
      console.log("ERROR",e);
      if(lang && lang!=='en') return loadScripture(null,reference,arg_verse_ids);
      return {ref:(reference||JSON.stringify(arg_verse_ids)) + " not found",verses:[]}
    }

}



export const loadVerses = async (verse_ids:any, lang:string) => {
  const config = { raw:true, where: {  verse_id:verse_ids  } };
  const [versedata, headings] = await Promise.all([
    Models.LdsScripturesVerses.findAll(config),
    loadHeadings(verse_ids)
  ]);
  
  const findHeading = (verseId: number) => {
    const relevantHeadings = headings.filter(({ verse_id }) => verse_id <= verseId);
    const latestHeading = relevantHeadings.reduce((latest: any, current: any) => 
      current.verse_id > latest.verse_id ? current : latest, relevantHeadings[0]);
    return latestHeading?.text || null;
  };


  const found = versedata.map((verse:any)=>{
    return {
      verse_id:verse.verse_id,
      heading:findHeading(verse.verse_id) || null,
      reference:verse.verse_title,
      text:verse.verse_scripture
    }
  });
  return found;

}