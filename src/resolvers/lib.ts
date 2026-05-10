import { getUserForLog, Op, includeModel, getSlug, completedGuids } from "./_common";
import { queryDB } from '../library/db';
import { models as Models, sequelize, SQLQueryTypes } from '../config/database';
import { lookup, generateReference } from 'scripture-guide';
import logger from '../library/utils/logger';
import moment from 'moment';


const getBlocksToQueue = async (token: string, items: any[]): Promise<any> => {

    const isExplicit = items?.[0].slug && items?.[0]?.blocks?.[0];
    if(isExplicit) return items.map((item)=>({slug:item.slug,blocks:item.blocks}));


    const isSlug = items?.[0].slug;
    if(isSlug) return await getBlocksFromSlug(items[0].slug,token);

    const isReference = items?.[0].reference;
    if(isReference) return await getBlocksFromReference(items[0].reference, token);

    const isReadingPlan = items?.[0].plan || false;
    if(isReadingPlan) return await getBlocksFromReadingPlan(items[0].plan,token);

    const isTokenBased = token && !items?.[0];
    if(isTokenBased) return await getBlocksFromToken(token);
 
    return await getBlocksByDefault();

}

const getBlocksFromReference = async (reference,token) => {

    const {verse_ids} = lookup(reference);
    if(!verse_ids || !verse_ids.length) return await getBlocksByDefault();
    const firstVerseId = verse_ids[0];
    const [textBlockData] = await Models.BomText.findAll({
        raw: true,
        attributes: ["guid", "page", "link", [sequelize.col('textSlug.slug'), 'pageSlug']],
        include: [
            {
                model: Models.BomLookup,
                as: "lookup",
                where: { verse_id: { [Op.in]: [firstVerseId] } },
            },
            {
                model: Models.BomSlug,
                as: 'textSlug',
            }
        ],
        order: [['queue_weight', 'ASC']]
    });
    const link = (textBlockData as any).link;
    const pageSlug = (textBlockData as any).pageSlug;
    return await getBlocksFromTextBlock(`${pageSlug}/${link}`,token,false);
}

const getBlocksFromToken = async (token) => {

    //TODO load for user based on recent usage
    const {queryBy,userObj} = await getUserForLog(token);
    const finished = userObj?.finished || 0;
  //find the most recent textblock for this user
  let logEntry = await Models.BomLog.findOne({
      raw:true,
      where:{
          user:queryBy,
          timestamp: {[Op.gt]: finished},
          type:"block"
      },
      order:[['timestamp','DESC']],
  });

  if(!logEntry) return await getBlocksByDefault();

  const textBlockData = await Models.BomText.findOne({raw:true,where:{guid:(logEntry as any).value}});
  const link = (textBlockData as any).link;
  const pageSlug = await Models.BomSlug.findOne({raw:true,where:{link:(textBlockData as any).page}});
  return await getBlocksFromTextBlock(`${(pageSlug as any).slug}/${link}`,token,false);
}


const getBlocksFromReadingPlan = async (plan,token) => {
    const sectionGuidSQL = `SELECT sectionGuids FROM bom_readingplan_seg WHERE guid = ? ORDER BY start ASC`;
    const sectionGuids = (await queryDB(sectionGuidSQL,[plan]))[0]?.sectionGuids || [];
    const sectionGuidArray = JSON.parse(sectionGuids);
    return await buildQueueFromSections({sectionGuids:sectionGuidArray, token} as any);

}


const getBlocksByDefault = async () => {

    return getBlocksFromPage("4becc77f2d75f");

}


const getBlocksFromSlug = async (slug,token) => {
    let last_item = slug.split("/").pop();
    const isNumeric = (parseInt(last_item)||0) > 0;
    if(isNumeric) return await getBlocksFromTextBlock(slug,token,true);
    const slugData = await Models.BomSlug.findOne({ raw:true, where: { slug: last_item  } });
    const {type,link} = (slugData as any) || {};
    if(type === "SC") return await buildQueueFromSection({sectionGuid:link,token,forceSection:true});
    if(type === "PG") return await getBlocksFromPage(link,token);
    return {slug:"lehites",blocks:Array(20).map((_,i)=>(i+1))};
}


