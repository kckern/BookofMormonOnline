
const {studyBuddy, studyBuddyTextBlock} = require("./studybuddy");
const logger = require("../library/utils/logger.cjs");
const { mapMarker } = require("./mapmarkers");
const { virtualgrouptrigger } = require("./virtualgroup");
const { translate } = require("./translate");
const webhook = async (req, res) => {
    
    logger.info(`Webhook received: ${JSON.stringify(req.body)}`); // "info" is the log level

    const {category, channel, members, sender, payload, parent_message_id,type,trigger} = req.body;
    if(trigger==="study_group_bots") return virtualgrouptrigger(req,res);
    const messageContent = payload?.message;


    //ignore admin  message
    if(type!=="MESG") return res.json({success:true, message: "Not a normal message event"});
    if(category!=="group_channel:message_send") return res.json({success:true, message: "Not a message send event"});
    const {message_id, message} = payload || {};
    if(!message && !parent_message_id) return res.json({success:true, message: "No message found in payload"});

    const studyBuddyIds = [
        "ddc26a0e41b6daffff542e9fe8d9171d",   // english
        "938e2c5ac2c938b8156a7faf9ef9465f",  // korean
        "5bddebc6f6d86290a99a87fd5d72d6c7", // french
        "20a1fe8595f749c00462f907b8276031", // german
        "ed8caa04d5e38b7f1139d69b35899e51", // vietnamese
        "1893bd0d165e2cd28329d7750307785a", // tagalog
    ]

    const studyBuddyIsMember = members?.some(member=>studyBuddyIds.includes(member?.user_id));
    const studyBuddyIsSender = sender?.user_id && studyBuddyIds.includes(sender?.user_id);
    const messageId = parent_message_id || message_id;
    const channelUrl = channel?.channel_url;

    if(!studyBuddyIsMember) {
        logger.info(`StudyBuddy webhook received.  Not a member of studybuddy. Channel: ${channelUrl}. Bot: ${studyBuddyIsSender}. Message: ${messageId}`);
        return res.json({success:true, message: "StudyBuddy webhook received.  Not a member of studybuddy"});
    }
    if((studyBuddyIsMember && !studyBuddyIsSender))
    {
        res.json({success:true, message: "StudyBuddy webhook received.  Processing..."});
        await studyBuddy(channelUrl, messageId, messageContent); // dont await
        return 
    }
    return res.json({success:true, message: "StudyBuddy webhook received.  Ignoring.",debug:{
        studyBuddyIsMember,
        studyBuddyIsSender,
        messageId,
        channelUrl
    }});
}

const apis = {
    "webhook":webhook,
    "studybuddy": async (req,res) => res.json(await studyBuddyTextBlock({...req.body})),
    "translate": translate
}

const endpoints = {
    "mapmarker/:id":mapMarker,
}
module.exports = {apis,endpoints};