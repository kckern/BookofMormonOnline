import { models as Models } from '../config/database';
import Sequelize, { Model } from 'sequelize';
import { completedGuids, getStandardizedValuesFromUserList } from './_common';
const { loadReadingPlan,loadReadingPlanSegment } = require('./lib')
import { sendbird } from '../library/sendbird';
import { url } from 'inspector';
import crypto from "crypto";
const Op = Sequelize.Op;

const md5 = (value: string)=>{
  if(!value) return "";
  if(/$[0-9a-f]{32}$/.test(value)) return value;
  return crypto.createHash('md5').update(value,'utf8').digest("hex");
}

const userIsChannelAdmin = async (user_id: string, channel_url: string) => {
  let group = await sendbird.loadChannel(channel_url);
  let matches = group.members.filter(u => u.user_id === user_id && u.role === 'operator');
  if (!matches.length) return false;
  return true;
}

const maskNickname = (nickname: String) => {

  //return first letter only
  if(nickname.length < 4) return nickname.charAt(0).toUpperCase()+"██";

  nickname = nickname.replace(/^(.{2}).*(.{2})$/,"$1████$2");
  nickname = nickname.charAt(0).toUpperCase() + nickname.slice(1);
  return nickname;

}

const maskUserPrivacy = (i: any) => {
    const pack = "personas";
    const user_id = i.user_id || md5(i.user);
    delete i.user_id;
    const maked_picture =  `https://api.dicebear.com/7.x/${pack}/svg?seed=${user_id}&eyes=open,sunglasses,wink,happy&facialHair=beardMustache,goatee&facialHairProbability=20&hair=bobCut,curly,long,pigtails,shortCombover,buzzcut,beanie&mouth=smile,smirk,bigSmile&nose=smallRound,mediumRound&skinColor=d78774,b16a5b,eeb4a4,92594b`
    const masked_nickname = maskNickname(i.nickname);

    if(i.public) return i;

    i.nickname = masked_nickname;
    i.picture = maked_picture;
    return i;
  }




const loadUserFromToken = async (token: string) => {
  let user: any = await Models.BomUser.findOne({
    raw: true,
    include: [
      {
        model: Models.BomUserToken,
        where: {
          token: token
        }
      }
    ]
  });
  return user;
}




