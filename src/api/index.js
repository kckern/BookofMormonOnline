const studyBuddy = require("./studybuddy");
const webhook = async (req, res) => {



    const studyBuddyIds = ["ddc26a0e41b6daffff542e9fe8d9171d","d9b0b9b0a4b6daffff542e9fe8d9171d"];
    const {channel, members, sender, payload, parent_message_id} = req.body;
    const {message_id} = payload || {};
    const studyBuddyIsMember = members?.some(member=>studyBuddyIds.includes(member?.user_id));
    const studyBuddyIsSender = sender?.user_id && studyBuddyIds.includes(sender?.user_id);
    const messageId = parent_message_id || message_id;
    const channelUrl = channel?.channel_url;


    console.log(`WH-DEBUG:" ${channelUrl} ${message_id} ${JSON.stringify({studyBuddyIsMember, studyBuddyIsSender, members})}`);

    if((studyBuddyIsMember && !studyBuddyIsSender))
    {
        res.json({success:true, message: "StudyBuddy webhook received.  Processing..."});
        await studyBuddy(channelUrl, messageId); // dont await
        return 
    }
    


}


const apis = {
    "webhook":webhook,
    "studybuddy":studyBuddy
}
module.exports = {apis};