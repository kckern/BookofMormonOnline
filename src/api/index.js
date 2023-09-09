const studyBuddy = require("./studybuddy");
const webhook = async (req, res) => {



    const studyBuddyId = "ddc26a0e41b6daffff542e9fe8d9171d";
    const {channel, members, sender, payload, parent_message_id, category, type} = req.body;
    const {message_id} = payload;
    const studyBuddyIsMember = members.find(({user_id})=>user_id===studyBuddyId);
    const studyBuddyIsSender = sender?.user_id===studyBuddyId;

    if(studyBuddyIsMember && !studyBuddyIsSender)
    {
        const messageId = parent_message_id || message_id;
        const channelUrl = channel?.channel_url;
        console.log("[STUDYBUDDY]");
        console.log({category, type, messageId,channelUrl});

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