export default {
  Query: {

    botlist: async (item: any, args: any, context: any, info: any) => {

      const lang = context.lang ? context.lang : null;
      const botUsers = await sendbird.listBotUsers(lang);
      return botUsers.map(u => {
        if(!u.user_id) return null;
        return {
          id: u.user_id,
          name: u.nickname || "Bot",
          description: u.metadata?.description || "A helpful bot",
          picture: u.profile_url || "https://i.imgur.com/IwVZGhY.png",
          enabled: !!u.metadata?.welcome
        }


      }).filter(u=>!!u);


    },



    leaderboard: async (item: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;

      let user: any = await Models.BomUser.findOne({
        raw: true,
        include: [
          {
            model: Models.BomUserToken,
            where: {
              token: args.token
            }
          }
        ]
      });

      const my_sb_user_id = md5(user?.user);

      const activeTimeFrame = Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60);
      const rankedUsers :any = await Models.BomUser.findAll({
        raw: true,
        attributes: ['user',[Sequelize.literal(`MD5(user)`), 'sbuser'],'name','last_active', 'complete'],
        where: { last_active: { [Op.gt]: activeTimeFrame}, zip: { [Op.ne]: -1}},
        order: [['complete', 'DESC']],
      });
      const topUsers = rankedUsers.slice(0,100);

      const recentFinishes:any = await Models.BomLog.findAll({
        raw: true,
        attributes: ['timestamp','user'],
        where: { type: 'finished'},
        order: [['timestamp', 'DESC']],
        limit: 10
      });
      const recentFinishersUsers :any = (await Models.BomUser.findAll({
        raw: true,
        attributes: ['user',[Sequelize.literal(`MD5(user)`), 'sbuser'],'name','finished'],
        where: { user: recentFinishes.map((u:any)=>u.user)},
      }));
      const recentFinishesWithUsers = recentFinishes.map((f:any)=>{
        const user = recentFinishersUsers.find((u:any)=>u.user===f.user);
        return {
          ...user,
          finished: f.timestamp
        }
      }).sort((a:any,b:any)=>b.finished-a.finished)
      .map((u:any)=>({...u,finished:[u.finished]}));


      const sbIds = [...topUsers,...recentFinishesWithUsers].map((u:any)=>u.sbuser);

      const sendbirdUserObjects = await sendbird.listUsers(sbIds);

      const publicUsers = await sendbird.getMembersofPublicGroups();
      const privateUsersVisibleToMe = my_sb_user_id ? await sendbird.getMembersofPrivateGroups(my_sb_user_id) : [];
      const visibleUsers = [...publicUsers,...privateUsersVisibleToMe];

      const currentProgress =  topUsers.map((u:any)=>{
        const sendbirdUserObject = sendbirdUserObjects.find((sbu:any)=>sbu.user_id===u.sbuser);
        return loadHomeUser(sendbirdUserObject,u,visibleUsers);
      }).filter((u:any)=>!!u).slice(0,50).map(maskUserPrivacy).sort((a:any,b:any)=>b.progress-a.progress)
      .filter((u:any)=>!u.isAdmin);

      const recentFinishers = recentFinishesWithUsers.map((u:any)=>{
        const sendbirdUserObject = sendbirdUserObjects.find((sbu:any)=>sbu.user_id===u.sbuser);
        return loadHomeUser(sendbirdUserObject,u,visibleUsers);
      }).map(maskUserPrivacy).filter((u:any)=>!u?.isAdmin);

      //console.log({currentProgress});
      return {
        recentFinishers,
        currentProgress,
      }


    },
    loadGroupsFromHash: async (item: any, args: any, context: any, info: any) => {
      //console.log("a")
      if (args.hash === undefined) return false;
      let shortLinks = await Models.BomShortlinks.findAll({ where: { hash: args.hash } });
      if (!shortLinks) return [];
      return shortLinks.map((shortLink: any) => {
        let channelUrl = shortLink.getDataValue('string');
        return loadGroupFromChannelId(channelUrl) || {};
      });
    },

    studygrouphistory: async (item: any, args: any, context: any, info: any) => {
      let textMax = 3520;
      const userToken = args.token;
      const studyGroupID = args.studyGroupID;
      const userList = ['tytus', 'kckern'];
      //lookup the group with sendbird, check public/private

      //lookup the user via token

      //check if the user is in the group

      //deny if no

      //Load logs of all the users in the group

      let standardizedValues = await getStandardizedValuesFromUserList(userList);

      //Prepare output object
      return {
        studyGroupID: studyGroupID,
        studyGroupName: 'My Group',
        dates: standardizedValues.map((item: any) => item.date),
        userHistories: userList.map((username: string) => ({
          user: username,
          progress: standardizedValues.map((item: any) => Math.round((item.progress[username] * 1000) / textMax) / 10)
        }))
      };
    },

    homegroups: async (item: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      
      let user: any = await Models.BomUser.findOne({
        raw: true,
        include: [
          {
            model: Models.BomUserToken,
            where: {
              token: args.token
            }
          }
        ]
      });

      let featuredSBGroups = await getFeaturedGroups(lang);

      let myHomeGroups = [];
      if (user) {
        //console.log(user);
        const bom_username = user.user;
        const my_sb_user_id = md5(bom_username);

        let mySBGroups = await sendbird.getMyGroups({ user_id: my_sb_user_id });
        myHomeGroups = await mySBGroups.map(g => loadGroup(g, 'my_groups'));
      }
      let featuredHomeGroups = await featuredSBGroups.map(g => loadGroup(g, 'featured_groups'));

      return mixGroups({ myHomeGroups, featuredHomeGroups, grouping:args.grouping });
    },
    postcomments: async (item: any, args: any, context: any, info: any) => {
      return [];
    },
    moregroups: async (item: any, args: any, context: any, info: any) => {
      return [];
    },
    homethread: async (item: any, args: any, context: any, info: any) => {
      let group = await sendbird.getGroup(args.channel);
      if (group.custom_type === 'private') {
        if (args.token) {
          let user: any = await Models.BomUser.findOne({
            raw: true,
            include: [
              {
                model: Models.BomUserToken,
                where: {
                  token: args.token
                }
              }
            ]
          });
          const bom_username = user.user;
          const my_sb_user_id = md5(bom_username);
          let mySBGroups = await sendbird.getMyGroups({ user_id: my_sb_user_id });
          let group = mySBGroups.filter(g => g.channel_url === args.channel);
          if (!group) return [];
        } else {
          return [];
        }
      }

      let thread = await sendbird.getThread({ channelUrl: args.channel, messageId: args.message });

      return thread.map(t => loadHomeItem(t));
    },
    homefeed: async (item: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      let user: any = await Models.BomUser.findOne({
        raw: true,
        include: [
          {
            model: Models.BomUserToken,
            where: {
              token: args.token
            }
          }
        ]
      });
      const my_sb_user_id = md5(user?.user);

      let groupUrls = [];
      let groupObjects = [];
      if (args.channel) {
        groupUrls = [args.channel];
        let group = await sendbird.getGroup(args.channel);

        if (group.custom_type === 'private') {
          let members = await sendbird.getMembers(args.channel);
          members = members.map(u => u.user_id);
          let found = members.includes(my_sb_user_id); //members?.map((m=>m.user_id).include(user_id) || false;
          if (!found)
            return {
              groups: [],
              feed: []
            };
        }
        group = await loadGroup(group, 'feed');
        groupObjects = [group];

        if (args.message) {
          let message = await loadMessage(args.channel, args.message);
          if(message.parent) message = await loadMessage(args.channel, message.parent);
          return {
            groups: groupObjects,
            feed: [message]
          };
        }
      } else {
        let groupObjects = await getFeaturedGroups(lang);
        groupUrls = groupObjects.map(c => c.channel_url);
        let resolveMe = [];
        for (let i in groupObjects) {
          resolveMe.push(loadGroup(groupObjects[i], 'feed'));
        }

        let groupsMessages = [];
        for (let i in groupUrls) {
          groupsMessages.push(sendbird.getGroupMessages(groupUrls[i]));
        }

        if (my_sb_user_id) {
          let myGroupObjects = await sendbird.getMyGroups({  user_id:my_sb_user_id });
          let myGroupUrls = myGroupObjects.map(c => c.channel_url);
          for (let i in myGroupObjects) {
            if (groupUrls.includes(myGroupObjects[i].channel_url)) continue;
            resolveMe.push(loadGroup(myGroupObjects[i], 'feed'));
          }
          for (let i in myGroupUrls) {
            if (groupUrls.includes(myGroupUrls[i])) continue;
            groupsMessages.push(sendbird.getGroupMessages(myGroupUrls[i]));
          }
          groupObjects = [...groupObjects, ...myGroupObjects];
        }

        groupObjects = await Promise.all(resolveMe);

        groupsMessages = await Promise.all(groupsMessages);
        let feed = feedAlgorithm(groupsMessages,my_sb_user_id);
        let returnme = {
          groups: groupObjects,
          feed: feed
        };
        return returnme;
      }
      let groupsMessages = [];
      for (let i in groupUrls) {
        groupsMessages.push(sendbird.getGroupMessages(groupUrls[i]));
      }
      groupsMessages = await Promise.all(groupsMessages);
      let feed = feedAlgorithm(groupsMessages,my_sb_user_id);
      let returnme = {
        groups: groupObjects,
        feed: feed
      };
      return returnme;
    },
    requestedUsers: async (item: any, args: any, context: any, info: any) => {
      if (!args.token) return [];
      if (!args.channel) return [];
      let user: any = await Models.BomUser.findOne({
        include: [
          {
            model: Models.BomUserToken,
            where: {
              token: args.token
            }
          }
        ]
      });
      if (!user) return [];
      const bom_username = user.user;
      const my_sb_user_id = md5(bom_username);
      let group = await sendbird.loadChannel(args.channel);
      let me = group.members.filter(u => u.user_id === my_sb_user_id && u.role === 'operator');
      if (!me.length) return [];
      group = await loadGroup(group, 'admin');
      let userIds = group.requests;
      return sendbird.listUsers(userIds).then(data=>data.map(sbUser => loadHomeUser(sbUser)));
    },
    //  readingplan(token:String, slug:String): ReadingPlan
    readingplan: async (item: any, args: any, context: any, info: any) => {
      if (!args.token) return [];
      if (!args.slug) return [];
      const lang = context.lang ? context.lang : null;
      let user: any = await Models.BomUser.findOne({
        include: [
          {
            model: Models.BomUserToken,
            where: {
              token: args.token
            }
          }
        ]
      });
      const queryBy = user?.user || args.token;
      const userInfo = {queryBy, lastcompleted: user?.lastcompleted || 0};
      return await loadReadingPlan(args.slug, userInfo,lang);

    },
    readingplansegment: async (item: any, args: any, context: any, info: any) => {
      const token = args.token;
      const guid = args.guid;
      if (!token || !guid) return [];
      const lang = context.lang ? context.lang : null;
      let user: any = await Models.BomUser.findOne({
        include: [
          {
            model: Models.BomUserToken,
            where: {
              token: token
            }
          }
        ]
      });
      const queryBy = user?.user || token;
      return await loadReadingPlanSegment(guid, queryBy, lang);
    }
  },
  Mutation: {
    addBot: async (item: any, args: any, context: any, info: any) => {
      const {token,channel,bot} = args;
      const user = await loadUserFromToken(token);
      if(!user) return false;
      const sbid = md5(user.user);
      const isChannelAdmin = await userIsChannelAdmin(sbid,channel);
      if(!isChannelAdmin) return false;
      const success = await sendbird.addUserToChannel(channel,bot);
      console.log({success});
      if(!success) return false;
      return true;

    },
    removeBot: async (item: any, args: any, context: any, info: any) => {
      const {token,channel,bot} = args;
      const user = await loadUserFromToken(token);
      if(!user) return false;
      const sbid = md5(user.user);
      const isChannelAdmin = await userIsChannelAdmin(sbid,channel);
      if(!isChannelAdmin) return false;
      const success = await sendbird.removeUserFromChannel(channel,bot);
      if(!success) return false;
      return true;
    },
    joinGroup: async (item: any, args: any, context: any, info: any) => {
      if (args.hash === undefined) return false;
      if (args.token === undefined) return false;

      let user: any = await Models.BomUser.findOne({
        include: [
          {
            model: Models.BomUserToken,
            where: {
              token: args.token
            }
          }
        ]
      });

      if (!user) return { isSuccess: false, msg: 'User not found' };
      let username = user.getDataValue('user');
      let sb_user_id = md5(username);
      let groupId: any = await ((await Models.BomShortlinks.findByPk(args.hash)) as any).getDataValue('string');

      if (!groupId) return { isSuccess: false, msg: 'Group not found' };
      let success = sendbird.addUserToChannel(groupId, sb_user_id)

      if (!success) return { isSuccess: false, msg: 'Failed to join group', channel: groupId, user: sb_user_id };
      return { isSuccess: true, msg: 'Joined group', channel: groupId, user: sb_user_id };

    },
    joinOpenGroup: async (item: any, args: any, context: any, info: any) => {
      if (args.url === undefined) return { isSuccess: false, msg: 'Group not found' };
      if (args.token === undefined) return { isSuccess: false, msg: 'User token missing' };

      let user: any = await Models.BomUser.findOne({
        include: [
          {
            model: Models.BomUserToken,
            where: {
              token: args.token
            }
          }
        ]
      });
      if (!user) return { isSuccess: false, msg: 'User not found' };
      let bom_username = user.getDataValue('user');
      const my_sb_user_id = md5(bom_username);
      let groupId = args.url;
      let group = await sendbird.loadChannel(groupId);
      if (group.custom_type !== 'open') return { isSuccess: false, msg: 'Group is not open enrollment' };
      return sendbird.invite(groupId, my_sb_user_id);
    },
    requestToJoinGroup: async (item: any, args: any, context: any, info: any) => {
      if (args.url === undefined) return { isSuccess: false, msg: 'Group not found' };
      if (args.token === undefined) return { isSuccess: false, msg: 'User token missing' };

      let user: any = await Models.BomUser.findOne({
        include: [
          {
            model: Models.BomUserToken,
            where: {
              token: args.token
            }
          }
        ]
      });
      if (!user) return { isSuccess: false, msg: 'User not found' };
      let bom_username = user.getDataValue('user');
      const my_sb_user_id = md5(bom_username);
      let groupId = args.url;
      let group = await sendbird.loadChannel(groupId);
      if (group.custom_type !== 'public') return { isSuccess: false, msg: 'Group is not public' };
      return sendbird.request(group, my_sb_user_id);
    },
    withdrawRequest: async (item: any, args: any, context: any, info: any) => {
      if (args.url === undefined) return { isSuccess: false, msg: 'Group not found' };
      if (args.token === undefined) return { isSuccess: false, msg: 'User token missing' };

      let user: any = await Models.BomUser.findOne({
        include: [
          {
            model: Models.BomUserToken,
            where: {
              token: args.token
            }
          }
        ]
      });
      if (!user) return { isSuccess: false, msg: 'User not found' };
      let bom_username = user.getDataValue('user');
      const my_sb_user_id = md5(bom_username);
      let groupId = args.url;
      let group = await sendbird.loadChannel(groupId);
      if (group.custom_type !== 'public') return { isSuccess: false, msg: 'Group is not public' };
      return sendbird.withdraw(group, my_sb_user_id);
    },

    processRequest: async (item: any, args: any, context: any, info: any) => {
      let {token,channel,user_id,grant} = args;
      if(!token || !channel || !user_id) return false;
      let user: any = await Models.BomUser.findOne({
        include: [
          {
            model: Models.BomUserToken,
            where: {
              token: args.token
            }
          }
        ]
      });
      if (!user) return false;
      let group = await sendbird.loadChannel(channel);
      const bom_username = user.user;
      const my_sb_user_id = md5(bom_username);
      let me = group.members.filter(u => u.user_id === my_sb_user_id && u.role === 'operator');
      if (!me.length) return false;
      let i = null;
      if(grant) i = await sendbird.addUserToChannel(channel,user_id);
      if(!i) return false;
      await sendbird.withdraw(group,my_sb_user_id);
      return true;

    }
  },
  StudyGroupHistory: {}
};

