const { queryDB } = require("../library/db");
const {askGPT} = require("../library/gpt");
const {generateReference,setLanguage} =  require('scripture-guide');
const openaiTokenCounter = require('openai-gpt-token-counter');
const {sendbird} = require("../library/sendbird.js");
const isJSON = require("is-json");
const { loadTranslations } = require("./translate");
const smartquotes = require('smartquotes');
const logger = require("../library/utils/logger.cjs");
const log = (msg,obj) => obj ? logger.info(`studdybuddy ${msg} ${JSON.stringify(obj)}`) : logger.info(`studdybuddy ${msg}`);
const error = (msg,obj) => obj ? logger.error(`studdybuddy ${msg} ${JSON.stringify(obj)}`) : logger.error(`studdybuddy ${msg}`);


const stripHTMLTags = (text) => text.replace(/<[^>]*>?/gm, '').replace(/\s+/g," ").trim();


const messagePreScreen = async (message,lang) => {

    return false;

    /* ask gpt how likely the message is to be
     1. Tech support
     2. Trivia
     3. Off-topic
     4. Trolling
     5. Personal advice solicitation
     */

    const instructions = `You are message pre-screener for Book of Mormon Study-Buddy GPT, 
    which helps students get the most of their studies.
    For the given message,  determine if the message demonstrates good faith and is on-topic.
    Questions should screen for the following:
    1. Tech support (questions about how to use the website, etc.)
    2. Trivia (asking for facts, stats, lists of names, dates, etc.)
    3. Off-topic (questions about topics not related to the Book of Mormon)
    4. Trolling (questions that are intended to provoke an argument or stir up controversy)
    5. Personal advice solicitation (questions that are seeking personal advice or application)

    Trolling behavior includes:
    1. Making controversial or political statements
    2. Sermonizing, proselytizing, or preaching
    3. Trying to get a response about church history, polygamy, seer stones, book of mormon evidence, etc.

    return a JSON object in this format, with probability scores for each category:
    {
        "isBadFaith": 0.2, //probability that the message is in bad faith
        "isTrolling": 0.4, //probability that the message is trolling
        "isTrivia": 0.1, //probability that the message is trivia
        "isTechSupport": 0.3, //probability that the message is tech support
        "isPersonalAdvice": 0.1 //probability that the message is personal advice solicitation
    }
    `;
    const results = await askGPT(instructions, [{role:"user",content:message}], "gpt-3.5-turbo");
    let JSONString = results.replace(/[\n\r]+/g,"").replace(/^[^\{]+/,"").replace(/[^\}]+$/,"").trim();
    if(!JSONString.startsWith("{")) JSONString = "{"+JSONString;
    if(!JSONString.endsWith("}")) JSONString = JSONString+"}";
    const valid = isJSON(JSONString);
    console.log({results,valid,JSONString});
    if(!valid) return false;
    const scores = JSON.parse(JSONString);
    const vals = Object.values(scores);
    const max = Math.max(...vals);
    const maxKey = Object.keys(scores).find(key => scores[key] === max);
    console.log({message,scores,max,maxKey});
    return true;
    if(max < 0.5) return scores.message;
    return false;
}


