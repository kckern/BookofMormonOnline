const { queryDB } = require("../library/db");
const {askGPT} = require("../library/gpt");
const {generateReference} =  require('scripture-guide');
const openaiTokenCounter = require('openai-gpt-token-counter');
const {sendbird} = require("../library/sendbird.js");
const isJSON = require("is-json");


const stripHTMLTags = (text) => text.replace(/<[^>]*>?/gm, '').replace(/\s+/g," ").trim();

const trimDownCommentary = (commentary, tokenLimit=0) => {

    return commentary.map(({name, title, year, text}) => {
        text = stripHTMLTags(text);
        text = text.split(".").slice(0,20).join(".");
        return {name, title, year, text}
    });

}

const studyBuddy = async (channelUrl,messageId) => {


    return studyBuddyTextBlock({channelUrl, messageId});
}

const prepareThread = async (thread)=>
{
    const firstMessage = thread[0];
    const lastSlug = firstMessage.custom_type.split("/")?.pop();
    if(isJSON(firstMessage.data)) firstMessage.data = JSON.parse(firstMessage.data) || {};
    const {links} = firstMessage.data;
    if(!links?.text) return {text_guid:null, thread_messages:[]};
    //todo if links.section, then get section context
    const sql = `SELECT t.guid FROM bom_slug s
    JOIN bom_text t ON s.link = t.page
    WHERE t.link = '${links.text}'
    AND s.slug = '${lastSlug}'`;
    const [item] = await queryDB(sql)
    const text_guid = item?.guid || null;

    const thread_messages = thread.map(({user, message, data}) => {
        const dataIsString = typeof data === "string";
        data = dataIsString && isJSON(data) ? JSON.parse(data) : !dataIsString ? data : {};
        const {highlights} = data;
        const highLightString = !highlights ? "" : ` [Text Highlights]: ${highlights.map(i=>'"'+i+'"').join(", ")}`;
        const message_string =  `[${user.nickname}]: ${message} ${highLightString}`;
        return message_string;
    });

    return {
        text_guid,
        thread_messages
    }

}

const editContent = string=>{

    string = string.replace(/^\[.*?!\]:*/g,"").trim();
    string = string.replace(/\[Text Highlights\].*/g,"").trim();
    const sentences = string.split(/([.?!])/);
    //merge evens ands odds to rejoin sentences with their delimiters
    sentences = sentences.reduce((acc,curr,i) => {
        if(i%2) {
            acc[acc.length-1] = acc[acc.length-1]+curr;
        } else {
            acc.push(curr);
        }
        return acc;
    },[]);



    const lazyRhetoric = [
        "importance of",
        "important to",
        "for us",
        "critical",
        "crucial",
        "i hope",
        "let me know",
        "we must",
        "personal",
        "teaches us",
        "in conclusion",
        "when we",
        "we should",
        "we can",
        "we may",
        "matters most",
        "ultimately,",
        "our own",
        "apply this",
        "great example",
        "teach us",
        "important lesson",
        "valuable lesson",
        "but rather",
        "our own lives",
        "overcome",
        "help us",
        "our lives",
        "feel free",
        "should remember",
    ];
    let newSentences = sentences.filter((sentence) => !lazyRhetoric.some((phrase) => sentence.toLowerCase().includes(phrase)));
    newSentences =  newSentences.join(" ");
    newSentences = newSentences.replace(/^[\.\s]+/g,"").trim();
    return newSentences;

}