async function loadGroupFromChannelId(channelId: string) {
  if (!channelId) return {};
  let group = await sendbird.loadChannel(channelId);
  return group || {};
}



function loadHomeUser(sbuser, user:any={}, publicUsers = []) {

  const user_id = sbuser?.user_id || md5(user?.user);
  const picture =  sbuser?.profile_url ||  `https://api.dicebear.com/7.x/personas/svg?seed=${user_id}&eyes=open,sunglasses,wink,happy&facialHair=beardMustache,goatee&facialHairProbability=20&hair=bobCut,curly,long,pigtails,shortCombover,buzzcut,beanie&mouth=smile,smirk,bigSmile&nose=smallRound,mediumRound&skinColor=d78774,b16a5b,eeb4a4,92594b`;
 // console.log({sbuser});
  if(user.finished && !Array.isArray(user.finished)) user.finished = [user.finished];
  if(!sbuser?.metadata) return {
    user_id,
    nickname:  user?.name || user?.user || "User",
    picture,
    progress: parseFloat(user?.complete) || 0,
    finished: user.finished || [],
    lastseen: user.last_active,
    nonSocial:true,
    isAdmin: false,
    public: false,
    isBot: false,
  }


  let summary = { completed: 0, finished: [] };
  let bookmark = { latest:0, slug: null, pagetitle: null, heading: null };
  try {
    summary = JSON.parse(sbuser?.metadata?.summary);
    bookmark = JSON.parse(sbuser?.metadata?.bookmark);
  } catch (e) {}

  const isBot = !!sbuser?.metadata?.isBot || /🟢/.test(sbuser?.nickname);
  if(isBot) sbuser.nickname = sbuser?.nickname.replace(/🟢/g,"").trim();
  return {
    user_id: sbuser?.user_id,
    nickname: sbuser?.nickname,
    picture: sbuser?.profile_url,
    progress: summary?.completed || 0,
    finished: user?.finished || summary?.finished || [],
    lastseen: bookmark?.latest || 0,
    laststudied: bookmark?.heading  ? `${bookmark?.heading} (${bookmark?.pagetitle})` : null,
    bookmark: bookmark?.slug || null,
    isAdmin: !!sbuser?.metadata?.isAdmin,
    public: !!publicUsers.includes(sbuser?.user_id) || null,
    isBot
  };
}

