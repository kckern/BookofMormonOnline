import { userInfo } from 'os';
import Sequelize from 'sequelize';
import { models as Models, sequelize, SQLQueryTypes } from '../config/database';
import { getSlug, Op, includeTranslation, translatedValue, includeModel, includeWhere, scoreSlugsfromUserInfo, getSlugTip, getUserForLog} from './_common';
import scripture from "../library/scripture"
import { loadNotesFromTextGuid, loadPeopleFromTextGuid, loadPlacesFromTextGuid } from './BomPeoplePlace';
const { getBlocksToQueue ,getFirstTextBlockGuidFromSlug,organizeRelatedScriptures} = require('./lib')
import { lookupReference,generateReference } from 'scripture-guide';
import { queryDB } from '../library/db';
import { loadLines, loadScripture, loadVerses } from './BomScripture';

export default {
  Query: {

    division: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      const slugs = getSlugTip(args?.slug);
      return Models.BomDivision.findAll({
        include: [
          includeWhere( Models.BomSlug, "slug", slugs , "divSlug",[]),
          includeTranslation('description', lang),
          includeModel(true, Models.BomPage, 'titlepage',[
            includeTranslation('title', lang)].filter(x => !!x)),
          includeModel(true, Models.BomPage, 'pages',[
            includeTranslation('title', lang),
            includeModel(true, Models.BomSection, 'sections',[
              includeTranslation('title', lang),
              includeModel(true, Models.BomText, 'sectionText', [
                includeTranslation("heading", lang)
              ].filter(x => !!x))            
            ].filter(x => !!x))].filter(x => !!x))
        ].filter(x => !!x),
        order: [
          'weight',
          [{model:Models.BomPage, as: "pages"},"weight"],
          [{model:Models.BomPage, as: "pages"},
          {model:Models.BomSection, as: "sections"},
          {model:Models.BomText, as: "sectionText"},"link"]
        ]
      });
    },
    page: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      const slugs = getSlugTip(args.slug);
      const sectionTextOrder = ((new RegExp(`{"kind":"Name","value":"sectionText"`).test( JSON.stringify(info.fieldNodes))) ? [
        {model:Models.BomSection, as: "sections"},
        {model:Models.BomText, as: "sectionText"},
        "link"
      ] : null);
      if ('slug' in args)
        return Models.BomPage.findAll({
          include: [
            includeWhere( Models.BomSlug, "slug", slugs , "pageSlug",[]),
            includeTranslation('title', lang),
            includeModel(info, Models.BomSection, 'sections', [
              includeTranslation('title', lang),
              includeModel(true, Models.BomText, 'sectionText', [
                includeTranslation("heading", lang)
              ].filter(x => !!x)),
              includeModel(info, Models.BomSectionrow, 'rows', [
                includeModel(info, Models.BomConnection, 'connection', [includeTranslation('text', lang)].filter(x => !!x)),
                includeModel(info, Models.BomCapsulation, 'capsulation', [includeTranslation({ [Op.or]: ['description', 'reference'] }, lang)].filter(x => !!x)),
                includeModel(info, Models.BomNarration, 'narration', [
                  includeTranslation('description', lang),
                  includeModel(info, Models.BomTimeline, 'timeline'),
                  includeModel(info, Models.BomText, 'text', [
                    includeTranslation({ [Op.or]: ['heading', 'content'] }, lang),
                    includeModel(info, Models.BomText, 'quotes',[
                      includeTranslation({ [Op.or]: ['heading', 'content'] }, lang)
                    ].filter(x => !!x))
                  ].filter(x => !!x))
                ])
              ].filter(x => !!x))
            ].filter(x => !!x))
          ].filter(x => !!x),
          order:  [
            'weight',
            [
              {model:Models.BomSection, as: "sections"},
              "weight"
            ],
            [
              {model:Models.BomSection, as: "sections"},
              {model:Models.BomSectionrow, as: "rows"},
              "weight"
            ],
            [
              {model:Models.BomSection, as: "sections"},
              {model:Models.BomText, as: "sectionText"},
              "link"
            ]
          ]
        })
      return Models.BomPage.findAll({
      });
    },

    section: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      const slugs = getSlugTip(args.slug);
      if ('slug' in args)
      {
        return Models.BomSection.findAll({
          include: [
            includeWhere( Models.BomSlug, "slug", slugs , "sectionSlug",[]),
              includeTranslation('title', lang),
              includeModel(info, Models.BomSectionrow, 'rows', [
                //TODO: Rows not joining capulation and narration
                includeModel(info, Models.BomNarration, 'narration', [includeTranslation('description', lang)].filter(x => !!x))
              ].filter(x => !!x))
            ].filter(x => !!x),
        order: ['weight']
        })
      }
      return Models.BomText.findAll({
        order: ['weight']
      });
    },

    text: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      const linkNums = args.slug.map((s:string)=>s.match(/\d+$/).pop()).filter(function(item:string, pos:number, ary:any) {
        return !pos || item != ary[pos - 1];
      });
      const slugs = args.slug.map((s:string)=>s.replace(/\/\d+$/,'').split("/").pop()).filter(x=>!!x);

      if ('slug' in args)
      {
        return Models.BomText.findAll({
          where:{
            link: linkNums
          },
          include: [
            {
              model: Models.BomSlug,
              as: "textSlug",
              where: {
                slug: slugs
              },
              attributes: ["slug"]
            },
            includeTranslation({ [Op.or]: ['heading', 'content'] }, lang),
            includeModel(info, Models.BomNarration, 'narration',[includeTranslation("description", lang)]),
            includeModel(info, Models.BomSection, 'parent_section',[includeTranslation("title", lang)]),
            includeModel(info, Models.BomPage, 'parent_page',[includeTranslation("title", lang)]),
            includeModel(info, Models.BomText, 'quotes')].filter(x => !!x),
        order: ['weight']
        }).then(r=>{
          let results:any = {};
          for(let i in r)
          {
            let item:any = r[i];
            let slug = item?.dataValues?.textSlug?.dataValues.slug
            let link = item?.getDataValue('link');
            results[slug+"/"+link] = r[i];
          }
          return args.slug.map((slug:string)=>{
            slug = slug.split("/").splice(-2).join("/");
            return results[slug];

          }).filter((x:any) => !!x);

        })
      }
      return Models.BomText.findAll({
        order: ['weight']
      });
    },

 