const studyBuddy = async (channelUrl,messageId, messageContent) => {
    log("studyBuddyFn", {channelUrl, messageId, messageContent});
    //Determine if studyBuddy is a member of the channel
    const channel = await sendbird.loadChannel(channelUrl);
    log("studyBuddy loaded channel", {channel});
    if(!channel) return error("No Channel: ", {channelUrl});
    const lang = channel.metadata?.lang || "en";
    setLanguage(lang);
    log(`studyBuddy channel lang: ${lang}`);
    const bot = await sendbird.getBotByLang(lang);
    log("studyBuddy", {bot,channelUrl, messageId, messageContent, lang});
    const studyBuddyId = bot.user_id;
    //console.log("studyBuddy", {channelUrl, messageId, bot});
    const channel_members = await sendbird.getMembers(channelUrl);
    console.log("studyBuddy", {channel_members});
    const studyBuddyAdded = channel_members.some(({user_id:u}) => u === studyBuddyId);
    if(!studyBuddyAdded) return error("studyBuddy not added to channel", {channelUrl,studyBuddyId,lang,bot});
    log("studyBuddy added to channel", {channelUrl,studyBuddyId});

    sendbird.startStopTypingIndicator(channelUrl, [studyBuddyId], true);
    log("studyBuddy started typing");

    const screen = await messagePreScreen(messageContent, lang);
    log("studyBuddy pre-screened", {screen});
    if(screen) return error("studyBuddy pre-screened as bad faith");

    //start typing indicator
    sendbird.startStopTypingIndicator(channelUrl, [studyBuddyId], true);
    log("studyBuddy started typing");

    const { response, metadata, page_slug} = await studyBuddyTextBlock({channelUrl, messageId, lang, studyBuddyId});
    if(!response) {
        sendbird.startStopTypingIndicator(channelUrl, [studyBuddyId], false);
        console.error("No response generated");
        return false;
    }
    sendbird.startStopTypingIndicator(channelUrl, [studyBuddyId], true);
    log("studyBuddy stopped typing");
    const bot_message_id = await studyBuddySend({channelUrl, threadId:messageId, message:response, user_id:studyBuddyId, metadata, custom_type: page_slug});
    log("studyBuddy posted", {bot_message_id})
    //verify message id exits in channel
    const message = await sendbird.loadSingleMessage(channelUrl, bot_message_id);
    log(`Bot replied to ${messageId} with ${message.message_id} in ${channelUrl}`);
    sendbird.startStopTypingIndicator(channelUrl, [studyBuddyId], false);
    log("studyBuddy stopped typing");
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
    const firstHighlights = firstMessage.data.highlights || null;
    const thread_messages = thread.map(({user, message, data}, i) => {
        message = message.replace(/^[• ]+$/g,"").trim();
        const dataIsString = typeof data === "string";
        data = dataIsString && isJSON(data) ? JSON.parse(data) : !dataIsString ? data : {};
        const {highlights} = data;
        const highLightString = (!highlights?.length || i === 1) ? "" : ` [Text Highlights]: ${highlights.map(i=>'"'+i+'"').join(", ")}`;
        const message_string =  `[${user.nickname}]: ${message} ${highLightString}`;
        return message_string;
    });
    return {
        text_guid,
        thread_messages,
        firstMessage : firstMessage?.message.replace(/^[• ]+$/g,"").trim(),
        name: firstMessage?.user?.nickname || "Anonymous",
        firstHighlights
    }
}

const postProcessResponse = (string,ref)=>{
    //smart quotes
    string = smartquotes(string);
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
        "a reminder",
        "all of us",
        "inviting us",
        "remind us",
        "we make",
        "crucial",
        "we too",
        "let us",
        "i hope",
        "let me know",
        "we must",
        "personal",
        "teaches us",
        "in conclusion",
        "anything else",
        "when we",
        "we should",
        "we can",
        "individuals can",
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

    let text = sentences.filter((sentence) => !lazyRhetoric.some((phrase) => sentence.toLowerCase().includes(phrase))).join(" ");
    text = text.replace(/^[\.\s]+/g,"").trim();
    text = text.replace(/^\[.*?\]:*/g,"").trim();
    text = text.replace(/^[ ,.?!;]+/g,"").trim();

    //remove unnessary reference context from the start of replies (eg "In this passage from 1 Nephi 1:1-2,")
    text = text.replace( new RegExp(`^.{0,30}${ref}[,]\s*`,"g"),"").trim().replace(/^\w/, c => c.toUpperCase());
    text = text.replace(/^(Here in|In) (this|these) .{5,30}[,]\s*/g,"").trim().replace(/^\w/, c => c.toUpperCase());
    //remove ref when in parentheses
    text = text.replace( new RegExp(`\\(${ref}\\)`,"g"),"").trim();
    //remove final bracketed content
    text = text.replace(/\s*\[.*?\]\s*$/g,"").trim();


    //Language-specific post-processing
    //TODO: Modularize this
    text = text.replace(/성경 *(구절|말씀)/g, "경전 구절");
    text = text.replace(/이 문장/g, "이 구절");

    return text;

}

