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


async function organizeRelatedScriptures(scriptureDataArray)
{
    //schema:  [{verse_id,type,significant,dst_ref}]
    //dedupe based on verse_id.  
    scriptureDataArray = scriptureDataArray.filter((v,i,a)=>a.findIndex(t=>(t.verse_id === v.verse_id))===i);
    console.log(`Found ${scriptureDataArray.length} related scriptures.`);
    return scriptureDataArray;
}

const pickOneRamdomly = (arr) => {

    const selectedIndex = Array.from(Array(arr.length).keys()).sort(() => Math.random() - 0.5).pop();
    return arr[selectedIndex];
}

async function genUserAvatar(user_id) {
    const pallettes =  
    [
      ["FF86F1", "FF00CC"], // Baby Pink to Deep Pink
      ["00FFFF", "000080"], // Aqua to Navy
      ["99FFCC", "009933"], // Mint Cream to Pakistan Green
      ["FF6699", "990033"], // Thulian Pink to Smokey Topaz
      ["33CCFF", "003366"], // Vivid Sky Blue to Smoky Black
      ["00FF80", "004D40"], // Spring Green to Deep Jungle Green
      ["FF9933", "6B4423"], // Neon Carrot to Brown Pod
      ["FF99FF", "993399"], // Pink Flamingo to Tyrian Purple
      ["99CCFF", "003399"], // Light Cornflower Blue to Dark Powder Blue
      ["00CC99", "006633"], // Caribbean Green to MSU Green
      ["FF9999", "800000"], // Light Salmon to Maroon
      ["FFFF99", "808000"], // Canary to Olive
      ["99FF99", "006400"], // Witches Green to Pakistan Green
      ["FFCC99", "8B4513"], // Peach Orange to Saddle Brown
      ["CCCCFF", "000099"], // Periwinkle to Duke Blue
      ["CC99FF", "660099"], // Light Pastel Purple to Blue-violet
      ["FF66CC", "660033"], // Carnation Pink to Rosewood
      ["CCFFFF", "006666"], // Pale Cyan to Midnight Green
      ["FF9966", "663300"], // Atomic Tangerine to Zinnwaldite Brown
      ["66CCFF", "002266"], // Sky Blue to Navy blue
      ["99CC66", "435D36"], // Asparagus to Rifle Green
      ["66FF66", "003300"], // Screamin' Green to Dark Green
      ["FFFF66", "878700"], // Yellow to Olive Green
      ["FF9999", "942121"], // Light Salmon Pink to Dark Sienna
      ["FFCCCC", "853333"], // Bubble Gum to Deep Chestnut
      ["99CC99", "385438"], // Pale Green to British Racing Green
      ["CCCC99", "545400"], // Pale Olive to Army Green
      ["CCFFCC", "004700"], // Mint Cream to Dartmouth Green
      ["FFCC99", "6B3600"], // Peach-orange to Brown
      ["CCFF99", "3B5900"], // Pale Lime to Olive Drab
      ["FFFFCC", "878600"], // Cream to Dark Yellow
      ["FF9966", "803000"], // Atomic Tangerine to Mahogany
      ["CCFF66", "315000"], // Lime Green to Lush Pine
      ["FFCC66", "804000"], // Mango Tango to Caput Mortuum
      ["CC9999", "541717"], // Copper Rose to Dark Sienna
      ["CC66FF", "440088"], // Heliotrope to Violet
      ["FF66CC", "880044"], // Carnation Pink to Byzantium
      ["CC9966", "543517"], // Wood Brown to Liver
      ["FF66FF", "880088"], // Shocking Pink to Purple
      ["FFCCCC", "884444"], // Bubble Gum to Redwood
      ["CCFFCC", "004400"], // Mint Cream to British Racing Green
      ["CCCCFF", "000088"], // Light Periwinkle to Dark Blue
      ["99CCFF", "002288"], // Pale Cyan to Sapphire
      ["CC99CC", "541754"], // Lilac to Tyrian Purple
      ["9933CC", "320066"], // Dark Orchid to Ultra Purple
      ["3333CC", "000066"], // Medium Blue to Blue Black
      ["0099CC", "002266"], // Bondi Blue to Navy Blue
      ["6699CC", "001544"], // Jordy Blue to Oxford Blue
      ["CC3366", "54001A"], // Fuchsia Rose to Blackberry
      ["009933", "00260D"], // Shamrock Green to British Racing Green
      ["669966", "001400"]  // Camouflage Green to Dark Green
    ];

    const pack = "thumbs"; //icons, shapes, rings
    const seed = user_id.slice(0, 5);
    const [back,fore] = pickOneRamdomly(pallettes);
    const mouths = ["variant1","variant2","variant3","variant4"];
    const rotations = ["0", "20", "340", "40", "320"];
    const eyes = "variant6W10,variant8W14,variant2W10";
    const backgroundColor = `backgroundColor=${back}`;
    const shapeColor = `shapeColor=${fore}`;
    const rotation = `rotate=${pickOneRamdomly(rotations)}`
    const mouth = `mouth=${pickOneRamdomly(mouths)}`;
    const url = `https://api.dicebear.com/7.x/${pack}/svg?seed=${seed}&${backgroundColor}&${shapeColor}&eyes=${eyes}&${rotation}&scale=70&${mouth}`;
    return url;

}




//export
module.exports = {getBlocksToQueue,getFirstTextBlockGuidFromSlug,organizeRelatedScriptures,genUserAvatar}