async function loadGroup(sbGroupData, type) {
  let sbLatestMsg = await sendbird.getLatestMessage(sbGroupData.channel_url);
  let description = sbGroupData.data;
  let requests = [];
  try {
    let tmp = JSON.parse(description);
    description = tmp.description;
    requests = tmp.requests;
  } catch (e) {}
  return {
    url: sbGroupData.channel_url,
    name: sbGroupData.name,
    description: description,
    privacy: sbGroupData.custom_type,
    grouping: type,
    picture: sbGroupData.cover_url,
    latest: loadHomeItem(sbLatestMsg),
    requests: requests,
    members: sendbird.getMembers(sbGroupData.channel_url).then(m => m.map(u => loadHomeUser(u)))
  };
}

async function loadMessage(channel_url, message_id) {
  let sbMsg = await sendbird.getGroupMessageById(channel_url, message_id);
  return loadHomeItem(sbMsg);
}

function loadHomeItem(sbMsg) {
  let user = loadHomeUser(sbMsg.user);
  const pageSlug = sbMsg.custom_type;
  let data = { links: {}, highlights: [] };
  try {
    data = JSON.parse(sbMsg.data);
  } catch (e) {}

  let key = Object.keys(data?.links || [])?.shift();
  let val = Object.values(data?.links || [])?.shift();
  if (['text', 'section', 'fax'].includes(key)) val = `${pageSlug}/${val}`;
  let highlights = data?.highlights || null;

  let repliers = sbMsg.thread_info?.most_replies || [];
  let replycount = sbMsg.thread_info?.reply_count || 0;

  repliers.map(r => loadHomeUser(r));

  let likes = sbMsg.reactions?.shift()?.user_ids || [];
  
  return {
    channel_url: sbMsg.channel_url,
    id: sbMsg.message_id,
    timestamp: sbMsg.created_at,
    msg: sbMsg.message,
    user: user,
    mentioned_users: [],
    likes: likes,
    replycount: replycount,
    repliers: repliers,
    link: { key, val },
    highlights: highlights,
    parent: sbMsg.root_message_id
  };
}

