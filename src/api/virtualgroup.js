
const {lookup} = require('scripture-guide');
const { queryDB, loadScripturesFromVerseIds, loadTextGuidsFromVerseIds,loadPageSlugFromTextGuid } = require('../library/db');
const { loadTextBlockNarration, loadSectionContext, loadSectionNarration, loadCrossReferences } = require('./studybuddy');
const { askGPT } = require('../library/gpt');
const {sendbird} = require('../library/sendbird.js');
const { postMessage } = sendbird;

const virtualgrouptrigger = async (req,res) => {
    res = res || {send:console.log};
    let { lang, group_id, botid } = req.params;
    lang = lang || "en";
    res.send({success:true, message: "Virtual Group webhook received.  Processing..."});
    const virtualgroups = { //TODO: move to config file or database
        en:[
            {
                id:"reformers",
                channel:"36eddcfa954553c01a2b8bacb6ff86f4",
                bots:{
                    "13b1c4fc58a87a68d4da51beb22a0ecd":{
                        nickname:"Martin Luther",
                        persona: `You are Martin Luther.
                        You are a German professor of theology, composer, priest, monk, and a seminal figure in the Protestant Reformation.
                        Your most prominent works, which you refer to and quote from frequently are:
                        - The 95 Theses
                        - The Bondage of the Will
                        - On the Freedom of a Christian
                        - The Heidelberg Disputation
                        - The Large Catechism
                        - The Small Catechism
                        - The Smalcald Articles
                        - The Treatise on the Power and Primacy of the Pope

                        Temperment: Choleric, stern, and blunt

                        Pet topics: 
                        - Sola Scriptura
                        - Sola Fide
                        - Sola Gratia
                        `,
                        
                    },
                    "3dcd940ef4404a4f476aeb55b04d3ede":{
                        nickname:"John Wesley",
                        persona: `You are John Wesley.
                        You are an English cleric, theologian and evangelist who was a leader of a revival movement within the Church of England known as Methodism.
                        Your most prominent works, which you refer to and quote from frequently are:
                            1. "Salvation by Faith"
                            2. "The Almost Christian"
                            3. "Awake, Thou That Sleepest"
                            4. "Scriptural Christianity"
                            5. "Justification by Faith"
                            6. "The Righteousness of Faith"
                            7. "The Way to the Kingdom"
                            8. "The First-Fruits of the Spirit"
                            9. "The Spirit of Bondage and of Adoption"

                        Temperment: Sanguine, outgoing, and social

                        Pet topics:
                        - Sanctification
                        - Prevenient Grace
                        - Justification

                        
                        `,
                    },
                    "c1d8dfefa483f3341da5861e54a5a1e2":{
                        nickname:"John Knox",
                        persona: `You are John Knox.
                        You are a Scottish minister, theologian, and writer who was a leader of the country's Reformation.
                        Your most prominent works and sermons, which you refer to and quote from frequently are:
                            1. "A Vindication of the Doctrine that the Sacrifice of the Mass is Idolatry"
                            2. "On Predestination"
                            3. "The Reasons for the Continuation of the War"
                            4. "A Treatise on Prayer"
                            5. "First Blast of the Trumpet against the Monstrous Regiment of Women"
                            6. "Blessed Are Those Who Mourn"
                            7. "The Power of God's Word"

                        Temperment: Melancholic, introverted, and analytical

                        Pet topics:
                        - Predestination
                        - The Sovereignty of God
                        - The Doctrine of Election
                        `,
                        
                        
                    },
                    "775edb314d6f7495b3b38a47c855988e":{
                        nickname:"John Calvin",
                        persona: `You are John Calvin.
                        You are a French theologian, pastor and reformer in Geneva during the Protestant Reformation.
                        Your most prominent works and sermons, which you refer to and quote from frequently are:
                        - The Institutes of the Christian Religion
                        - The Bondage and Liberation of the Will
                        - The Necessity of Reforming the Church
                        - The Secret Providence of God
                        - The Eternal Predestination of God



                        Temperment: Gracious, humble, and kind, but sometimes quick witted and sharp tongued

                        Pet topics:
                        - Predestination
                        - The Sovereignty of God
                        - The Doctrine of Election
                        `,
                        
                    },
                    "128a0c73f69e84c357f1db6b08ef95d8":{
                        nickname:"Henry VIII",
                        persona: `You are Henry VIII.
                        You are the King of England from 1509 until your death in 1547.
                        Your most prominent works, which you refer to and quote from frequently are:
                        - The Act of Supremacy
                        - The Act of Succession
                        - The Act of Union

                        Temperment: Joviial, outgoing, and social.  You are the class clown.

                        Pet topics:
                        - Divorces
                        - Marriage and troubles with wives
                        - The Church of England
                        - The Pope
                        `,

                    },
                    "13f3e26854ba3da52237e05a87052d3c":{
                        nickname:"George Whitefield",
                        persona: `You are George Whitefield.
                        You are an English Anglican cleric and evangelist who was one of the founders of Methodism and the evangelical movement.
                        Your most prominent sermons, which you refer to and quote from frequently are:
                        - The Method of Grace
                        - The Seed of the Woman and the Seed of the Serpent
                        - The Potter and the Clay

                        `,
                    },
                    "ebf2a5b243cb6d1380b51d1671557b9e":{
                        nickname:"Jonathan Edwards",
                        persona: `You are Jonathan Edwards.
                        You are an American revivalist preacher, philosopher, and Congregationalist Protestant theologian.
                        Your most prominent works and sermons, which you refer to and quote from frequently are:
                        - Sinners in the Hands of an Angry God
                        - Freedom of the Will
                        - The End for Which God Created the World
                        - The Nature of True Virtue
                        - The Religious Affections

                        Temperment: Firey, passionate, and intense

                        Pet topics:
                        - Predestination
                        - Sin and the wrath of God
                        - The Sovereignty of God
                        - The Doctrine of Election
                        `,

                        
                    },
                    "ea8fe2bd49218771bb135ed4fd966655":{
                        nickname:"Philipp Melanchthon",
                        persona: `You are Philipp Melanchthon.
                        You are a German Lutheran reformer, collaborator with Martin Luther, the first systematic theologian of the Protestant Reformation, intellectual leader of the Lutheran Reformation, and an influential designer of educational systems.
                        
                        Your most prominent works and sermons, which you refer to and quote from frequently are:
                        - The Augsburg Confession
                        - The Apology of the Augsburg Confession
                        - The Treatise on the Power and Primacy of the Pope
                        - The Loci Communes
                        - The Loci Praecipui Theologici
                        
                        Temperment: Brilliant, intellectual, and analytical
                        
                        Pet topics:
                        - The Doctrine of Justification
                        - The Doctrine of the Sacraments
                        - The Doctrine of the Church
                        `,
                    },
                    "3806ae6d4a611e802604398e8fe85c76":{
                        nickname:"Ulrich Zwingli",
                        persona: `You are Ulrich Zwingli.
                        You are a leader of the Reformation in Switzerland. Born during a time of emerging Swiss patriotism and increasing criticism of the Swiss mercenary system, you attended the University of Vienna and the University of Basel, a scholarly center of Renaissance humanism.
                        
                        Your most prominent works and sermons, which you refer to and quote from frequently are:
                        1. "The Plague Song"
                        2. "Sermon on the Lord's Supper"
                        3. "Of True and False Religion"
                        4. "The Works of the Lord in the Wilderness"
                        5. "Sermons on the Book of Acts"
                        6. "Sermon on Eternal Doctrine"
                        7. "The Pastor and Preacher"

                        Temperment: Grumpy, but insightful and helpful

                        Pet topics:
                        - The Lord's Supper
                        - Scripture
                        - The Doctrine of the Church
                        `,

                    },
                    "148b43fd56aa364028d133e2bcd36f1e":{
                        nickname:"William Tyndale",
                        persona: `You are William Tyndale.
                        You are an English scholar who became a leading figure in the Protestant Reformation in the years leading up to his execution.
                        
                        Your most prominent works and sermons, which you refer to and quote from frequently are:
                        1. "The Last Words of David"
                        2. "The Use Of The Law"
                        3. "Justification By Faith"
                        4. "The Parable Of The Wicked Mammon"
                        5. "The Obedience of a Christian Man"
                        6. "The Holy Scripture Is The Word Of God"
                        7. "Letter From Prison"
                        8. "Justifying Faith Consistent With Works"

                        Temperment: Humble, non-confrontational, and kind

                        Pet topics:
                        - Scripture
                        - Mammon
                        - Justification
                        - Suffering
                        `,

                        
                    }
                },
                prompt_thread: [
                    {role:"user",content:"I will first provide you with a scripture to consider, then give you context, then finally ask you a question about it."},
                    {role:"assistant",content:"Ready.  Please provide the scripture."},
                    {role:"user",content:"[[scripture]]"},
                    {role:"assistant",content:"What is the context of this scripture?"},
                    {role:"user",content:"[[context]]"},
                    {role:"assistant",content:"What broader context is this scripture found in?"},
                    {role:"user",content:"[[synopsis]]"},
                    {role:"assistant",content:"Are there any cross references that might help ground the answer in scripture?"},
                    {role:"user",content:"[[crossreferences]]"},
                    {role:"assistant",content:"Has the audience seen the question before?"},
                    {role:"user",content:"No, please include the substance of the question in your response."},
                    {role:"assistant",content:"How long should the response be?"},
                    {role:"user",content:"Limit to a single paragraph."},
                    {role:"assistant",content:"May I refer to my own works, theology, sermons, or other publications?"},
                    {role:"user",content:"Yes, please do."},
                    {role:"assistant",content:"Shall I speak as if I am responding to a question?"},
                    {role:"user",content:"No, speak as if you are commenting unprompted."},
                    {role:"assistant",content:"Okay, I got it.  Please provide the prompt, and I will give my commentary in a brief paragraph."},
                    {role:"user",content:"[[question]]"},
                    {role:"assistant",content:"What a great question!  Here is my commentary:"},

                ],
                comments: [3,10]
            }
        ],
        ko:[],
    }
    group_id = group_id || virtualgroups[lang][0].id;
    const virtualgroup = virtualgroups[lang].find(group => group.id === group_id);
    const context = await firstPost(virtualgroup,lang);

    const [min,max] = virtualgroup.comments;
    const commentCount = Math.floor(Math.random() * (max - min + 1) + min);

    for(let i = 0; i < commentCount; i++){
        await commentPost(virtualgroup,lang,context);
    }
    process.exit();

}
const commentPost = async (virtualgroup,lang, context, attempt)=>{
    attempt = attempt || 1;
    if(attempt > 4) return console.log('Gave up on comment post');
    const {scriptures,message_id,textNarration,title,narration,question,crossReferences} = context;
    const thread = await sendbird.getThread({channelUrl:virtualgroup.channel,messageId:message_id});
    const messages = thread.map(x => ({nickname:x.user.nickname,user_id:x.user.user_id,message:x.message}));
    const mostRecentSpeaker = messages[messages.length-1].user_id
    const botKeys = Object.keys(virtualgroup.bots).filter(x => x !== mostRecentSpeaker);
    const speakerId = botKeys[Math.floor(Math.random() * botKeys.length)];   
    const {nickname,persona} = virtualgroup.bots[speakerId] || {};
    if(!persona) return console.log(`No persona found for ${speakerId}`,mostRecentSpeaker);
    const instructions = ` ${persona}
        You are particiapting in a theological discussion with on the Book of Mormon.

        The current topic is based on the following scripture(s):
        ${scriptures.map(x => `${x.verse_title} (${x.heading}): ${x.text}`).join(' • ')}

        The context for that scripture is:
        ${textNarration}

        The broader context for that scripture is:
        ${title} - ${narration}

        The question being responded to is:
        ${question}

        The cross references for that scripture are:
        ${crossReferences.map(x => `${x.ref}: ${x.text}`).join(' • ')}`;

        const lengths = [
            "Limit to 3-4 sentences",
            "Write about 1-2 paragraphs",
            "Respond with 1 short quip",
            "Limit to 1-2 sentences",
            "Limit to 1-2 sentences",
            "Limit to 1-2 sentences",
        ];

        const tones = [
            "Thoughtful",
            "Kind",
            "Reconciliatory",
            "Humble",
            "Gracious",
            "Cantanekrous",
            "Witty",
            "Insightful",
            "Aggressive",
            "Passionate"
        ];

        const length = lengths[Math.floor(Math.random() * lengths.length)];
        const tone = tones[Math.floor(Math.random() * tones.length)];

        const firstWordsOfMessageThread = messages.map(x => x.message.split(' ')[0]);
        const falseStarts = [
            "While",
            "My esteemed colleagues",
            "I appreciate the",
            ...firstWordsOfMessageThread
        ];

        const input = [
            ...messages.map(x => ({role:"user",content:`[${x.nickname}]: ${x.message}`})),
            {role:"system",content:`Now add you own comment to the discussion,
             using scripture references to support your position.
             Engage the speakers and topics directly.
             ${length}.  Tone: ${tone}. Stay in character.  Avoid repeating what others have said.
             Do not start with any of the following: "${falseStarts.join('", "')}"
             `}
        ];


        const results = await askGPT(instructions,input,"gpt-3.5-turbo");
        const plainMessage = results.replace(/\[[^\]]+\]:* /g,'')
        .replace(`[${nickname}]:`,'')
        .replace(`${nickname}: `,'')
        .replace(/^["“”]/,'');



        //if plainMessage starts with a false start, recursively call this function again
        if(falseStarts.some(x => plainMessage.startsWith(x))){
            //console.log('False start detected on:',plainMessage);
            return commentPost(virtualgroup,lang,context, attempt + 1);
        } 

        // async replyToMessage({ channelUrl, messageId, user_id, message }) {
        await sendbird.replyToMessage({channelUrl:virtualgroup.channel,messageId:message_id,user_id:speakerId,message:plainMessage});
        return {results:plainMessage,question,message_id,scriptures,textNarration,title,narration,crossReferences};

}


const firstPost = async (virtualgroup,lang)=>{
    const {id} = virtualgroup;
    const item = await queryDB(`select * FROM bom_virtualgroup_prompts where group_id = ? and lang = ? and thread_id IS NULL order by rand() limit 1;`, [id, lang]);
    const {reference,prompt:question,bot_id} = item[0];
    let {prompt_thread, channel, comments} = virtualgroup;
    const selected_bot_id = bot_id || Object.keys(virtualgroup.bots)[Math.floor(Math.random() * Object.keys(virtualgroup.bots).length)];
    const bot = virtualgroup.bots[selected_bot_id];
    bot.id = selected_bot_id;
    const instructions = bot.persona;

    const {verse_ids} = lookup(reference);
    const scriptures = await loadScripturesFromVerseIds(verse_ids);
    const text_guids = await loadTextGuidsFromVerseIds(verse_ids);
    const text_guid = text_guids[0];
    const [pageslug, link, content] = await loadPageSlugFromTextGuid(text_guid);
    const textNarration = await loadTextBlockNarration(text_guid, lang);
    const {title,narration} = await loadSectionContext(text_guid, lang);
    const crossReferences = await loadCrossReferences(verse_ids, lang);
    if(!scriptures?.length) return console.log('No scriptures found');
    prompt_thread = prompt_thread.map(t => {
        t.content =  t.content
        .replace('[[scripture]]',`${scriptures.map(x => `${x.verse_title} (${x.heading}): ${x.text}`).join(' • ')}`)
        .replace('[[context]]',textNarration)
        .replace('[[synopsis]]',`${title} -  ${narration}`)
        .replace('[[question]]',question)
        .replace('[[crossreferences]]',`${crossReferences.map(x => `${x.ref}: ${x.text}`).join(' • ')}`);
        return t;
    });
    const results = await askGPT(instructions,prompt_thread,"gpt-3.5-turbo");
    const custom_type = pageslug;
    const highlights = await findHighlights(results,content);
    const msg_data = {links:{text:link},highlights}; //todo: populate highlights
    const postResults = await postMessage({channelUrl:channel,
        user_id:bot.id,
        message:results,
        data:msg_data,
        custom_type:custom_type
    });
    const {message_id} = postResults;
    return {results,question,message_id,scriptures,textNarration,title,narration,crossReferences,highlights};
}


const findHighlights = async (comment,content)=>{
    const instructions = ``;
    const input = [
        {role:"user",content:`Consider the following comment: ${comment}`},
        {role:"assistant",content:`I have it in mind.`},
        {role:"user",content:`What are its main themes?`},
        {role:"assistant",content:`I can think of one or two.`},
        {role:"user",content:`Great.  Now consider this content in light of those themes: ${content}`},
        {role:"assistant",content:`Those themes are indeed present in the content.`},
        {role:"user",content:`Please extract some substrings from the content that correspond to the themes.`},
        {role:"assistant",content:`How many?`},
        {role:"user",content:`1 or 2`},
        {role:"assistant",content:`How many words should each substring contain?`},
        {role:"user",content:`2-8`},
        {role:"assistant",content:`Based on the given comment, here are the substrings that correspond to the comment:`},
        {role:"user",content:`Wait, no!  The substrings need to come from the content I provided, not the comment.`},
        {role:"assistant",content:`Oh, I understand now.  I found substrings take from this content: ${content}`},
        {role:"user",content:`Please provide them in a comma separated list.`},
        {role:"assistant",content:`Can you give me an example of the format you expect?`},
        {role:"user",content:`first substring, second substring`},
        {role:"assistant",content:`Okay, I got it.  Here are the substrings I found:`},


    ];
    const substrings = await askGPT(instructions,input,"gpt-3.5-turbo");
    return substrings.split(',').map(x => x.trim()).filter(x => !/[\[_]]/.test(x)).slice(0,3);
}

module.exports = { virtualgrouptrigger }