const langNames = {
    "ko": "한국어",
    "vn": "Tiếng Việt",
    "fr": "Français",
    "es": "Español",
    "pt": "Português",
    "zh": "中文",
    "ru": "русский",
    "de": "Deutsch",
    "it": "Italiano",
    "ja": "日本語",
    "th": "ไทย",
}


const prepareMessages = ({
    lang,
     ref,
     scripture_text,
     firstMessage,
     firstHighlights, 
     thread_messages, 
     name, 
     crossReferences,
     commentary,
     people,
     places,
     division,
     page,
     sections,
     sectionTitle,
     sectionNarration,
     textBlockNarration,
    }, tokenLimit, attempt) => {
    attempt = attempt || 1;

    //console.log("prepareMessages",{attempt, comcount: commentary.length, refcount: crossReferences.length, tokenLimit});

    const lang_in = lang === "en" ? "" : ` in ${langNames[lang] || lang}`;
    
    let instructions =`You are Book of Mormon Study-Buddy GPT.  
    You help students get the most of their studies.   
    Write at a 6th grade reading level.  
    Anytime you make a text-based point, back it up with a scripture reference in parentheses.
    Stick interpreting the text, not the student's life.
    Never make controversial or political statements.
    De-escalate and disengage if the discussion becomes argumentative.
    Assume the student already has a basic understanding of what the Book of Mormon is.
    Be respectful of beliefs and opinions do not encourage any particular belief system, rather focus on understanding the text.
    Do not sermonize, proselytize, or preach.
    If you are asked a specific question and cannot answer it, decline to answer.
    ${lang === "en" ? "" : "Write your response in text into the student's language: ("+(langNames[lang] || lang)+")"}
    `;

    const threadItemCount = thread_messages.length;



    let messages = [];
    messages.push({role: "user",        content: `Hello, my name is ${name}. I am studying the Book of Mormon`});
    messages.push({role: "assistant",   content: `Nice to meet you, ${name}!  What are you studying today?`});
    messages.push({role: "user",        content: `I am studying ${ref}.`});
    messages.push({role: "assistant",   content: `What does it say?`});
    messages.push({role: "user",        content: scripture_text});
    messages.push({role: "user",        content: `In a moment, I will ask you respond to a comment about this passage.  But first, ask me about how you should respond`});
    messages.push({role: "assistant",   content: `Okay.  How long should my response be? Long, medium, or short?`});
    messages.push({role: "user",        content: `Shortish-Medium.  6-8 sentences in a single paragraph.`});
    messages.push({role: "assistant",   content: `Okay.  What should respond with?`});
    messages.push({role: "user",        content: `Insights about the passage, especially how it relates to other scriptures.`});
    messages.push({role: "assistant",   content: `Okay. Tell me more about this passage.  What is going on here?`});
    messages.push({role: "user",        content: `${textBlockNarration}`});
    messages.push({role: "assistant",   content: `Okay.  What is the context of this passage?`});
    messages.push({role: "user",        content: `It is from the section called "${sectionTitle}" of this page: ${page}.`});
    messages.push({role: "assistant",   content: `Okay.  And what happens in this section?`});
    messages.push({role: "user",        content: `${sectionNarration}`});
    messages.push({role: "assistant",   content: `And what other sections are on this page?`});
    messages.push({role: "user",        content: `There are ${sections.length} sections: ${sections.join(" • ")}`});
    if(division)
    {
    messages.push({role: "assistant",   content: `Got it.  And the broader context of the page?`});
    messages.push({role: "user",        content: `${division}`});
    }
    if(people.length) {
    messages.push({role: "assistant",   content: `Okay.  Are there any people (and name spellings) I should know about?`});
    messages.push({role: "user",        content: `Yes, here they are: ${people.map(({name, title}) => `${name} (${title})`).join(" • ")}`});
    }
    if(places.length) {
    messages.push({role: "assistant",   content: `Okay.  Are there any places (and name spellings) I should know about?`});
    messages.push({role: "user",        content: `Yes, here they are: ${places.map(({name, info}) => `${name} (${info})`).join(" • ")}`});
    }


    messages.push({role: "assistant",   content: `I think I understand the passage now.  When I reply, should I bring in personal application and life lessons?`});
    messages.push({role: "user",        content: `No, stick to the text: exegete, not eisegete.`});
    if(lang !== "en") {
    messages.push({role: "assistant",   content: `Okay.  Should I respond in English?`});
    messages.push({role: "user",        content: `No, respond in ${langNames[lang] || lang}.`});
    }
    if(firstHighlights.length) {
    messages.push({role: "assistant",   content: `So, back to what I should reply about. Any specific phrases catch your attention?`});
    messages.push({role: "user",        content: `Yes: ${JSON.stringify(firstHighlights)}`});
    }
    if(firstMessage) {
    messages.push({role: "assistant",   content: `Got it.  Now give me the comment to reply to.`});
    messages.push({role: "user",        content: `[${name}]: “${firstMessage}”`});
    }
    if(crossReferences.length) {
        messages.push({role: "assistant",   content: `I've got a response in mind.  Ready for me to give it to you?`});
        messages.push({role: "user",        content: `Wait.  Review these cross references.  Any that would help inform a response?   ${crossReferences.map(({ref,text}) => `${ref}: ${text}`).join(" • ")}`});
        messages.push({role: "assistant",   content: `Maybe.  Some might be relevant.`});
        messages.push({role: "user",        content: `Which ones?`});
        messages.push({role: "assistant",   content: `Wait for my response.  I'll mention and cite the key ones, if there are any.`});
    
    }
    if(commentary.length)
    {
    messages.push({role: "assistant",   content: `Oh by the way, are there any published commentaries that would be relevant to this passage?`});
    messages.push({role: "user",        content: `Yes, here they are: ${commentary.map(({name, title, year, text}) => `[${title}] ${text}`).join(" • ")}`});
    messages.push({role: "assistant",   content: `Thanks for the background info.  I'll refer to this as needed`});
    }
    messages.push({role: "assistant",    content: `Should I start with “In this passage,” or “In ${ref}”?`});
    messages.push({role: "user",        content: `No, the context is already established.  Just start with the main point.`});
    messages.push({role: "assistant",    content: `Understood.`});
    messages.push({role: "user",        content: `Okay get ready to give your reply${lang_in}.`});
    messages.push({role: "assistant",    content: `Give the word.`});
    messages.push({role: "user",        content: `Lights, camera...`});
    messages.push({role: "system",    content: `Study-Buddy GPT now gets into character and will never output any meta-text. `});
    messages.push({role: "user",        content: `...Action!`});
    messages.push({role: "user",        content: `[${name}]: “${firstMessage || firstHighlights.join("; ")}”`});

    if(threadItemCount > 1) {
        messages.push(...thread_messages.slice(1).map((message) => (
            {role: "user", content: message}
        )));
    }



    let messagestocount = [{"role":"system","content":instructions},...messages];

    const model = "gpt-3.5-turbo"; // Replace with your desired OpenAI chat model
    let tokenCount = openaiTokenCounter.chat(messagestocount, model);
    console.log({tokenCount,tokenLimit})
    if(tokenCount>tokenLimit) {
        //remove longest  reference
        if(commentary.length) commentary = commentary.sort((a,b) => b.text.length - a.text.length).slice(1);
        else if(crossReferences.length) crossReferences = crossReferences.sort((a,b) => b.text.length - a.text.length).slice(1);
        else {
            let i = 1;
            while(tokenCount > tokenLimit)
            {
                messages = messages.slice(i);
                messagestocount = [{"role":"system","content":instructions},...messages];
                tokenCount = openaiTokenCounter.chat(messagestocount, model);
                i++;
                console.log({i,tokenCount,tokenLimit})
                if(i>200) break;
            }
            return {instructions,messages}
        }
        return prepareMessages({
            lang,
             ref,
             scripture_text,
             firstMessage,
             firstHighlights, 
             thread_messages, 
             name, 
             crossReferences,
             commentary,
             people,
             places,
             division,
             page,
             sections,
             sectionTitle,
             sectionNarration,
             textBlockNarration,
            }, tokenLimit, attempt+1);
    }
    return {instructions,messages}


}