queue: async (root: any, args: any, context: any, info: any) => {
  const lang = context.lang ? context.lang : null;
  const {token,items} = args;

  const inputs = await getBlocksToQueue(token, items, info);

  const textBlocks = inputs.map(async ({ slug, blocks }) => {

    const slugNumber = slug.match(/\d+$/)?.pop() || null;
    const slugArray = slug.replace(/\/\d+$/,'').split("/").filter(x=>!!x);
    //const slugVerseIds = lookupReference(slug)?.verse_ids?.[0] || null;

    slug = slugArray[slugArray.length - 1] + (slugNumber ? "/" + slugNumber : "");

    const r = await Models.BomText.findAll({
      where: {
        link: blocks
      },
      include: [
        {
          model: Models.BomSlug,
          as: "textSlug",
          where: {
            slug: slug
          },
          attributes: ["slug", "link"]
        },
        includeTranslation({ [Op.or]: ["heading", "content"] }, lang),
        includeModel(info, Models.BomNarration, "narration", [
          includeTranslation("description", lang)
        ]),
        includeModel(info, Models.BomPage, "parent_page", [
          includeTranslation("title", lang)
        ]),
        includeModel(info, Models.BomSection, "parent_section", [
          includeTranslation("title", lang)
        ]),

        includeModel(info, Models.BomText, "quotes")
      ].filter(x => !!x),
      order: ["weight"]
    });

    let results: any = {};
    for (let i in r) {
      let item: any = r[i];
      let slug_1 = item?.dataValues?.textSlug?.dataValues.slug;
      let link = item?.getDataValue("link");
      results[slug_1 + "/" + link] = r[i];
    }
    return blocks.map((block: string) => {
      return results[slug + "/" + block];
    }).filter((x_1: any) => !!x_1);
  });

  const resolvedItems = await Promise.all(textBlocks);
  return resolvedItems.flat();
},

    lookup: async (root: any, args: any, context: any, info: any) => {

      const lang = context.lang ? context.lang : null;
      let verseIds = args.ref.map((r:any)=>scripture.lookupReference(r).verse_ids);
      if(!verseIds.length) return [];
      return Models.BomLookup.findAll({
        where:{verse_id:verseIds},
        raw:true
      }).then(r=>{
        return Models.BomText.findAll({
        where:{guid:r.map(r=>(r as any).text_guid)},
        include:[
          includeModel(info, Models.BomNarration, 'narration',[includeTranslation("description", lang)]),
          includeModel(info, Models.BomSection, 'parent_section',[includeTranslation("title", lang)]),
          includeModel(info, Models.BomPage, 'parent_page',[includeTranslation("title", lang)]),
        ].filter(x => !!x)
        }).then(r=>{
          return r;
        })
      });
    },

    read: async (root, args, context, info) => {
      const lang = context.lang || null;
      const { token } = args;
      const { verse_ids, ref } = lookupReference(args.ref);
      const lines = await loadLines(verse_ids, lang);
      const scripture = await loadVerses(verse_ids, lang);
      const currentChapter = generateReference(verse_ids[0]).replace(/:\d+$/, '');
      const currentChapterVerseIds = lookupReference(currentChapter).verse_ids;

      let prev_ref = generateReference(currentChapterVerseIds[0] - 1).replace(/:\d+$/, '');
      let next_ref = generateReference(currentChapterVerseIds[currentChapterVerseIds.length - 1] + 1).replace(/:\d+$/, '');
      if(currentChapterVerseIds[0] <= 31103) prev_ref = null;
      if(currentChapterVerseIds[currentChapterVerseIds.length - 1] >= 37706) next_ref = null;

    
      const headingMap = scripture.reduce((acc, verse) => {
        acc[verse.verse_id] = verse.heading;
        return acc;
      }, {});
    
      let sections = [], currentSection = null, lastPersonSlug = null, lastVoice = null;
    
      for (let line of lines) {
        const thisSection = headingMap[line.verse_id];
    
        if (!currentSection || currentSection.heading !== thisSection) {
          currentSection = { 
            ref, heading: thisSection, verse_id: line.verse_id, verse_count: 0, blocks: [] 
          };
          sections.push(currentSection);
        }
    
        const lastBlock = currentSection.blocks.length ? currentSection.blocks[currentSection.blocks.length - 1] : null;
        
        if (!lastBlock || line.person_slug !== lastPersonSlug || line.voice !== lastVoice) {
          currentSection.blocks.push({
            ref,
            verse_id: line.verse_id,
            verse_count: 0,
            person_slug: line.person_slug,
            voice: line.voice,
            lines: []
          });
          lastPersonSlug = line.person_slug;
          lastVoice = line.voice;
        }
    
        const currentBlock = currentSection.blocks[currentSection.blocks.length - 1];
        const lineRef = generateReference(line.verse_id);
    
        currentBlock.lines.push({
          ref: lineRef,
          verse_num: lineRef.split(":").pop(),
          verse_id: line.verse_id,
          text: line.text
        });
    
        currentBlock.verse_count++;
        currentSection.verse_count++;
      }
    
      sections.forEach(section => {
        section.blocks.forEach(block => {
          const verse_ids = Array.from({ length: block.verse_count }, (_, i) => block.verse_id + i);
          block.ref = generateReference(verse_ids);
        });
    
        const verse_ids = Array.from({ length: section.verse_count }, (_, i) => section.verse_id + i);
        section.ref = generateReference(verse_ids);
      });
    
      return {
        ref,
        verse_id: verse_ids[0],
        verse_count: verse_ids.length,
        sections,
        prev_ref,
        next_ref
      };
    }
  },


  Division: {
    description: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'description');
    },
    title: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item.getDataValue('titlepage'),"title");
    },
    slug: (item: any, args: any, { db, res }: any, info: any) => {
      return getSlug('link', item.getDataValue('titlepage').getDataValue('guid'));
    },
    progress: (item: any, args: any, { db, res }: any, info: any) => {   
      return getUserForLog(args.token).then((userInfo: any) => {
        // let userInfo = {queryBy:"tytus",  lastcompleted : 1371215870};
        const guids = item.pages.map((page:any)=>page.getDataValue("guid"));
        return scoreSlugsfromUserInfo(guids, userInfo)
      });
    },
  },

  Page: {
    title: async (item: any, args: any, context: any, info: any) => {
      return translatedValue(item, 'title');
    },
    ref: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'ref');
    },
    slug: async (item: any, args: any, { db, res }: any, info: any) => {
      return getSlug('link', item.getDataValue('guid'));
    },
    counts: async (item: any, args: any, { db, res }: any, info: any) => {
      return sequelize
        .query('SELECT min(link) as l, count(*) as count FROM `bom_text` WHERE page = :pageguid group by section order by l ;', {
          replacements: {
            pageguid: item.getDataValue('guid')
          },
          type: SQLQueryTypes.SELECT
        })
        .then(function (sections:any) {
          return sections.map((s: any) => s.count);
        });
    },
    progress: (item: any, args: any, { db, res }: any, info: any) => { 
       return getUserForLog(args.token).then((userInfo: any) => {
         //let userInfo = {queryBy:"tytus",  lastcompleted : 1371215870};
         const guids = [item.getDataValue("guid")];
         return scoreSlugsfromUserInfo(guids, userInfo)
       });
    },
  },
  
  Section: {
    slug: async (item: any, args: any, { db, res }: any, info: any) => {
      if(!item?.getDataValue) return item.slug;
      return getSlug('link', item.getDataValue('guid'));
    },
    title: async (item: any, args: any, { db, res }: any, info: any) => {
      if(!item?.getDataValue) return item.title;
      return translatedValue(item, 'title');
    },
    badge: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'badge');
    },
    ref: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'ref');
    },
    rows: async (item: any, args: any, { db, res }: any, info: any) => {
      return item.getDataValue('rows');
    },
    page: async (item: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      return Models.BomPage.findOne({
        where: {
          guid: item.getDataValue('parent')
        },include:[includeTranslation('title', lang)].filter(x => !!x)
      });
    }
  },
  Row: {
    narration: async (item: any, args: any, { db, res }: any, info: any) => {
      if (item.getDataValue('type') === 'N') {
        return item.getDataValue('narration');
      }
    },
    connection: async (item: any, args: any, { db, res }: any, info: any) => {
      if (item.getDataValue('type') === 'C') {
        return item.getDataValue('connection');
      }
    },
    capsulation: async (item: any, args: any, { db, res }: any, info: any) => {
      if (item.getDataValue('type') === 'O') {
        return item.getDataValue('capsulation');
      }
    }
  },
  Conn: {
    text: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'text');
    },
    link: async (item: any, args: any, { db, res }: any, info: any) => {
      return getSlug('guid', item.getDataValue('link'));
    },
    slug: (item: any, args: any, { db, res }: any, info: any) => {
      return getSlug('guid', item.getDataValue("link"));
    }
  },
  Caps: {
    description: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'description');
    },
    reference: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'reference');
    },
    slug: (item: any, args: any, { db, res }: any, info: any) => {
      return getSlug('guid', item.getDataValue("link"));
    }
  },
  Narration: {
    text(item: any) {
      return item.getDataValue('text');
    },
    description: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'description');
    },
    timeline(item: any) {
      return item.getDataValue('timeline');
    },
    section(item: any) {
      return Models.BomSection.findOne({ where: { guid: item.getDataValue('parent') } });
    }
  },
  TextBlock: {
    status: async (item: any, args: any, { db, res }: any, x: any) => {


      if(!item?.getDataValue) return item.status;
      const percentToCountAsComplete = parseInt(process.env.PERCENT_TO_COUNT_AS_COMPLETE) || 40;

      const {token} = args;
      const textGuid = item.getDataValue('guid');

      //load username from token 
      const {queryBy,userObj} = await getUserForLog(token);
      const finished = userObj?.finished || 0;

      const {credit}:any = (await Models.BomLog.findAll({
        where: {
          user: queryBy,
          value: textGuid,
          timestamp: { [Op.gt]: finished }
        }
      })).sort((b:any,a:any)=>a.credit-b.credit)?.[0] || {credit:0};

      const status = !credit ? "incomplete" : parseInt(credit) >= percentToCountAsComplete ? "completed" : "started"

      return status
    },
    heading: async (item: any, args: any, { db, res, lang }: any, info: any) => {

      if(!item?.getDataValue) return item.heading;

      // console.log(item)
      const heading = translatedValue(item, 'heading');
      if(/[0-9]/.test(heading)) return heading;

      //load parent Heading
      const parentGuid = item.getDataValue('parent');
      const parentHeading = await Models.BomQuote.findOne({
        raw: true,
        where: {
          guid: parentGuid
        },
        include: [{
          model: Models.BomText,
          as: 'textParent'
        }]
      });
      if(lang && lang!== "en"){
        const headingGuid = parentHeading['textParent.guid'];
        const LangHeading = await Models.BomText.findOne({
          where: {
            guid: headingGuid
          },
          include: [includeTranslation('heading', lang)]
        });
        const translation = LangHeading['translation'][0]?.value;
        if(translation) return `[${translation}] ${heading}`;
      }
      const parentHeadingText = parentHeading['textParent.heading'];
      return `[${parentHeadingText}] ${heading}`


    },
    content: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'content');
    },
    slug: (item: any, args: any, { db, res }: any, info: any) => 
    {
      if(!item?.getDataValue) return item?.slug;
      return getSlug('link', item.getDataValue('page')).then(slug=>slug+"/"+item.getDataValue('link'));
    },
    imgIds: (item: any, args: any, { db, res }: any, info: any) => 
    {
      let imageIds = item.dataValues.content.match(/\[i\](\d+)\[\/i\]/ig);
      imageIds = imageIds && imageIds.map((i:string) => parseInt(i.replace(/\D+/g, ''))) || [];
     return imageIds;
    },
    comIds: (item: any, args: any, { db, res }: any, info: any) => 
    {
      let comIds = item.dataValues.content.match(/\[c\](\d+)\[\/c\]/ig);
      comIds = comIds && comIds.map((i:string) => parseInt(i.replace(/\D+/g, '')));
     return comIds;
    },
    refs: async (item: any, args: any, { db, res }: any, info: any) =>{

      const text_guid = item.getDataValue('guid');
      const verse_ids = await Models.BomLookup.findAll({
        where: {
          text_guid
        }}
      ).then(r=>r.map((r:any)=>r.verse_id));

      //scripture.guide.scripture_references
      const placeholders = verse_ids.map(() => '?').join(',');
      const sql = `SELECT dst_verse_id as verse_id,\`type\`,significant,dst_ref as ref
        FROM \`scripture.guide\`.scripture_references 
        WHERE src_verse_id IN (${placeholders})
        AND \`type\` = "xref"
        AND significant IN (0,1,-1)`;
      const refs = await queryDB(sql, verse_ids);
      return organizeRelatedScriptures(refs)

    },
    next: async (item: any, args: any, { db, res, lang }: any, info: any) =>{

      //get this  narration id
      const rowGuid = item.getDataValue('narration')?.getDataValue('parent');
      if(!rowGuid) return [];
      //get page guid
      const pageGuid = item.getDataValue('page');
      
      //get all page sections, then get section rows from all the sections 
      const sections = await Models.BomSection.findAll({
        raw: true,
        where: {
          parent: pageGuid
        }
      });

      const pageRows = await Models.BomSectionrow.findAll({
        raw: true,
        where: {
          parent: sections.map((s:any)=>s.guid)
        }
      });
      //find index of this narration
      const narrationIndex = pageRows.findIndex((r:any)=>r.guid == rowGuid);
      //loop through rows after this one, and determine if the next row(s) is/are non-N types
      const nextRows = pageRows.slice(narrationIndex+1);
      const nexts = [];
      for(let i in nextRows){
        const row = nextRows[i];
        const rowtype = row['type'];
        if(rowtype === 'N') break;
        nexts.push(row);
      }


      return nexts.map(async (r:any)=>{
        const rowGuid = r['guid'];
        const nextClass = r['type'];
        const nextObject = nextClass === 'C' ? 
          await Models.BomConnection.findOne({raw:true,where:{parent:rowGuid,type:"right"},include:[includeTranslation('text', lang,false)].filter(x => !!x)})
        : await Models.BomCapsulation.findOne({raw:true, where:{parent:rowGuid},include:[includeTranslation('description', lang,false)].filter(x => !!x)})
        if(!nextObject) return;
        nextObject['text'] = nextObject?.['translation.value'] || nextObject?.['text'] || nextObject?.['description'];
        if(!nextObject) return;

        const {slug,type,link}:any = (await Models.BomSlug.findOne({raw:true,where:{guid:nextObject['link']}}));

        const textGuid = await getFirstTextBlockGuidFromSlug(type,link);
        console.log({textGuid})
        const textBlock = await Models.BomText.findOne({
          raw: true,
          where: {
            guid: textGuid
          },
          include: [
            {  model: Models.BomPage,  as: 'parent_page', include: [includeTranslation('title', lang,false)].filter(x => !!x)},
            {  model: Models.BomSection,  as: 'parent_section', include: [includeTranslation('title', lang,false)].filter(x => !!x)},
            {  model: Models.BomNarration,  as: 'narration', include: [includeTranslation('description', lang,false)].filter(x => !!x)},
          ].filter(x => !!x),
        });

        const nextMeta = {
          page: textBlock['parent_page.translation.value'] || textBlock['parent_page.title'],
          section: textBlock['parent_section.translation.value'] || textBlock['parent_section.title'],
          narration: textBlock['narration.translation.value'] || textBlock['narration.description']
        }



        return {
          nextclass: r['type'],
          slug,
          text:  nextObject['text'],
          page: nextMeta.page,
          section: nextMeta.section,
          narration: nextMeta.narration,
         }
      }).filter(x=>!!x);
    },
    narration: async (item: any, args: any, context: any, info: any) => 
    {
      const lang = context.lang ? context.lang : null;
      const narration = translatedValue(item, 'narration');
      if(narration) return narration;

      const parentGuid = item.getDataValue('parent');
      const parentNarration = await Models.BomQuote.findOne({
        raw: true,
        where: {
          guid: parentGuid
        },
        include: [{
          model: Models.BomText,
          as: 'textParent',
          include: [{
            model: Models.BomNarration,
            as: 'narration'
          }]
        }]
      });

      if(lang && lang!=="en"){
        const narrationGuid = parentNarration?.['textParent.narration.guid'];
        if(!narrationGuid) return;
        const narration = await Models.BomNarration.findOne({
          where: {
            guid: narrationGuid
          },
          include: [includeTranslation('description', lang)]
        });
        const translation = narration['translation'][0]?.value;
        if(translation) return {description:translation}
      }
      
      const description = parentNarration['textParent.narration.description'];

      return {description};


    },
    people: async (item: any, args: any, context: any, info: any) =>{
      const lang = context.lang ? context.lang : null;
      const textBlockGuid = item.getDataValue('guid');
      const narrationDescription = item.getDataValue('narration')?.getDataValue('description') || await (async ()=>{
        const narration:any = await Models.BomNarration.findOne({raw:true,where:{guid:item.getDataValue('parent')}});
        return narration?.description || "";
      })();
      const peopleSlugs = narrationDescription?.match(/\{([^}]+)\}/g)?.map((s:string)=>s.replace(/[{}]/g, '').split("|")[1]);
      return await loadPeopleFromTextGuid(textBlockGuid,peopleSlugs,lang);
    },
    places: async (item: any, args: any, context: any, info: any) =>{
      const lang = context.lang ? context.lang : null;
      const textBlockGuid = item.getDataValue('guid');
      const narrationDescription = item.getDataValue('narration')?.getDataValue('description') || await (async ()=>{
        const narration:any = await Models.BomNarration.findOne({raw:true,where:{guid:item.getDataValue('parent')}});
        return narration?.description || "";
      })();
      const placeSlugs = narrationDescription?.match(/\[([^\]]+)\]/g)?.map((s:string)=>s.replace(/[\[\]]/g, '').split("|")[1]);
      return await loadPlacesFromTextGuid(textBlockGuid,placeSlugs,lang);
    },
    coms: async (item: any, args: any, context: any, info: any) =>{
      const lang = context.lang ? context.lang : "en";
      const text_guid = item.getDataValue('guid');
      //const comIds = content?.match(/\[c\](\d+)\[\/c\]/ig)?.map((s:string)=>s.replace(/\D+/g, '')) || [];
      return Models.BomXtrasCommentary.findAll({
        where: {
          location_guid: text_guid
        },
        include: [{
          model: Models.BomXtrasSource,
          as: 'publication',
          where:{
            source_lang :lang
          }
        }]
      });
    },
    notes: async (item: any, args: any, context: any, info: any) =>{
      const lang = context.lang ? context.lang : "en";
      //if not english, return empty array
      if(lang !== "en") return []; //todo translate notes eventually
      return loadNotesFromTextGuid(item.getDataValue('guid'),lang);
    },
    note_count: async (item: any, args: any, context: any, info: any) =>{
      const lang = context.lang ? context.lang : "en";
      return loadNotesFromTextGuid(item.getDataValue('guid'),lang).then(r=>r.length);
    },
    imgs: async (item: any, args: any, context: any, info: any) =>{
      const content = item.getDataValue('content');
      const imgIds = content?.match(/\[i\](\d+)\[\/i\]/ig)?.map((s:string)=>s.replace(/\D+/g, '')) || [];
      return Models.BomXtrasImage.findAll({
        where: {
          id: imgIds
        },
        include: [includeTranslation('title', context.lang)].filter(x => !!x)
      });
    },



  }
};