async function mixGroups({ myHomeGroups, featuredHomeGroups, grouping }) {
  const max = (grouping) ? 60 : 6;

  myHomeGroups = await Promise.all(myHomeGroups.map(reflect));
  myHomeGroups = myHomeGroups.sort((a, b) => (b.latest.timestamp || 0) - (a.latest.timestamp || 0));
  featuredHomeGroups = await Promise.all(featuredHomeGroups.map(reflect));
  featuredHomeGroups = featuredHomeGroups.sort((a, b) => (b.latest.timestamp || 0) - (a.latest.timestamp || 0));

  let featuredToKeep = max - myHomeGroups.slice(0, max / 2).length;
  featuredHomeGroups = featuredHomeGroups.filter(g => !myHomeGroups.map(g => g.url).includes(g.url)).slice(0, featuredToKeep);

  let homeToKeep = max - featuredHomeGroups.length;
  myHomeGroups = myHomeGroups.slice(0, homeToKeep);
  if(grouping==="featured_groups") return featuredHomeGroups;
  if(grouping==="my_groups") return myHomeGroups;

  let mixed = [...myHomeGroups, ...featuredHomeGroups];
  return mixed;
}

function reflect(promise) {
  return promise.then(
    function(v) {
      return v;
    },
    function(e) {
      return null;
    }
  );
}