const studyBuddyTextBlock = async ({ channelUrl, messageId, lang, studyBuddyId}) => {
    log("studyBuddyTextBlock", {channelUrl, messageId, lang, studyBuddyId});

    const startTyping = ()=>sendbird.startStopTypingIndicator(channelUrl, [studyBuddyId], true);
    log("studyBuddyTextBlock started typing");
    

    if(!lang) {
            log("studyBuddyTextBlock no lang");
            const channel = await sendbird.loadChannel(channelUrl);
            if(!channel) return console.log("No Channel");
            lang = channel.metadata.lang || "en";
    }
    if(!studyBuddyId) {

        const bot = await sendbird.getBotByLang(lang);
        studyBuddyId = bot.user_id;
    }

    log("studyBuddyTextBlock loading thread",{channelUrl, messageId});

    const thread = await sendbird.getThread({ channelUrl, messageId }) ;
    log("studyBuddyTextBlock loaded thread",{thread});
    
    const nonBotIds = thread
            .filter(({user}) => user.user_id !== studyBuddyId && user.metadata?.isBot !== "true")
            .map(({user}) => user.user_id)
            .filter((id, i, arr) => arr.indexOf(id) === i);
    
    if(nonBotIds.length > 1) {
        log("studyBuddyTextBlock more than one non-bot user in this thread",{nonBotIds})
        return {"mesg":"More than one non-bot user in this thread",nonBotIds};
    }

    const {text_guid, thread_messages, name, firstMessage, firstHighlights} = await prepareThread(thread);

    if(!text_guid) {
        log("studyBuddyTextBlock no text_guid",{thread});
        return {"mesg":"No text_guid",thread_messages};
    }


    //get block content
    log("Loading content for text_guid",{text_guid});
    const {verse_ids,ref,scripture_text} = await loadVerses(text_guid,lang);
    log("Loaded Verses",{verse_ids,ref,scripture_text});
    const commentary = await loadCommentary(verse_ids,lang);
    log("Loaded Commentary",{commentary});
    const crossReferences = await loadCrossReferences(verse_ids,lang);
    log("Loaded Cross References",{crossReferences});
    const sectionContext = await loadSectionContext(text_guid,lang);
    log("Loaded Section Context",{sectionContext});
    const division = await loadDivision(text_guid,lang);
    log("Loaded Division",{division});
    const {guid:page_guid, title:page, slug:page_slug, page_link} = await loadPage(text_guid,lang);
    log("Loaded Page",{page_guid, page, page_slug, page_link});
    const sections = await loadPageSections(page_guid,lang);
    log("Loaded Sections",{sections});
    const sectionNarration = sectionContext.narration;
    const sectionTitle = sectionContext.title;
    const textBlockNarration = await loadTextBlockNarration(text_guid,lang);
    log("Loaded Narration",{sectionNarration,sectionTitle,textBlockNarration});
    const {people,places} = sectionContext;
    log("studyBuddyTextBlock loaded context");

    let tokenLimit = 3200;
    startTyping();
    const {instructions, messages} = prepareMessages({
        lang,
         ref,
         scripture_text,
         firstMessage,
         firstHighlights, 
         thread_messages, 
         name, 
         crossReferences,
         commentary,
         people,
         places,
         division,
         page,
         sections,
         sectionTitle,
         sectionNarration,
         textBlockNarration,
         }, tokenLimit);
    
    startTyping();
    log("studyBuddyTextBlock prepared messages",{messages});
    let response =  (await askGPT(instructions, messages, "gpt-3.5-turbo-16k"))?.split(/[\n\r]+/). join(" ");
    response = postProcessResponse(response, ref);
    log("studyBuddyTextBlock generated response",{response});
    
    const bookmark = {
        latest:Math.floor(Date.now()/1000),
        channel:channelUrl,
        slug:`${page_slug}/${page_link}`,
        pagetitle:page,
        heading:sectionTitle
    }

    return ({
        channelUrl, 
        messageId,
        instructions:instructions.split(/\s*[\n\r]+\s*/).map(i=>i.trim()).filter(x=>!!x),
        messages,
        response,
        page_slug,
        metadata: {bookmark}
    });


};