const getBlocksFromTextBlock = async (slug,token,force) => {
    //given a textblock's section and the next 2 sections with incomplete blocks
    const [blocknum,pageslug] = slug.split("/").reverse();
    const pageSlugData = await Models.BomSlug.findOne({
        raw:true,
        attributes:["link"],
        where:{slug:pageslug,type:"PG"}
    });
    const block = await Models.BomText.findOne({
        raw:true,
        where:{link:blocknum, page:(pageSlugData as any).link}
    });
    if(!block) return await getBlocksByDefault();
    const sectionGuid = (block as any).section;
    return await buildQueueFromSection({sectionGuid,token,forceSection:force});


};

const getBlocksFromPage = async (pageGuid,token=null) => {
    //first 3 sections with incomplete blocks
    const sectionsOnPage = await Models.BomSection.findAll({
        raw:true,
        where:{parent:pageGuid}
    });
    const [sectionGuid] = sectionsOnPage.map(s=>(s as any).guid);
    return await buildQueueFromSection({sectionGuid,token,forceSection:true});
    
};


const buildQueueFromSections = async ({ sectionGuids }) => {
    const allBlocks = await Models.BomText.findAll({
      raw: true,
      attributes: ["guid", "section", "page", "queue_weight", "link"],
      order: [['queue_weight', 'ASC']]
    });
  
    let queue = [];
    sectionGuids.forEach(sectionGuid => {
      const text_guids = allBlocks.filter(b => (b as any).section === sectionGuid).map(b => (b as any).guid);
      queue = [...queue, ...text_guids];
    });
    return await resolveQueueFromTextBlocks(allBlocks.filter(b => queue.includes((b as any).guid)));
  };

const buildQueueFromSection = async ({sectionGuid,token,forceSection}) => {
    if(!sectionGuid) return [];
    forceSection = forceSection || false;
    const {queryBy,userObj} = token ? await getUserForLog(token) : {queryBy:null,userObj:{finised:0}};
    const finished = userObj?.finished || 0;

    const allBlocks = await Models.BomText.findAll({
        raw:true,
        attributes:["guid","section","page","queue_weight","link"],
        order:[['queue_weight','ASC']]
    });
    const unqueSectionGuids = Array.from(new Set(allBlocks.map(b=>(b as any).section)));
    let sectionIndex = unqueSectionGuids.findIndex(s=>s === sectionGuid);
    let queueIsReady = false;
    let queue = [];
    const max = 40;
    const completedBlocks = queryBy ? await loadCompletedBlocks({queryBy, finished}) : [];
    while(!queueIsReady){
        //console.log(`Section index: ${sectionIndex}`);
        const sectionGuid = unqueSectionGuids[sectionIndex];
        sectionIndex++;
        if(sectionIndex >= unqueSectionGuids.length) sectionIndex = 0;
        if(!sectionGuid) break;
        const text_guids = allBlocks.filter(b=>(b as any).section === sectionGuid).map(b=>(b as any).guid);
        const sectionIsDone = text_guids.every(t=>completedBlocks.includes(t));
        if(sectionIsDone && !forceSection){
            //.log(`Section ${sectionGuid} is done. ${text_guids.length} blocks completed.`);
            continue;
        }
        const tmpQueue = [...queue, ...text_guids];
        //console.log(`Current queue size: ${queue.length}. Attempting to add ${text_guids.length} blocks from section ${sectionGuid}.`);
        if(tmpQueue.length > max && queue.length>1) break;
        //console.log(`Section ${sectionGuid} added to queue. ${text_guids.length} blocks added.`);
        queue = tmpQueue;
    }

    return await resolveQueueFromTextBlocks(allBlocks.filter(b=>queue.includes((b as any).guid)));


}

const loadCompletedBlocks = async ({queryBy, finished}) => {

        const results = await Models.BomLog.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('value')), 'value']],
            raw:true,
            where:{
                user:queryBy,
                timestamp: {[Op.gt]: finished},
                type:"block",
                credit: {[Op.gt]: process.env.PERCENT_TO_COUNT_AS_COMPLETE || 40}
            },
            order:[['timestamp','DESC']],
        });

        return  results.map(r=>(r as any).value);

}


