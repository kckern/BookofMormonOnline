import { sendbird } from '../library/sendbird';
import { models as Models } from '../config/database';
import dotenv from 'dotenv';
const {lookup,generateReference,setLang} = require("scripture-guide");
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
const axios = require('axios');
export default {
  Query: {
    labels: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      return Models.BomLabel.findAll({
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
      const lang = context.lang ? context.lang : null;


      //SHPINX CODE
      const versions = ['LDS'];
      const query = args.query;
      const sphinxSql = `SELECT verse_id,version 
        FROM sgindex 
        WHERE MATCH('@(text) ${query}') 
        AND version IN ('${versions.join(`','`)}')
        LIMIT 99999999 ;`;

      //query must be 4 or more characters
      if(query.length<4) return [];
      
      let verse_ids:any = [];
     // verse_ids = await sphinxQuery(sphinxSql);
      {
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
      if(!verse_ids?.length) return [];


      return Models.BomLookup.findAll({    
            where: { verse_id: verse_ids },
            raw: true,
            include: [
                includeModel(true, Models.LdsScripturesVerses, 'verse'),
                includeModel(true, Models.BomText, 'text', [
                    includeTranslation('content', lang),
                    includeModel(true, Models.BomNarration, 'narration', [includeTranslation('description', lang)]),
                    includeModel(true, Models.BomSection, 'parent_section', [includeTranslation('title', lang)]),
                    includeModel(true, Models.BomPage, 'parent_page', [includeTranslation('title', lang)])  
                ].filter(x => !!x))
            ].filter(x => !!x)
        }).then(r => {
            return (r.map(item => {
                return {
                pageguid:item['text.parent_page.guid'],
                link: item['text.link'],
                reference: item['verse.verse_title'],
                text: item['verse.verse_scripture'],
                section: item['text.parent_section.title'],
                page: item['text.parent_page.title'] ,
                narration: item['text.narration.description'],
                content: item['text.content']
                };
            }));
        })
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
      if(lang) setLang(lang);
      const reference = args.ref;
      try{
        let { verse_ids, ref } = args.verse_ids ? 
        { verse_ids: args.verse_ids, ref: generateReference(args.verse_ids) } 
        : lookup(reference);

        
//      ref = generateReference(verse_ids);

      
      const config = { raw:true, where: {  verse_id:verse_ids  } };
      const verses = await Models.LdsScripturesVerses.findAll(config);



      if(verses.length===0) {
        log("No verses found",{reference,lang,verse_ids})
        return {ref,verses:[]}
      }
      if(lang && lang!=='en') {
        const translations = await Models.LdsScripturesTranslations.findAll({
          raw:true,
          where: {  verse_id:verse_ids, lang  }
        });

        //replace the text with the translation
        verses.forEach((verse:any)=>{
          let translation:any = translations.find((t:any)=>t.verse_id===verse.verse_id);
          if(translation) verse.verse_scripture = translation.text;
        });
      }
  
      return {ref,verses:verses.map((verse:any)=>{
        return {
          book:verse.book_id,
          chapter:verse.chapter,
          verse:verse.verse,
          text:verse.verse_scripture
        }
      })}
  
    }
    catch(e){
      return {ref:(reference||JSON.stringify(args.verse_ids)) + " not found",verses:[]}
    }
  
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