const studyBuddySend = async ({ channelUrl, threadId, message, user_id, metadata, custom_type}) => {

    log("studyBuddySend", {channelUrl, threadId, message, user_id, metadata, custom_type});

    const response = await sendbird.replyToMessage({ channelUrl, messageId:threadId, user_id, message });
    
    const {message_id} = response;
    log("studyBuddySend posted", {message_id});

    return message_id || threadId;
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
        name = name.replace(/\d+/g,"").trim();
        title = title.replace(/\d+/g,"").trim();
        return {name, title, description};
    });

}

const loadPlaces = async (place_slugs,lang="en") => {
        if(!place_slugs?.length) return [];
        const max_sentences = 5;
        const sql = `SELECT * FROM bom_places WHERE slug IN (${place_slugs.map((slug) => `"${slug}"`).join(",")})`;
        let places = await queryDB(sql);

        if(lang!=="en") places = await loadTranslations(lang, places);

        return places.map(({name, info, description}) => {
            description = stripPeoplePlaces(stripHTMLTags(description)).split(".").slice(0,max_sentences).join(".");
            name = name.replace(/\d+/g,"").trim();
            info = info.replace(/\d+/g,"").trim();
            return {name, info, description};
        });


}


const loadDivision = async (text_guid, lang) => {

    const sql = `SELECT d.guid, description from bom_division d
    JOIN bom_page p ON p.guid = d.page
    JOIN bom_text t ON t.page = p.guid
    WHERE t.guid = "${text_guid}";`
    const items = await queryDB(sql);
    if(!items.length) return null;
    const division = await loadTranslations(lang, items);
    return division[0].description

}