const checkCompletion = async ({queryBy, finished, text_guids}) => {
    //todo PRELOAD log
    const results = await Models.BomLog.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('value')), 'value']],
        where:{
            user:queryBy,
            timestamp: {[Op.gt]: finished},
            type:"block",
            value:{[Op.in]:text_guids},
            credit: {[Op.gt]: 50}
        },
        order:[['timestamp','DESC']],
    });
    return text_guids.length === results.length;

}



const resolveQueueFromTextBlocks = async (textBlocks) => {

    const uniquePageGuids = Array.from(new Set(textBlocks.map(b=>(b as any).page)));
    const slugs = await Models.BomSlug.findAll({
        raw:true,
        attributes:["link","slug"],
        where:{
            link:{[Op.in]:uniquePageGuids}
        }
    });

    const output = [];
    for(const pageGuid of uniquePageGuids){
        output.push({
            slug: (slugs?.find(s=>(s as any).link === pageGuid) as any)?.slug || pageGuid,
            blocks:textBlocks.filter(b=>b.page === pageGuid).map(b=>b.link)
        })
    }
    return output;
}


async function getFirstTextBlockGuidFromSlug(type,link)
{
    if(type === "PG") return await getFirstTextBlockGuidFromPage(link);
    if(type === "SC") return await getFirstTextBlockGuidFromSection(link);
    return null;
}

async function getFirstTextBlockGuidFromPage(pageGuid)
{
    const textBlock = await Models.BomText.findOne({
        raw:true,
        where:{page:pageGuid},
        order:[['queue_weight','ASC']]
    });
    return (textBlock as any)?.guid;

}

async function getFirstTextBlockGuidFromSection(sectionGuid)
{
    const textBlock = await Models.BomText.findOne({
        raw:true,
        where:{section:sectionGuid},
        order:[['queue_weight','ASC']]
    });
    return (textBlock as any)?.guid;
}


async function organizeRelatedScriptures(scriptureDataArray)
{
    //schema:  [{verse_id,type,significant,dst_ref}]
    //dedupe based on verse_id.  
    scriptureDataArray = scriptureDataArray.filter((v,i,a)=>a.findIndex(t=>(t.verse_id === v.verse_id))===i);
    return scriptureDataArray;
    }// Function to load headings from the database



export async function loadHeadings(verse_ids, lang = "en") {
        lang = lang || "en";
        const firstVerse = verse_ids[0];
        let placeholders = new Array(verse_ids.length).fill('?').join(',');
        const headingSQL = `(SELECT verse_id, text FROM lds_scriptures_headings WHERE verse_id <= ? AND lang = '${lang}' ORDER BY verse_id DESC LIMIT 1)
        UNION (SELECT verse_id, text FROM lds_scriptures_headings WHERE verse_id IN (${placeholders}) AND lang = '${lang}' ORDER BY verse_id)`;
        const params = [firstVerse, ...verse_ids];
        let headingData = await queryDB(headingSQL, params);
        if(!headingData.length  && lang !== "en") return await loadHeadings(verse_ids, "en");
        headingData = headingData.filter((v, i, a) => a.findIndex(t => (t.verse_id === v.verse_id)) === i);
        if (!headingData.length) headingData = [{ verse_id: firstVerse }];
        return headingData.sort((a, b) => a.verse_id - b.verse_id);
    }

    // Modified processPassages function to use loadHeadings
    async function processPassages(verse_ids, verse_data, lang = "en", version="LDS") {
        let headingData = await loadHeadings(verse_ids, lang);
        let meta = (await Models.LdsScripturesMeta.findAll({
            raw: true,
            where: { version,verse_id: { [Op.in]: verse_ids } }
        })).map(m => ({ verse_id: m.verse_id, key: m.type, value: m.text }));
        return headingData.map((item, i) => {
            const startVerse = Math.max(item.verse_id, Math.min(...verse_ids));
            const endVerse = headingData[i + 1]?.verse_id || verse_ids[verse_ids.length - 1];
            const verses = verse_data.filter(v => v.verse_id >= startVerse && v.verse_id <= endVerse);
            const passage_verse_ids = verses.map(v => v.verse_id);
            const reference = generateReference(passage_verse_ids, lang as any);
            const heading = item.text?.replace(/｢\d+｣/g, "").trim() || reference;
            return {
                reference,
                heading,
                meta,
                verses: verses.map(v => ({
                    verse: v.verse,
                    verse_id: v.verse_id,
                    text: v.text
                })),
            }
        });
    }

