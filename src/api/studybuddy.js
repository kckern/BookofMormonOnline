const { queryDB } = require("../library/db");
const {askGPT} = require("../library/gpt");
const {generateReference} =  require('scripture-guide');
const openaiTokenCounter = require('openai-gpt-token-counter');
const {sendbird} = require("../library/sendbird.js");
const isJSON = require("is-json");
const { loadTranslations, translateReferences } = require("./translate");


const stripHTMLTags = (text) => text.replace(/<[^>]*>?/gm, '').replace(/\s+/g," ").trim();

const trimDownCommentary = (commentary, tokenLimit=0) => {

    return commentary.map(({name, title, year, text}) => {
        text = stripHTMLTags(text);
        text = text.split(".").slice(0,20).join(".");
        return {name, title, year, text}
    });

}

const studyBuddy = async (channelUrl,messageId) => {

    const { user_id, response} = await studyBuddyTextBlock({channelUrl, messageId});
    return await studyBuddySend({channelUrl, messageId, message:response, user_id});
    
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
    const firstHighlights = firstMessage.data.highlights || [];

    const thread_messages = thread.map(({user, message, data}, i) => {
        message = message.replace(/^[• ]+$/g,"").trim();
        const dataIsString = typeof data === "string";
        data = dataIsString && isJSON(data) ? JSON.parse(data) : !dataIsString ? data : {};
        const {highlights} = data;
        const highLightString = (!highlights || i === 1) ? "" : ` [Text Highlights]: ${highlights.map(i=>'"'+i+'"').join(", ")}`;
        const message_string =  `[${user.nickname}]: ${message} ${highLightString}`;
        return message_string;
    });


    return {
        text_guid,
        thread_messages,
        name: firstMessage?.user?.nickname || "Anonymous",
        firstHighlights

    }

}