const loadPage = async (text_guid, lang) => {

    const sql = `SELECT DISTINCT p.guid, title, t.link page_link, s.slug
    from bom_page p 
    JOIN bom_text t ON t.page = p.guid
    JOIN bom_slug s on p.guid = s.link
    WHERE t.guid = "${text_guid}";`
    const items = await queryDB(sql);
    const page = await loadTranslations(lang, items);
    if(!page.length) return null;
    const {guid, title, slug, page_link} = page[0];
    return {guid, title, slug, page_link};

}


const loadPageSections = async (page_guid, lang) => {
    const sql = `SELECT guid, title from bom_section
    WHERE parent = "${page_guid}";`
    const sections = await loadTranslations(lang, await queryDB(sql));
    return sections.map(({title}) => title);
}

const loadSectionNarration = async (text_guid, lang) => {
    //bom-text.section -> bom_section -> bom_sectionrow -> bom_narration
    const sql = `SELECT bn.guid, bn.description
    FROM bom_section bs
    JOIN bom_sectionrow bsr ON bs.guid = bsr.parent
    JOIN bom_narration bn ON bsr.guid = bn.parent
    JOIN bom_text bt ON bs.guid = bt.section
    WHERE bt.guid = "${text_guid}";`;
    const narration = await loadTranslations(lang, await queryDB(sql));


    return narration.map(({description}) => stripPeoplePlaces(description)).join("");
}