const pickOneRamdomly = (arr) => {

    const selectedIndex = Array.from(Array(arr.length).keys()).sort(() => Math.random() - 0.5).pop();
    return arr[selectedIndex];
}

function genUserAvatar(user_id) {
    const pallettes = [
        ["FF86F1", "FF00CC"], ["00FFFF", "000080"], ["99FFCC", "009933"],
        ["FF6699", "990033"], ["33CCFF", "003366"], ["00FF80", "004D40"],
        ["FF9933", "6B4423"], ["FF99FF", "993399"], ["99CCFF", "003399"],
        ["00CC99", "006633"], ["FF9999", "800000"], ["FFFF99", "808000"],
        ["99FF99", "006400"], ["FFCC99", "8B4513"], ["CCCCFF", "000099"],
        ["CC99FF", "660099"], ["FF66CC", "660033"], ["CCFFFF", "006666"],
        ["FF9966", "663300"], ["66CCFF", "002266"], ["99CC66", "435D36"],
        ["66FF66", "003300"], ["FFFF66", "878700"], ["FF9999", "942121"],
        ["FFCCCC", "853333"], ["99CC99", "385438"], ["CCCC99", "545400"],
        ["CCFFCC", "004700"], ["FFCC99", "6B3600"], ["CCFF99", "3B5900"],
        ["FFFFCC", "878600"], ["FF9966", "803000"], ["CCFF66", "315000"],
    ];

    const mouths = ["variant1", "variant2", "variant3", "variant4"];
    const rotations = [0, 20, 340, 40, 320];
    const eyes = "variant6W10,variant8W14,variant2W10";

    // Deterministic selection based on userId hash
    const id = user_id || 'user';
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const seed = id.slice(0, 5);
    const [back, fore] = pallettes[hash % pallettes.length];
    const mouth = mouths[hash % mouths.length];
    const rotation = rotations[hash % rotations.length];

    return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}&backgroundColor=${back}&shapeColor=${fore}&eyes=${eyes}&rotate=${rotation}&scale=70&mouth=${mouth}`;
}


const loadPlanData = async (slug) => {
    const [planData] = await queryDB(`SELECT * FROM bom_readingplan WHERE slug = ?`, [slug]);
    if (!planData) return null;

    // Fetch segment data along with the sectionGuids column
    const planSegments = await queryDB(
        `SELECT *, sectionGuids FROM bom_readingplan_seg WHERE plan = ? ORDER BY start ASC`, 
        [planData.slug]
    );
    
    // Utilize the sectionGuids if available. If not, then fetch from DB and UPDATE it.
    // Process segments that need sectionGuids in parallel to avoid connection leaks
    const segmentsNeedingGuids = planSegments.filter(seg => !seg.sectionGuids);
    
    if (segmentsNeedingGuids.length > 0) {
        // Fetch all section guids in parallel
        const sectionGuidPromises = segmentsNeedingGuids.map(seg => 
            queryDB(
                `SELECT section FROM (
                    SELECT bom_text.section, bom_lookup.verse_id
                    FROM bom_lookup
                    INNER JOIN bom_text ON bom_lookup.text_guid = bom_text.guid
                    WHERE bom_lookup.verse_id BETWEEN ? AND ?
                    ORDER BY bom_lookup.verse_id ASC
                 ) tmp
                 GROUP BY section
                 ORDER BY MIN(tmp.verse_id) ASC`, 
                [seg.start, seg.end]
            ).then(results => ({
                guid: seg.guid,
                sectionGuids: results.map(s => s.section)
            }))
        );
        
        const sectionGuidResults = await Promise.all(sectionGuidPromises);
        
        // Update segments with results
        sectionGuidResults.forEach(result => {
            const seg = segmentsNeedingGuids.find(s => s.guid === result.guid);
            if (seg) seg.sectionGuids = result.sectionGuids;
        });
        
        // Batch update all segments at once
        if (sectionGuidResults.length > 0) {
            const updatePromises = sectionGuidResults.map(result =>
                queryDB(
                    `UPDATE bom_readingplan_seg SET sectionGuids = ? WHERE guid = ?`, 
                    [JSON.stringify(result.sectionGuids), result.guid]
                )
            );
            await Promise.all(updatePromises);
        }
    }
    
    // Parse existing sectionGuids from JSON
    planSegments.forEach(seg => {
        if (seg.sectionGuids && typeof seg.sectionGuids === 'string') {
            seg.sectionGuids = JSON.parse(seg.sectionGuids);
        }
    });

    planData["planSegments"] = planSegments;
    return planData;
};

const scoreSegment = async (sectionGuids, allTextBlocks, history) => {
    if(!sectionGuids || !sectionGuids.length) return {items:0,completed:0,progress:0};
    const segmentBlocks = allTextBlocks.filter(b => sectionGuids.includes(b.section));
    const completedBlocks = segmentBlocks.filter(b => history.includes(b.guid));
    const completed = Math.round((completedBlocks.length / segmentBlocks.length) * 10000) / 100;


    return {
        items: segmentBlocks?.length || 0,
        completed: completedBlocks?.length || 0,
        progress: completed || 0
    };
};



const loadReadingPlan = async (slug,userInfo,lang) => {

    

    //TODO convert to sequelize
    const {guid,title,startdate,duedate,planSegments} = await loadPlanData(slug);
    const startdateTimestamp = moment(startdate).unix();
    const completed_items = await completedGuids(userInfo,startdateTimestamp);


    const sql = `SELECT guid,section FROM bom_text`;
    const allTextBlocks = await queryDB(sql);

    let toDateItems = 0;
    let toDateCompleted = 0;


    let segments = [];
    const config = {
        raw:true,
        where:{
            guid: [guid,...planSegments.map(s=>s.guid)],
            refkey:["title","ref","period"],
            lang
        }
    };
    const translatedItems = lang ? await Models.BomTranslation.findAll(config) : [];
    

    for (let i = 0; i < planSegments.length; i++) {
        const seg = planSegments[i];
        const {period,ref,title,duedate,start,end,guid:segmentGuid} = seg;
        const today = moment().format("YYYY-MM-DD");
        const due = moment(duedate).format("YYYY-MM-DD");
        const isFuture = moment(today).isBefore(due);

        const {items,completed,progress} = await scoreSegment(seg.sectionGuids,allTextBlocks,completed_items);
        if(!isFuture) { toDateItems +=(items || 0); toDateCompleted += (completed || 0); }
        segments.push({
            guid:segmentGuid,
            period:translatedItems.find(t=>(t as any).guid === segmentGuid && (t as any).refkey === "period")?.value || period,
            ref:translatedItems.find(t=>(t as any).guid === segmentGuid && (t as any).refkey === "ref")?.value || ref,
            title:translatedItems.find(t=>(t as any).guid === segmentGuid && (t as any).refkey === "title")?.value || title,
            duedate:moment(duedate).format("YYYY-MM-DD"),
            progress,
            start,
            end
        });
    }
    const progress = !!toDateItems ? Math.round((toDateCompleted/toDateItems)*10000)/100 : 0;
return  {
      guid,
      slug,
      title:translatedItems.find(t=>(t as any).guid === guid && (t as any).refkey === "title")?.value || title,
      startdate:moment(startdate).format("YYYY-MM-DD"),
      duedate:moment(duedate).format("YYYY-MM-DD"),
      progress,
      segments
    }
}

const loadReadingPlanSegment = async (guid,queryBy,lang) => {

    const segmentData = (await queryDB(`SELECT s.*,p.title,p.startdate plan_start FROM bom_readingplan_seg s JOIN bom_readingplan p ON s.plan = p.slug WHERE s.guid = ?`, [guid]))[0];
    if (!segmentData) return null;
    const {plan_start,duedate,start,end} = segmentData;
    const plan_start_timestamp = moment(plan_start).unix();
    const threshold = process.env.PERCENT_TO_COUNT_AS_COMPLETE || 40;
    const sql = `
    SELECT bom_text.guid, bom_text.page, bom_text.section, bom_text.min_verse_id, bom_text.heading, 
    bom_translation.value AS heading_lang,  bom_text.page, bom_text.link, bom_text.section, bom_text.min_verse_id, 
    (CASE 
        WHEN bom_log.credit < ${threshold} THEN 0 
        WHEN bom_log.credit >= ${threshold} THEN 1 
        ELSE NULL END) AS completion_status,
    bom_log.credit AS credit
    FROM bom_text 
    LEFT JOIN (
        SELECT value as guid, MAX(credit) as credit FROM bom_log WHERE type = "block" AND user = ? AND timestamp > ${plan_start_timestamp || 0} GROUP BY guid
        ) bom_log ON bom_text.guid = bom_log.guid 
        LEFT JOIN bom_translation ON bom_text.guid = bom_translation.guid AND bom_translation.lang = ? AND bom_translation.refkey = "heading"
    WHERE bom_text.section IN (SELECT DISTINCT bom_text.section FROM bom_readingplan_seg AS segment LEFT JOIN bom_lookup ON bom_lookup.verse_id BETWEEN segment.start AND segment.end LEFT JOIN bom_text ON bom_text.guid = bom_lookup.text_guid WHERE segment.guid = ? )
    ORDER BY bom_text.min_verse_id ASC
    `;
    const params = [queryBy, lang,guid];
    const segmentTextBlocks = await queryDB(sql,params);

    const uniqueSectionGuids = Array.from(new Set(segmentTextBlocks.map(b=>(b as any).section)));
    const pageGuids = Array.from(new Set(segmentTextBlocks.map(b=>(b as any).page)));
    const slugPromises = pageGuids.map(async (pageGuid)=>{
        const slug = await getSlug("link",pageGuid);
        return {pageGuid,slug}
    });
    const pageSlugs = await Promise.all(slugPromises);
    const sectionData = await Models.BomSection.findAll({
        raw:true,
        where:{guid:{[Op.in]:uniqueSectionGuids}},
        include:[
            {
                model:Models.BomSlug,
                as:"sectionSlug",
            },
            {
                model:Models.BomPage,
                as:"page"
            }

        ]
    });

    const sectionTranslations = lang ? await Models.BomTranslation.findAll({
        raw:true,
        where:{
            guid:{[Op.in]:uniqueSectionGuids},
            refkey:"title",
            lang
        }
    }) : [];

    sectionData.forEach(s=>{
        const pageGuid = (s as any).parent;
        const slug = pageSlugs.find(s=>s.pageGuid === pageGuid)?.slug || null;
        s['page.pageSlug.slug'] = slug;
    });

    const sections = uniqueSectionGuids
    .map(g=>sectionData.find(s=>(s as any).guid === g))
    .map(s=>({...s,
        title: sectionTranslations.find(t=>(t as any).guid === (s as any).guid)?.value || (s as any).title,
        slug: `${s['page.pageSlug.slug']}/${s['sectionSlug.slug']}`,
        sectionText:segmentTextBlocks.filter(b=>(b as any).section === (s as any).guid)
        .map(b=>({
            heading: b.heading_lang || b.heading,
            slug: `${s['page.pageSlug.slug']}/${b.link}`,
            status: b.completion_status === 1 ? "completed" : b.completion_status === 0 ? "started" : "incomplete"
        }))
    }));


    const countOfSectionItems = sections.reduce((a,b)=>a+b.sectionText.length,0);
    const countOfSectionItemsCompleted = sections.reduce((a,b)=>a+b.sectionText.filter(i=>i.status === "completed").length,0);
    const progress = Math.round((countOfSectionItemsCompleted/countOfSectionItems)*10000)/100;


    const segmentTranslations = lang ? await Models.BomTranslation.findAll({
        raw:true,
        where:{
            guid,
            refkey:["title","ref","period"],
            lang
        }
    }) : [];
    
    return {
        guid,
        period:segmentTranslations.find(t=>(t as any).refkey === "period")?.value || segmentData.period,
        ref:segmentTranslations.find(t=>(t as any).refkey === "ref")?.value || segmentData.ref,
        url:null,
        title:segmentTranslations.find(t=>(t as any).refkey === "title")?.value || segmentData.title,
        duedate:moment(duedate).format("YYYY-MM-DD"),
        progress,
        start,
        end,
        sections
    }

}





//Note: Some functions are exported inline, others below
export {
    getBlocksToQueue,
    getFirstTextBlockGuidFromSlug,
    organizeRelatedScriptures,
    genUserAvatar, 
    loadReadingPlan,
    loadReadingPlanSegment,
    processPassages
};