const studyBuddyTextBlock = async ({ channelUrl, messageId}) => {

    // await set studyBuddy Metadata to text_guid slug.

    //get channel metadata lang key
    const channel = await sendbird.loadChannel(channelUrl);
    const lang = channel.metadata.lang || "en";

    const studyBuddyId = {
        "ko":"938e2c5ac2c938b8156a7faf9ef9465f"
    }[lang] || "ddc26a0e41b6daffff542e9fe8d9171d"


    const thread = await sendbird.getThread({ channelUrl, messageId }) ;

    const {text_guid, thread_messages} = await prepareThread(thread);

    if(!text_guid) return  false;


    //get block content
    const {verse_ids,ref,scripture_text} = await loadVerses(text_guid,lang);

    const commentary = await loadCommentary(verse_ids,lang);
    const fittedCommentary = trimDownCommentary(commentary);
    const crossReferences = await loadCrossReferences(verse_ids,lang);
    const sectionContext = await loadSectionContext(text_guid,lang);

    //console.log(sectionContext.people);

    let instructions = `You are Book of Mormon Study-Buddy GPT.  
    You help students get the most of their studies.   
    Write at a 6th grade reading level.  
    Anytime you make a text-based point, back it up with a scripture reference in parentheses.
    Stick interpreting the text, not the student's life.
    Never make controversial or political statements.
    De-escalate and disengage if the discussion becomes argumentative.
    Assume the student already has a basic understanding of what the Book of Mormon is.
    Be respectful of beliefs and opinions do not encourage any particular belief system, rather focus on understanding the text.
    Do not sermonize, proselytize, or preach.
    ${lang !== "en" ? "" : "Write your response in text into the student's language: ("+lang+")"}
    
    # This is the passage you are helping the student study:
    **${ref}**: ${scripture_text}

    ## Scripture references that are often cross-referenced with this passage:
    ${crossReferences.map(({ref,text}) => `**${ref}**: ${text}`).join("\n")}

    ## People and places that are mentioned in this passage:
    ${sectionContext.people.map(({name, title, description}) => `**${name}** (${title}): ${description}`).join("\n")}
    ${sectionContext.places.map(({name, info, description}) => `**${name}** (${info}): ${description}`).join("\n")}

    ## Commentaries others have written about this passage:
    ${fittedCommentary.map(({name, title, year, text}) => `### ${name} (${title}, ${year} \n ${text}\n\n\n`).join("\n")}
    `

    const messages = thread_messages.map((message) => (
        {role: "user", content: message}
    ));

    instructions = instructions.split(" ").slice(0,1800).join(" ");
    let tokenLimit = 3200;
    const model = "gpt-3.5-turbo"; // Replace with your desired OpenAI chat model
    let messagestocount = [{"role":"system","content":instructions},...messages];
    let tokenCount = openaiTokenCounter.chat(messagestocount, model);
    console.log("Token count is "+tokenCount);
    while(tokenCount > tokenLimit) {
        instructions = instructions.split(" ").slice(0,-10).join(" ");
        tokenCount = openaiTokenCounter.chat([{"role":"system","content":instructions},...messages], model);
        const instructionWordCount = instructions.split(" ").length;
        console.log({tokenCount, instructionWordCount},"Token count is too high.  Reducing instructions to "+instructions.length+" characters.");
    }

    
    let gptString =  (await askGPT(instructions, messages, "gpt-3.5-turbo-16k")).split(/[\n\r]+/). join(" ");
    gptString = editContent(gptString);

    console.log({gptString});
   
    const channel_members = await sendbird.getMembers(channelUrl);
    const studyBuddyAdded = channel_members.some(({user_id}) => user_id === studyBuddyId);
    if(!studyBuddyAdded) {
        await sendbird.addUserToChannel(channelUrl, studyBuddyId);
        await new Promise((resolve) => setTimeout(resolve, 10000));
    }



    await sendbird.replyToMessage({ channelUrl, messageId, user_id:studyBuddyId, message: gptString });



    //get commentary

    return ({
        ref,
        scripture_text,
        thread_messages,
        gptString,
        instructions
    });


};

const stripPeoplePlaces = (text) => {
    text = text.replace(/{(.*?)\|.*?}/g,"$1");
    text = text.replace(/\[(.*?)\|.*?\]/g,"$1");
    return text;
}

const extractPeoplePlaceIds = (text) => {

    const people = [...new Set(text.match(/{.*?\|(.*?)}/g)?.map((match) => match.replace(/{.*?\|/,"").replace(/}/,"")))];
    const places = [...new Set(text.match(/\[.*?\|(.*?)\]/g)?.map((match) => match.replace(/\[.*?\|/,"").replace(/]/,"")))];

    //return deduped

    return {
        people,
        places
    }


}

const loadPeople = async (people_slugs,lang="en") => {

    if(!people_slugs?.length) return [];
    const max_sentences = 5;
    people_slugs = people_slugs.filter((slug) => !["god","jesus-christ"].includes(slug));
  
    let sql = `SELECT * FROM bom_people WHERE slug IN (${people_slugs.map((slug) => `"${slug}"`).join(",")})`;

    if (lang!=="en"){
        sql = `SELECT p.slug, 
        IFNULL(tn.value, p.name) as name, 
        IFNULL(tt.value, p.title) as title, 
        IFNULL(td.value, p.description) as description 
        FROM bom_people p 
        LEFT JOIN bom_translation tn ON p.slug = tn.guid AND tn.refkey = 'name' AND tn.lang = '${lang}' 
        LEFT JOIN bom_translation tt ON p.slug = tt.guid AND tt.refkey = 'title' AND tt.lang = '${lang}' 
        LEFT JOIN bom_translation td ON p.slug = td.guid AND td.refkey = 'description' AND td.lang = '${lang}' 
        WHERE p.slug IN (${people_slugs.map((slug) => `"${slug}"`).join(",")})`;
    }

    const people = await queryDB(sql);
    return people.map(({name, title, description}) => {
        description = stripPeoplePlaces(stripHTMLTags(description || "")).split(".").slice(0,max_sentences).join(".");
        return {name, title, description};
    });

}

const loadPlaces = async (place_slugs) => {
        if(!place_slugs?.length) return [];
        const max_sentences = 5;
        const sql = `SELECT * FROM bom_places WHERE slug IN (${place_slugs.map((slug) => `"${slug}"`).join(",")})`;
        const places = await queryDB(sql);
        return places.map(({name, info, description}) => {
            description = stripPeoplePlaces(stripHTMLTags(description)).split(".").slice(0,max_sentences).join(".");
            return {name, info, description};
        });


}


const loadSectionContext = async (text_guid,lang) => {

const sql= `SELECT title, description
FROM bom_narration bn
JOIN bom_sectionrow bsr ON bn.parent = bsr.guid
JOIN bom_section bs ON bsr.parent = bs.guid
JOIN bom_text bt ON bs.guid = bt.section
WHERE bsr.type = "N" AND bt.guid = "${text_guid}";`;

    const sectionContext = await queryDB(sql);
    

    const {people, places} = extractPeoplePlaceIds(sectionContext.map(({description}) => description).join(" "));

    return {
        title: sectionContext[0].title,
        narration: sectionContext.map(({description}) => stripPeoplePlaces(description)).join(" "),
        people: await loadPeople(people,lang),
        places: await loadPlaces(places,lang)
    }


    

};

const loadCommentary = async (verse_ids) => {

    // anything in c.verse_id + c.verse_range should be in verse_ids
    const sql = `
    SELECT  s.source_name name, s.source_title title, s.source_year year, c.text
    FROM bom_xtras_commentary c
    JOIN bom_xtras_source s ON c.source = s.source_id
    WHERE s.source_lang = "en" AND (${verse_ids.map(verse_id => `(${verse_id} BETWEEN c.verse_id AND c.verse_id + c.verse_range - 1)`).join(' OR ')})
    `;
    const commentary = await queryDB(sql);
    return commentary.map(({name, title, text, year}) => ({name, title, year, text:stripHTMLTags(text)}));


}

const loadCrossReferences = async (verse_ids, lang) => {
    let sql;
    
    if(lang && lang !== 'en') {

        sql = `SELECT v.verse_title_short as ref, t.text as text 
        FROM lds_scriptures_verses v JOIN lds_scriptures_translations t
                ON v.verse_id = t.verse_id
                WHERE v.verse_id IN 
                    (SELECT distinct dst_verse_id FROM lds_scriptures_crossref
                    WHERE src_verse_id IN (${verse_ids.join(",")})
                    AND type = "xref"
                    AND significant = 0
                    AND t.lang = '${lang}' )
                ORDER BY v.verse_id;`

    } else {
        sql = `SELECT verse_title_short ref, verse_scripture text 
        FROM lds_scriptures_verses 
        WHERE verse_id IN 
        (SELECT distinct dst_verse_id FROM lds_scriptures_crossref
        WHERE src_verse_id IN (${verse_ids.join(",")})
        AND type = "xref" and significant = 0
        ORDER BY dst_verse_id) 
        ORDER BY verse_id;`;
    } 
    
    
    const crossReferences = await queryDB(sql);
    return crossReferences.map(({ref,text}) => ({ref, text}));

}


const loadVerses = async (guid, lang) => {

    let sql = `
    SELECT v.verse_id, v.verse_scripture
    FROM bom_lookup l
    JOIN lds_scriptures_verses v
    ON l.verse_id = v.verse_id
    WHERE l.text_guid = '${guid}'
    ORDER BY l.verse_id;`;
    
    if(lang && lang !== 'en') {

        sql = `SELECT v.verse_id, t.text as verse_scripture
        FROM bom_lookup l
        JOIN lds_scriptures_verses v
        ON l.verse_id = v.verse_id
        JOIN lds_scriptures_translations t
        ON v.verse_id = t.verse_id
        WHERE t.lang = '${lang}'
        AND l.text_guid = '${guid}'
        ORDER BY l.verse_id;`;

    } 
    

    const verses = await queryDB(sql);
    const verse_ids = verses.map((verse) => verse.verse_id);
    const scripture_text = verses.map((verse) => verse.verse_scripture).join(" ");
    const ref = generateReference(verse_ids)

    return {verse_ids, scripture_text, ref};

}



module.exports = studyBuddy