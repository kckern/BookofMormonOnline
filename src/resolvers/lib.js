const { getUserForLog, Op, includeModel } = require("./_common")
import { models as Models, sequelize, SQLQueryTypes } from '../config/database';
import { lookup } from 'scripture-guide';


const getBlocksToQueue = async (token,items) => {

    const isExplicit = items?.[0].slug && items?.[0]?.blocks?.[0];
    if(isExplicit) return items.map((item)=>({slug:item.slug,blocks:item.blocks}));


    const isSlug = items?.[0].slug;
    if(isSlug) return await getBlocksFromSlug(items[0].slug,token);

    const isReference = items?.[0].reference;
    if(isReference) return await getBlocksFromReference(items[0].reference);

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
    const link = textBlockData.link;
    const pageSlug = textBlockData.pageSlug;
    console.log(`Found textblock ${pageSlug}/${link} for reference ${reference}`);
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

  const textBlockData = await Models.BomText.findOne({raw:true,where:{guid:logEntry.value}});
  const link = textBlockData.link;
  const pageSlug = await Models.BomSlug.findOne({raw:true,where:{link:textBlockData.page}});
  return await getBlocksFromTextBlock(`${pageSlug.slug}/${link}`,token,false);
}


const getBlocksFromReadingPlan = async (plan) => {

    return {slug:"lehites",blocks:Array(20).map((_,i)=>(i+1))};

}


const getBlocksByDefault = async () => {

    return getBlocksFromPage("4becc77f2d75f");

}


const getBlocksFromSlug = async (slug,token) => {
    let last_item = slug.split("/").pop();
    const isNumeric = (parseInt(last_item)||0) > 0;
    if(isNumeric) return await getBlocksFromTextBlock(slug,token,true);
    const slugData = await Models.BomSlug.findOne({ raw:true, where: { slug: last_item  } });
    const {type,link} = slugData || {};
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
        where:{slug:pageslug}
    });
    const block = await Models.BomText.findOne({
        raw:true,
        where:{link:blocknum, page:pageSlugData.link}
    });
    const sectionGuid = block.section;
    return await buildQueueFromSection({sectionGuid,token,forceSection:force});


};

const getBlocksFromPage = async (pageGuid,token=null) => {
    //first 3 sections with incomplete blocks
    const sectionsOnPage = await Models.BomSection.findAll({
        raw:true,
        where:{parent:pageGuid}
    });
    const [sectionGuid] = sectionsOnPage.map(s=>s.guid);
    return await buildQueueFromSection({sectionGuid,token,forceSection:true});
    
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
    const unqueSectionGuids = [...new Set(allBlocks.map(b=>b.section))];
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
        const text_guids = allBlocks.filter(b=>b.section === sectionGuid).map(b=>b.guid);
        const sectionIsDone = text_guids.every(t=>completedBlocks.includes(t));
        if(sectionIsDone && !forceSection){
            console.log(`Section ${sectionGuid} is done. ${text_guids.length} blocks completed.`);
            continue;
        }
        const tmpQueue = [...queue, ...text_guids];
        //console.log(`Current queue size: ${queue.length}. Attempting to add ${text_guids.length} blocks from section ${sectionGuid}.`);
        if(tmpQueue.length > max && queue.length>1) break;
        //console.log(`Section ${sectionGuid} added to queue. ${text_guids.length} blocks added.`);
        queue = tmpQueue;
    }

    return await resolveQueueFromTextBlocks(allBlocks.filter(b=>queue.includes(b.guid)));


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

        return  results.map(r=>r.value);

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

    const uniquePageGuids = [...new Set(textBlocks.map(b=>b.page))];
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
            slug: slugs?.find(s=>s.link === pageGuid).slug || pageGuid,
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
    return textBlock?.guid;

}

async function getFirstTextBlockGuidFromSection(sectionGuid)
{
    const textBlock = await Models.BomText.findOne({
        raw:true,
        where:{section:sectionGuid},
        order:[['queue_weight','ASC']]
    });
    return textBlock?.guid;
}




//export
module.exports = {getBlocksToQueue,getFirstTextBlockGuidFromSlug}