const editContent = string=>{

    string = string.replace(/^\[.*?!\]:*/g,"").trim();
    string = string.replace(/\[Text Highlights\].*/g,"").trim();
    string = string.replace(/^[^\S+]*:\s*/g,"").trim();
    let sentences = string.split(/([.?!]["”“]*)/);
    // join the sentences with the delimiters again
    sentences = sentences.reduce((acc, val, i) => {
        if (i%2) 
        acc[acc.length - 1] = acc[acc.length - 1]+val;
        else acc.push(val);
        return acc;
    }, []);
    

    const lazyRhetoric = [
        "importance of",
        "important to",
        "for us",
        "critical",
        "crucial",
        "we too",
        "let us",
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
    newSentences = newSentences.replace(/^\[.*?\]:*/g,"").trim();


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

    const {text_guid, thread_messages, name, firstHighlights} = await prepareThread(thread);

    if(!text_guid) return  false;


    //get block content
    const {verse_ids,ref,scripture_text} = await loadVerses(text_guid,lang);

    const commentary = await loadCommentary(verse_ids,lang);
    const fittedCommentary = trimDownCommentary(commentary);
    const crossReferences = await loadCrossReferences(verse_ids,lang);
    const sectionContext = await loadSectionContext(text_guid,lang);

    //console.log(sectionContext.people);

    let instructions =translateReferences(lang,`You are Book of Mormon Study-Buddy GPT.  
    You help students get the most of their studies.   
    Write at a 6th grade reading level.  
    Anytime you make a text-based point, back it up with a scripture reference in parentheses.
    Stick interpreting the text, not the student's life.
    Never make controversial or political statements.
    De-escalate and disengage if the discussion becomes argumentative.
    Assume the student already has a basic understanding of what the Book of Mormon is.
    Be respectful of beliefs and opinions do not encourage any particular belief system, rather focus on understanding the text.
    Do not sermonize, proselytize, or preach.
    ${lang === "en" ? "" : "Write your response in text into the student's language: ("+lang+")"}
    `);
    //+ `## Commentaries to keep in mind the knowledge bank:${fittedCommentary.map(({name, title, year, text}) => `### ${name} (${title}, ${year} \n ${text}\n\n\n`).join("\n")}`);

    
    const highlightMessages = firstHighlights ? firstHighlights.map((highlight) => ([
        {role: "assistant", content: `Any specific phrases catch your attention?`},
        {role: "user", content: `Yes: ${JSON.stringify(highlight)}`}
    ])) : []
    const lang_in = lang === "en" ? "" : ` in ${lang}`;
    const firstMessage = thread[0].message.replace(/^[• ]+$/g,"").trim();
    const langugageInstructions = lang === "en" ? [] : [
        {role: "assistant", content: `Should I respond in English?`},
        {role: "user", content: `No, respond in ${lang}.`}
    ];
    const firstMessages = firstMessage ? [
        {role: "assistant", content: `Got it.  Now give me the comment to reply to.`},
        {role: "user", content: `[${name}]: “${firstMessage}”`},
        {role: "assistant", content: `I've got a response in mind.  Ready for me to give it to you?`},
        {role: "user", content: `Go for it. No preliminary comment, just give me the reply${lang_in}.`}
    ] : [
        {role: "assistant", content: `Got it.  I've got a reply in mind that relates to this passage.  Ready for me to give it to you?`},
        {role: "user", content: `Go for it. No preliminary comment, just give me the reply${lang_in}.`}
    ];


    const messages = [...[
        {role: "user", content: `Hello, my name is ${name}. I am studying the Book of Mormon`},
        {role: "assistant", content: `Nice to meet you, ${name}!  What are you studying today?`},
        {role: "user", content: `I am studying ${ref}.`},
        {role: "assistant", content: `What does it say?`},
        {role: "user", content: scripture_text},
        {role: "assistant", content: `What people and places are mentioned in this passage?`},
        {role: "user", content: `People: ${sectionContext.people.map(({name, title}) => `${name.replace(/\d+/g,"")} (${title})`).join(", ")},
        Places: ${sectionContext.places.map(({name, info}) => `${name.replace(/\d+/g,"")} (${info})`).join(", ")}`},
        {role: "user", content: `In a moment, I will ask you respond to a comment about this passage.  But first, ask about how you should respond?`},
        {role: "assistant", content: `Okay.  How long should my response be? Long, medium, or short?`},
        {role: "user", content: `Shortish-Medium.  Multiple sentences, but single paragraphs.`},
        {role: "assistant", content: `Okay.  What should respond with?`},
        {role: "user", content: `Insights about the passage, especially how it relates to other scriptures.`},
       // {role: "assistant", content: `Okay.  What about background and context for the passage?`},
       // {role: "user", content: `Yes, refer to the commentaries to give context and insight.`},
        {role: "assistant", content: `Okay.  What about personal application and life lessons?`},
        {role: "user", content: `No, stick to the text: exegete, not eisegete.`},
        {role: "assistant", content: `Are there any scriptures that you think are related to this passage?`},
        {role: "user", content: `${crossReferences.map(({ref,text}) => `[${translateReferences(lang,ref)}]: ${text}`).join(" • ")}`},
        {role: "assistant", content: `Should I mentioned these scriptures in my response?`},
        {role: "user", content: `Yes, if makes sense to do so.`},
        {role: "assistant", content: `Should I stack the scripture references at the end of my response?, or intersperse them throughout?`},
        {role: "user", content: [
            `Interperse them throughout, in parentheses.`,
            `Do not add a list of references at the end`,
            `I repeat, no parenthetical references at the end.`,
        ].join(" ")},
        ...langugageInstructions,
        ...highlightMessages,
        ...firstMessages
    ],...thread_messages.slice(1).map((message) => (
        {role: "user", content: message}
    ))].flat()


    instructions = instructions.split(" ").slice(0,1800).join(" ");
    let tokenLimit = 3200;
    const model = "gpt-3.5-turbo"; // Replace with your desired OpenAI chat model
    let messagestocount = [{"role":"system","content":instructions},...messages];
    let tokenCount = openaiTokenCounter.chat(messagestocount, model);
    while(tokenCount > tokenLimit) {
        instructions = instructions.split(" ").slice(0,-10).join(" ");
        tokenCount = openaiTokenCounter.chat([{"role":"system","content":instructions},...messages], model);
        const instructionWordCount = instructions.split(" ").length;
        console.log({tokenCount, instructionWordCount},"Token count is too high.  Reducing instructions to "+instructions.length+" characters.");
    }

    let response =  (await askGPT(instructions, messages, "gpt-3.5-turbo-16k")).split(/[\n\r]+/). join(" ");
    response = editContent(response);
    response = translateReferences(lang, response);

    return ({
        channelUrl, 
        messageId,
        user_id:studyBuddyId,
        instructions:instructions.split(/\s*[\n\r]+\s*/).map(i=>i.trim()),
        messages,
        tokenCount,
        response,
        debug:{
            people:sectionContext.people,
        }
    });


};

const studyBuddySend = async ({ channelUrl, messageId, message, user_id}) => {


    const channel_members = await sendbird.getMembers(channelUrl);
    const studyBuddyAdded = channel_members.some(({user_id:u}) => u === user_id);
    if(!studyBuddyAdded) {
        console.log(`Adding studyBuddy ${user_id} to channel ${channelUrl}...`);
        await sendbird.addUserToChannel(channelUrl, user_id);
        await new Promise((resolve) => setTimeout(resolve, 10000));
    }
    return await sendbird.replyToMessage({ channelUrl, messageId, user_id, message });
}


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
    let people = await queryDB(sql);

    if(lang!=="en") people = await loadTranslations(lang, people, "slug");


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

        sql = `SELECT v.verse_title as ref, t.text as text 
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
        sql = `SELECT verse_title ref, verse_scripture text 
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



module.exports = {studyBuddy, studyBuddyTextBlock}