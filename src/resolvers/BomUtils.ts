import { sendbird } from '../library/sendbird';
import { models as Models } from '../config/database';
import dotenv from 'dotenv';
import { generateReference, setLang } from 'scripture-guide';
dotenv.config();
const logger = require("../library/utils/logger.cjs");
const log = (msg:any,obj?:any) => obj ? logger.info(`utils ${msg} ${JSON.stringify(obj)}`) : logger.info(`utils ${msg}`);


import {
  getSlug,
  includeTranslation,
  translatedValue,
  includeModel,
  includeWhere,
  scoreSlugsfromUserInfo,
  getSlugTip,
  Op,
  getUserForLog
} from './_common';
import { sphinxQuery } from '../search/sphinx';
import { translateReferences } from './xlate';
import { loadScripture, loadVerses } from './BomScripture';
const axios = require('axios');
export default {
  Query: {
    labels: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      return Models.BomLabel.findAll({
        //where type is not peoplerel
        where: {
          type: {
            [Op.not]: 'peoplerel'
          }
        },
        include: [includeTranslation('label_text', lang)].filter(x => !!x)
      }).then((labels: any) => {
       // console.log('labels', labels);
        labels.push({gmaps: process.env.GMAPS_API_KEY});
        return labels;
      });
    },
    menu: async (root: any, args: any, context: any, info: any) => {
      return [null];
    },
    books: async (root: any, args: any, context: any, info: any) => {
      return [null];
    },
    search: async (root: any, args: any, context: any, info: any) => {
      context.lang = context.lang.replace(/%[0-9A-F]{2}/gi, '');
      const lang = context.lang ? context.lang : null;


      //SHPINX CODE
      const versions = ['LDS'];
      const query = args.query;
      const sphinxSql = `SELECT verse_id,version 
        FROM sgindex 
        WHERE MATCH('@(text) ${query}') 
        AND version IN ('${versions.join(`','`)}')
        LIMIT 99999999 ;`;

        const isEnglish = !lang || lang === 'en' || lang === 'eng' || lang === 'dev';
        const isKorean = lang === 'ko';

        const minLen = isKorean ? 1 : 3;

      //query must be 4 or more characters
      if(query.length<minLen) return [];
      


      let verse_ids:any = [];
     // verse_ids = await sphinxQuery(sphinxSql);
      if(isEnglish){
        verse_ids = await Models.LdsScripturesVerses.findAll({
          attributes: ['verse_id'],
          where: {
            verse_scripture: {
              [Op.like]: `%${query}%`
            },
            verse_id: {
              [Op.between]: [31103, 37706]
            }
          }
        }).then((results: any) => {
          return results.map((item: any) => item.verse_id);
        });
      }
      else{
        console.log({lang,query});
        const translations = await Models.LdsScripturesTranslations.findAll({
          raw:true,
          where: {  text: { [Op.like]: `%${query}%` }, lang  }
        });
        verse_ids = translations.map((item:any)=>item.verse_id);
      }


      if(!verse_ids?.length) return [];


      const textItems = await Models.BomLookup.findAll({
        raw: true,
        where: { verse_id: verse_ids },
        include: [
          {
            model: Models.BomText,
            as: 'text',
            include: [
              { model: Models.BomPage, as: 'parent_page', include: [includeTranslation('title', lang, false)].filter(x => !!x) },
              { model: Models.BomSection, as: 'parent_section', include: [includeTranslation('title', lang, false)].filter(x => !!x) },
              { model: Models.BomNarration, as: 'narration', include: [includeTranslation('description', lang, false)].filter(x => !!x) },
            ].filter(x => !!x),
          },
          { 
            model: Models.LdsScripturesVerses, 
            as: 'verse' 
          },
          isEnglish ? null : { 
            model: Models.LdsScripturesTranslations, 
            as: 'verse_translation', 
            where: { lang: lang }
          }
        ].filter(x => !!x) 
      });

      return textItems.map((item:any)=>{

        const verse_id = item['verse_translation.verse_id'] || item['verse.verse_id'];
        console.log = ()=>{};
        if(!isEnglish) setLang(lang);
        const reference = generateReference(verse_id);

        return {
          pageguid:item['text.parent_page.guid'],
          link: item['text.link'],
          reference:reference,
          text: item['verse_translation.text'] || item['verse.verse_scripture'],
          section: item['text.parent_section.translation.value'] || item['text.parent_section.title'],
          page: item['text.parent_page.translation.value'] || item['text.parent_page.title'] ,
          narration: item['text.narration.translation.value'] || item['text.narration.description'],
          content: null
          };
        });

        
    },
    
    shortlink: async (input: any, args: any, context: any, info: any) => {
      if (args.hash !== null) {
        return Models.BomShortlinks.findOne({
          where: {
            hash: args.hash
          }
        });
      }
    },
    markdown: async (input: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      if (args.slug !== null) {
        return Models.BomMarkdown.findAll({
          where: {
            slug: args.slug
          },
          include: [includeTranslation('markdown', lang)].filter(x => !!x)
        });
      }
      return Models.BomMarkdown.findAll();
    },
    test: async (input: any, args: any, context: any, info: any) => {
      return true;
    },
    
    scripture: async (input: any, args: any, context: any, info: any) => {

      const nolangs = ["eng","en","dev"];
      const lang = context.lang && !nolangs.includes(context.lang) ? context.lang : null;
      const {ref,verse_ids} = args;
      return loadScripture(lang, ref, verse_ids);
    },
    verses: async (input: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      const {verse_ids} = args;
      return loadVerses(verse_ids, lang);
    }
  },
  Mutation: {
    shortlink: async (root: any, args: any, context: any, info: any) => {
      let string = args.string;
      return Models.BomShortlinks.findOne({
        where: {
          string: string
        }
      }).then(function(r) {
        if (r !== null) return r;
        var newhash = makeid(9);
        return Models.BomShortlinks.create({
          hash: newhash,
          string: string
        });
      });
    }
  },
  SearchResult: {
    slug: async (item: any, args: any, { db, res }: any, info: any) => {
      let pageguid =  item['pageguid'];
      let num = item['link'];
      return getSlug('link',pageguid).then(slug=>slug+"/"+num);
    },
  },

  Test: {
    db: async (item: any, args: any, context: any, info: any) => {
      let count = await Models.BomLog.count();
      return `${count} records found in bom_log`;
    },
    http: async (item: any, args: any, context: any, info: any) => {
      let sbuser = await sendbird.loadUser('kckern');
      if (!sbuser) return 'Failed to load data from Sendbird API';
      return `Loaded user data from Sendbird API: ${sbuser.user_id}`;
    },
    http2: async (item: any, args: any, context: any, info: any) => {
      let data = await placeholderAPI();
      if (!data) return 'Failed to load data from Placeholder API';
      return `Data from HTTPS API: ${data.title}`;
    }
  },
  Label: {
    val: async (item: any, args: any, context: any, info: any) => {
      if(!item.getDataValue) return Object.values(item).pop();
      return translatedValue(item, 'label_text');
    },
    key: async (item: any, args: any, context: any, info: any) => {
      if(!item.getDataValue) return Object.keys(item).pop();
      return item.getDataValue('label_id');
    }
  },
  Markdown: {
    markdown: async (item: any, args: any, context: any, info: any) => {
      return translatedValue(item, 'markdown');
    }
  }
};

function makeid(length: number) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function placeholderAPI() {
  var authOptions = {
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/todos/1',
    json: true
  };
  return axios(authOptions)
    .then((res: any) => {
      //("placeholderAPIHTTPResponse",{res});
      return res.data;
    })
    .catch((error: any) => {
      console.log('placeholderAPIHTTPError', { error });
    });
}
