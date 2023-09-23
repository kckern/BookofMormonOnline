
const {studyBuddy, studyBuddyTextBlock} = require("./studybuddy");
const webhook = async (req, res) => {



    const {category, channel, members, sender, payload, parent_message_id} = req.body;
    if(category!=="group_channel:message_send") return res.json({success:true, message: "Not a message send event"});
    const {message_id, message} = payload || {};
    if(!message) return res.json({success:true, message: "No message found in payload"});

    const studyBuddyIds = ["ddc26a0e41b6daffff542e9fe8d9171d","938e2c5ac2c938b8156a7faf9ef9465f"];

    const studyBuddyIsMember = members?.some(member=>studyBuddyIds.includes(member?.user_id));
    const studyBuddyIsSender = sender?.user_id && studyBuddyIds.includes(sender?.user_id);
    const messageId = parent_message_id || message_id;
    const channelUrl = channel?.channel_url;


    if((studyBuddyIsMember && !studyBuddyIsSender))
    {
        res.json({success:true, message: "StudyBuddy webhook received.  Processing..."});
        await studyBuddy(channelUrl, messageId); // dont await
        return 
    }

}

const apis = {
    "webhook":webhook,
    "studybuddy": async (req,res) => res.json(await studyBuddyTextBlock({...req.body}))
}
module.exports = {apis};