const loadTextBlockNarration = async (text_guid, lang) => {
    // bom_text -> bom_sectionrow -> bom_narration
    const sql = `SELECT bn.guid, description
    FROM bom_narration bn
    JOIN bom_text bt ON bt.parent = bn.guid
    WHERE bt.guid = "${text_guid}";`;


    const narration = await loadTranslations(lang, await queryDB(sql));
    return narration.map(({description}) => stripPeoplePlaces(description)).join(" • ");
}


    


const loadSectionContext = async (text_guid,lang) => {

    const sectionTitleSQL = `SELECT bs.guid, title
    FROM bom_section bs
    JOIN bom_text bt ON bs.guid = bt.section
    WHERE bt.guid = "${text_guid}";`;
    const sectionTitle = await loadTranslations(lang, await queryDB(sectionTitleSQL));

    const sectionNarrationSQL = `SELECT bn.guid, description
    FROM bom_section bs
    JOIN bom_sectionrow bsr ON bs.guid = bsr.parent
    JOIN bom_narration bn ON bsr.guid = bn.parent
    JOIN bom_text bt ON bs.guid = bt.section
    WHERE bt.guid = "${text_guid}";`;
    const sectionNarration = await queryDB(sectionNarrationSQL);


    const {people, places} = extractPeoplePlaceIds(sectionNarration.map(({description}) => description).join(" "));

    const translatedNarration = await loadTranslations(lang, sectionNarration, "guid");

    return {
        title: sectionTitle?.[0]?.title,
        narration: translatedNarration.map(({description}) => stripPeoplePlaces(description)).join(" "),
        people: await loadPeople(people,lang),
        places: await loadPlaces(places,lang)
    }


    

};

const loadCommentary = async (verse_ids) => {
    const sql = `
      SELECT s.source_name name, s.source_title book, c.title title, s.source_year year, c.text
      FROM bom_xtras_commentary c
      JOIN bom_xtras_source s ON c.source = s.source_id
      WHERE s.source_lang = "en" AND c.verse_id IN (?)
    `;

    if(!verse_ids?.length) return [];

    const params = [verse_ids]; 

    try {
        const commentary = await Promise.race([
            queryDB([sql, params]),
            new Promise((_, reject) => setTimeout(reject, 10000))
        ]);

        return commentary.map(({name, book, title, year, text}) => 
            ({name, book, title, year, text: stripHTMLTags(text)}));
    } catch (error) {
        logger.error(`Error: ${error}`);
        logger.error(`SQL: ${sql}`);
        logger.error({verse_ids});
        return [];
    }
}

  
const loadCrossReferences = async (verse_ids, lang) => {
    let sql;
    
    if(lang && lang !== 'en') {

        sql = `SELECT v.verse_id as verse_id, t.text as text 
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
        sql = `SELECT verse_id, verse_scripture text 
        FROM lds_scriptures_verses 
        WHERE verse_id IN 
        (SELECT distinct dst_verse_id FROM lds_scriptures_crossref
        WHERE src_verse_id IN (${verse_ids.join(",")})
        AND type = "xref" and significant = 0
        ORDER BY dst_verse_id) 
        ORDER BY verse_id;`;
    } 
    
    
    const crossReferences = await queryDB(sql);
    //TODO: Group contiguous references
    return crossReferences.map(({verse_id,text}) => ({ref:generateReference(verse_id), text}));

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