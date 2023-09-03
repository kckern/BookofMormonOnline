import { models as Models } from '../config/database';
import Sequelize, { Model } from 'sequelize';
import { getStandardizedValuesFromUserList } from './_common';
import { sendbird } from '../library/sendbird';
import { url } from 'inspector';
import crypto from "crypto";
const Op = Sequelize.Op;

const md5 = (value: string)=>{
  if(!value) return "";
  if(/$[0-9a-f]{32}$/.test(value)) return value;
  return crypto.createHash('md5').update(value,'utf8').digest("hex");

}

export default {
  Query: {
    leaderboard: async (item: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      const rankedUsers :any = await Models.BomUser.findAll({
        raw: true,
        attributes: ['user','name','last_active', 'complete'],
        where: { last_active: { [Op.gt]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }},
        order: [['complete', 'DESC']],
      });

      console.log(rankedUsers.map((u:any)=>`${u.name || u.user} ${u.complete}% ${u.last_active}`));
      const topUsers = rankedUsers.slice(0,100);
      const sendbirdUserObjects = await sendbird.listUsers(topUsers.map((u:any)=>md5(u.user)));

      const publicUsers = await sendbird.getMembersofPublicGroups();




      return topUsers.map((u:any)=>{
        const sendbirdUser = sendbirdUserObjects.find((sbu:any)=>sbu.user_id===md5(u.user));
        if(!sendbirdUser) return null;
        return {
          user_id: u.user,
          nickname: sendbirdUser?.nickname,
          picture: sendbirdUser?.profile_url,
          progress: parseFloat(u.complete),
          finished: [],
          bookmark: sendbirdUser?.metadata?.bookmark,
          public: publicUsers.includes(md5(u.user))
        }
      }).filter((u:any)=>!!u).slice(0,50);


    },
    loadGroupsFromHash: async (item: any, args: any, context: any, info: any) => {
      console.log("a")
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
      console.log("homegroups")
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
        console.log(user);
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
      return sendbird.listUsers(userIds).then(data=>data.map(sbUser => {
        return {
          user_id: sbUser.user_id,
          nickname: sbUser.nickname,
          picture: sbUser.profile_url
        };
      }))
    }
  },
  Mutation: {
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
      let groupId: any = await ((await Models.BomShortlinks.findByPk(args.hash)) as any).getDataValue('string');
      if (!groupId) return { isSuccess: false, msg: 'Group not found' };
      return sendbird.invite(groupId, username);
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
      user_id = md5(user_id);
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
      if(grant) i = await sendbird.invite(channel,my_sb_user_id);
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

function loadHomeUser(sbuser) {
  let summary = { completed: 0, finished: [] };
  try {
    summary = JSON.parse(sbuser?.metadata?.summary);
  } catch (e) {}
  return {
    user_id: sbuser?.user_id,
    nickname: sbuser?.nickname,
    picture: sbuser?.profile_url,
    progress: summary?.completed || 0,
    finished: summary?.finished || []
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

  repliers.map(r => {
    return {
      user_id: r.guest_id,
      nickname: r.nickname,
      picture: r.picture
    };
  });

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

async function getFeaturedGroups(lang) {
  if (lang === 'dev' || !lang) lang = 'en';
  let recentUsers: any = await Models.BomUser.findAll({
    raw: true,
    attributes: ['user'],
    where: { lang: lang },
    order: [['last_active', 'desc']],
    limit: 20
  });
  return await sendbird.getOthersGroups(
    recentUsers.map(u => md5(u.user)),
    lang
  );
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
