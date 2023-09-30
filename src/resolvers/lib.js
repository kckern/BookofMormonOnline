const { getUserForLog, Op, includeModel } = require("./_common")
import { models as Models, sequelize, SQLQueryTypes } from '../config/database';


const checkCompletion = async ({queryBy, finished, text_guids}) => {

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


const findSectionsToQueue = async ({sectionGuid}) => {

    return [{guid:"4becc77f51ccb"},{guid:"4becc77f8671d"}]

}

const resolveQueueFromTextBlocks = async (textBlocks) => {

    const uniquePageGuids = [...new Set(textBlocks.map(b=>b.page))];

    //load slugs of each page guid
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
            pageGuid,
            slug: slugs?.find(s=>s.link === pageGuid).slug || pageGuid,
            blocks:textBlocks.filter(b=>b.page === pageGuid).map(b=>b.link)
        })
    }
    return output;

}


const loadTheaterQueue = async (token, info, offSet=null, logEntry=null, allBlocks=null) => {

    offSet = offSet || 0;

    //TODO load for user based on recent usage
      const {queryBy,userObj} = await getUserForLog(token);
      const finished = userObj?.finished || 0;
    //find the most recent textblock for this user
    logEntry = logEntry || await Models.BomLog.findOne({
        raw:true,
        where:{
            user:queryBy,
            timestamp: {[Op.gt]: finished},
            type:"block"
        },
        order:[['timestamp','DESC']],
    })

    allBlocks = allBlocks || await Models.BomText.findAll({
        raw:true,
        attributes:["guid","section","page","queue_weight","link"],
        order:[['queue_weight','ASC']]
    });
    if(!logEntry && offSet>=0) return await loadTheaterQueue(token, info, -1, logEntry, allBlocks);
    const uniqueSections = [...new Set(allBlocks.map(b=>b.section))];
    const textguid = logEntry?.value;
    const currentItem = textguid ? allBlocks.find(b=>b.guid === textguid) : allBlocks[0];

    let sectionIndex = offSet < 0 ? 0 : uniqueSections.indexOf(currentItem.section)  + offSet;
    const section = uniqueSections[sectionIndex];
    if(!section) return await loadTheaterQueue(token, info, -1, logEntry, allBlocks);
    const sectionTextGuids = allBlocks.filter(b=>b.section === section).map(b=>b.guid);
    const sectionIsDone = await checkCompletion({queryBy, finished, text_guids:sectionTextGuids.map(b=>b.guid)});
    if(sectionIsDone){
        console.log(`Section ${section} is done. ${sectionTextGuids.length} blocks completed.`);
        return await loadTheaterQueue(token, info, offSet + 1, logEntry, allBlocks);
    }
    //sectionWithItemsLeftTodo

    const sectionTextBlocks = allBlocks.filter(b=>b.section === section);
    let compoundSectionTextBlocks = sectionTextBlocks;
    let i=0;
    const [min,max] = [20,50];
    while(compoundSectionTextBlocks.length < min)
    {
        i++;
        const nextSection = uniqueSections[sectionIndex + i];
        if(!nextSection) break;
        const nextSectionTextBlocks = allBlocks.filter(b=>b.section === nextSection);
        let tempCollection = [...compoundSectionTextBlocks, ...nextSectionTextBlocks];
        if(tempCollection.length > max) break;
        compoundSectionTextBlocks = tempCollection;
    }
    return await resolveQueueFromTextBlocks(compoundSectionTextBlocks);


}



//export
module.exports = {loadTheaterQueue}