async function getFeaturedGroups(lang, limit = 20) {
  if (lang === 'dev' || !lang) lang = 'en';
  let isdefaultLang = lang==="en";
  let whereCondition =  { lang:  isdefaultLang ? { [Op.or]: [lang, 'en'] } : lang };
  let recentUsers: any = await Models.BomUser.findAll({
    raw: true,
    attributes: ['user'],
    where: whereCondition,
    order: [['last_active', 'desc']],
    limit
  })

  recentUsers = recentUsers.map(u => md5(u.user));

  const virtualUsers = await sendbird.getVirtualUsers();
  recentUsers = [...virtualUsers, recentUsers];

  const groups =  await sendbird.getOthersGroups(
    recentUsers,
    lang || "en"
  );

  if(!groups || !groups?.length && !["en","dev"].includes(lang)) return await getFeaturedGroups("en", 50);
  return groups;

}

function feedAlgorithm(messagesArray,user_id) {
  let messages = messagesArray.flat();
  return filterFeedBoundMessages(messages,user_id).map(m => loadHomeItem(m));
}

function filterFeedBoundMessages(messagesArray,user_id) {

  messagesArray = messagesArray.filter(m=>{
    let data = null;
    try{
      data = JSON.parse(m.data);
    }catch(e){}
    //Exclude controversial
    if(user_id===m.user.user_id) return true;
    if(data && data.links && data.links.com && /14\d{3}$/.test(data.links.com)) return false;
    if(!data?.links && !m.thread_info && m.message.length < 300) return false;
    return true;
  });


  return messagesArray.filter(m => m.custom_type).sort((a, b) => b.created_at - a.created_at);
}
