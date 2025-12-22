import { models, models as Models } from '../config/database';
import Sequelize, { Model } from 'sequelize';
import { messenger } from '../library/messenger';
import { genUserAvatar } from './lib';

import crypto from 'crypto';

// Feature flag - messaging disabled until Phase 5 data migration
const MESSENGER_ENABLED = process.env.MESSENGER_ENABLED === 'true';

// Sendbird-compatible shim - returns mock data when messaging disabled
const sendbird: any = MESSENGER_ENABLED ? messenger : {
  loadUser: async (id: string, name?: string, url?: string, email?: string) => ({ 
    user_id: id, 
    nickname: name || 'User', 
    profile_url: url || '',
    metadata: null,
    is_online: false,
    last_seen_at: null,
    is_bot: false
  }),
  getUser: async (id: string) => null,
  createUser: async (id: string, name: string, url: string) => ({ user_id: id, nickname: name, profile_url: url }),
  upsertUser: async (id: string, data: any) => ({ user_id: id, ...data }),
  updateUserNickname: async () => ({}),
  updateUser: async () => ({}),
  closeTab: async () => ({}),
};
import {
  Op,
  includeTranslation,
  translatedValue,
  scoreSlugsfromUserInfo,
  getUserForLog,
  includeModel,
  findUserByToken,
  getSlugTip,
  getValueForLog,
  findScoredPageTextItems,
  scoreTextItems,
  completedFromTextItems,
  getStandardizedValuesFromUserList,
  logFromSessions,
  summaryFromSessions,
  sessionsFromTextItems,
  updateActiveItems,
  getLoggedTextItems
} from './_common';
import { userInfo } from 'os';
import request from 'request-promise';
import axios from 'axios';

const md5 = (value: string) => {
  if (!value) return "";
  if (/$[0-9a-f]{32}$/.test(value)) return value;
  return crypto.createHash('md5').update(value, 'utf8').digest("hex");
}

const cleanUsername = (username: string, email: string) => {

  const emailPrefix = email ? email.split("@")[0] : "";
  if(emailPrefix) return emailPrefix;
  username = username.toLowerCase().replace(/[^A-z0-9.-]/ig, ".").replace(/[.]+/, ".");
  username = username.replace(/[\(\[].*[\)\]]/, "").trim();  //remove parenthesis
  username = username.replace(/[.]+/, "."); //remove double dots
  username = username.replace(/^\.+/, "").replace(/\.+$/, "");
  username = username.replace(/[^\x00-\x7F]/g, ""); //remove non-ascii
  if (!username) username = md5(email);   //if no username, use email hash
  return username;
}


export default {
  Query: {
    signin: async (root: any, args: any, context: any, info: any) => {
      if (!args.username || !args.password || !args.token)
        return {
          isSuccess: false,
          msg: 'Login Failed',
          user: null
        };
      
      try {
        const passwordHash = crypto
          .createHash('md5')
          .update(args.password)
          .digest('hex');

        let myUser: any = await Models.BomUser.findOne({
          where: {
            [Op.or]: {
              user: args.username,
              email: args.username
            },
            pass: passwordHash
          }
        });

        if (!myUser) {
          myUser = await Models.BomUser.findOne({
            where: {
              user: args.username.replace(/@.*$/, ""),
              pass: '-1'
            }
          });

          if (myUser) {
            await Models.BomUser.update(
              { pass: passwordHash },
              { where: { user: myUser.user } }
            );
          }
        }

        if (!myUser) {
          return {
            isSuccess: false,
            msg: 'Login Failed',
            user: null
          };
        }

        //New Token Processing
        try {
          await Models.BomUserToken.upsert({ token: args.token, user: myUser.user });
          const results: any = await Models.BomUserToken.findAll({ where: { user: myUser.user } });
          const tokens = results.map((item: any) => item.getDataValue('token'));
          await Models.BomLog.update({ user: myUser.user }, { where: { user: tokens } });
        } catch (tokenError) {
          console.error('Token processing error during signin:', tokenError);
          // Continue with login even if token processing fails
        }

        const hashed_id = md5(myUser.getDataValue("user"));
        const userName = myUser.getDataValue("name");
        const userAvatar = genUserAvatar(hashed_id);
        return {
          isSuccess: true,
          msg: 'login_success',
          user: myUser,
          social: await sendbird.loadUser(hashed_id, userName, userAvatar)
        };
      } catch (error) {
        console.error('Database error during signin:', error);
        return {
          isSuccess: false,
          msg: 'Database error',
          user: null
        };
      }
    },
    user: async (root: any, args: any, context: any, info: any) => {
      try {
        const foundUser: any = await Models.BomUser.findOne(findUserByToken(args.token));
        return foundUser;
      } catch (error) {
        console.error('Database error during user lookup:', error);
        return null;
      }
    },
    closetab: async (root: any, args: any, context: any, info: any) => {
      try {
        const foundUser: any = await Models.BomUser.findOne(findUserByToken(args.token));
        if (!foundUser) return false;
        return sendbird.closeTab(foundUser.getDataValue('user'));
      } catch (error) {
        console.error('Database error during closetab:', error);
        return false;
      }
    },

    socialsignin: async (root: any, args: any, context: any, info: any) => {
      if (args.network === 'facebook') return facebooksignin(args);
      if (args.network === 'google') return googlesignin(args);
      if (args.network === 'naver') return naversignin(args);
      if (args.network === 'kakao') return kakaosignin(args);

      return {
        isSuccess: false,
        msg: 'social_sign_in_failed'
      };
    },

    tokensignin: async (root: any, args: any, context: any, info: any) => {
      let token = args.token;
      // console.log('tokensignin');
      try {
        const myUser: any = await Models.BomUser.findOne({
          include: [
            {
              model: Models.BomUserToken,
              where: {
                token: args.token
              }
            },
            includeModel(info, Models.BomUserSocial, 'networks')
          ]
        });

        if (!myUser) {
          return {
            isSuccess: false,
            msg: 'Token Login Failure'
          };
        }

        const hashed_id = md5(myUser.getDataValue("user"));
        const userName = myUser.getDataValue("name");
        const userAvatar = genUserAvatar(hashed_id);
        return {
          isSuccess: true,
          msg: 'Token Login Success',
          user: myUser,
          social: await sendbird.loadUser(hashed_id, userName, userAvatar)
        };
      } catch (error) {
        console.error('Database error during token signin:', error);
        return {
          isSuccess: false,
          msg: 'Database error'
        };
      }
    },
    sourceUsage: async (root: any, args: any, context: any, info: any) => {
      if (!args.token || !args.source) return 0;
      try {
        const logs: any = await Models.BomUser.findAll({
          raw: true,
          include: [
            {
              model: Models.BomUserToken,
              where: {
                token: args.token
              }
            },
            {
              model: Models.BomLog,
              where: {
                type: 'commentary',
                value: {
                  [Op.like]: '_____' + args.source.padStart(3, '0') + '__'
                }
              }
            }
          ]
        });

        const sourceInfo = await Models.BomXtrasSource.findOne({
          raw: true,
          attributes: ["item_count"],
          where: {
            source_id: args.source
          }
        });

        let nom = 100 * 100 * (1 + logs.map(l => l['_bom_log.value']).filter((value, index, self) => self.indexOf(value) === index).length || 1);
        let denom = sourceInfo?.['item_count'] || 100;
        return Math.round(nom / denom) / 100;
      } catch (error) {
        console.error('Database error during sourceUsage:', error);
        return 0;
      }
    },
    studylog: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      let empty = {
        sessions: Array(),
        summary: {
          first: Math.round(Date.now() / 1000),
          duration: 0,
          count: 0,
          finished: Array()
        }
      };
      if (!args.token) return empty;
      return getLoggedTextItems(args.token).then((textItems: any) => {
        if (textItems.length === 0) return empty;
        let finished = completedFromTextItems(textItems);
        let sessions = sessionsFromTextItems(textItems);
        let summary = summaryFromSessions(sessions, finished);

        //Handle summary-only request
        let requestQuery = JSON.stringify(info.fieldNodes);
        if (!new RegExp(`{"kind":"Name","value":"sessions"`).test(requestQuery)) return { summary };

        //handle session request
        return logFromSessions(sessions, lang).then((log: any) => {
          log.summary = summary;
          return log;
        });
      });
    },
    userdailyscores: async (root: any, args: any, context: any, info: any) => {
      try {
        const user: any = await Models.BomUser.findOne({
          attributes: ['user'],
          include: [
            {
              model: Models.BomUserToken,
              where: {
                token: args.token
              }
            }
          ]
        });

        let username = user ? user?.getDataValue('user') : args.token;

        const standardizedValues: any = await getStandardizedValuesFromUserList([username]);
        return {
          dates: standardizedValues.map((item: any) => item.date),
          progress: standardizedValues.map((item: any) => item.progress[username])
        };
      } catch (error) {
        console.error('Database error during userdailyscores:', error);
        return {
          dates: [],
          progress: []
        };
      }
    },
    pageprogress: async (root: any, args: any, context: any, info: any) => {
      let pageslugs = getSlugTip(args.slug);
      let userToken = args.token;
      return getUserForLog(userToken).then((userInfo: any) => {
        return updateActiveItems(userInfo).then(() => {
          return Models.BomPage.findAll(findScoredPageTextItems(pageslugs, userInfo.queryBy, userInfo.lastcompleted)).then((logItems: any) => {
            return logItems.map((pageItem: any) => {
              let textItems = pageItem._bom_texts;
              return scoreTextItems(textItems, undefined);
            });
          });
        });
      });
    },
    userprogress: async (root: any, args: any, context: any, info: any) => {
      let pageslugs = getSlugTip(args.slug);
      let userToken = args.token;
      return getUserForLog(userToken).then((userInfo: any) => {
        return Models.BomText.findAll({
          attributes: ['guid', 'link'],
          include: [
            {
              separate: true,
              model: Models.BomLog,
              attributes: ['credit'], // TODO FIND MAX CREDIT
              where: {
                type: 'block',
                user: userInfo.queryBy,
                timestamp: { [Op.gt]: userInfo.lastcompleted }
              },
              required: false
            }
          ]
        }).then((textItems: any) => {
          let summary = getLoggedTextItems(args.token).then((textItems: any) => {
            let completed = completedFromTextItems(textItems);
            let sessions = sessionsFromTextItems(textItems);
            let summary = summaryFromSessions(sessions, completed);
            return summary;
          });
          let score = scoreTextItems(textItems, summary);

          const {completed,started} = score;
          Models.BomUser.update({ complete: completed, started }, { where: { user: userInfo.queryBy } });

          if (score.completed >= 100) {
            let now = Math.round(Date.now() / 1000);
            if (userInfo.userObj) userInfo.userObj.update({ finished: now });
            Models.BomLog.create({
              timestamp: now,
              user: userInfo.queryBy,
              ip: context.ip,
              type: "finished",
              value: "",
              credit: -1,
              flag: 0
            })
          }

          return score;
        });
      });
    }
  },
  Mutation: {
    signout: async (root: any, args: any, context: any, info: any) => {
      try {
        const result: any = await Models.BomUserToken.destroy({
          where: {
            token: args.token
          }
        });
        return result === 1;
      } catch (error) {
        console.error('Database error during signout:', error);
        return false;
      }
    },
    signup: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : "en";

      args.username = cleanUsername(args.username, args.email);
      const socialUserId = md5(args.username);
      const emailHash = md5(args.email);

      let profile_url = genUserAvatar(socialUserId);
      if (args.email) {
        let gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}`;
        try {
          await axios.get(gravatarUrl + '?d=404');
          profile_url = gravatarUrl;
        } catch (e) { }
      }
      if (!args.username || !args.password || !args.token)
        return {
          isSuccess: false,
          msg: 'Sign-up Failed',
          user: null
        };
      return Models.BomUser.create({
        user: args.username,
        name: args.name,
        email: args.email,
        pass: crypto
          .createHash('md5')
          .update(args.password)
          .digest('hex'),
        zip: args.zip,
        lang: lang || "en",
        created_at: Sequelize.literal('CURRENT_TIMESTAMP')
      })
        .then((myUser: any) => {
          if (!myUser) {
            return {
              isSuccess: false,
              msg: 'error_creating_user',
              user: null,
              social: null
            };
          }
          //New Token Processing
          Models.BomUserToken.upsert({ token: args.token, user: args.username }).then(function () {
            // console.log('signin');
            return Models.BomUserToken.findAll({ where: { user: args.username } }).then(function (results: any) {
              var tokens = results.map((itme: any) => itme.getDataValue('token'));
              //  console.log({ tokens });
              return Models.BomLog.update({ user: args.username }, { where: { user: tokens } }).then((updateResults: any) => {
                // console.log({updateResults});
              });
            });
          });

          return sendbird.createUser(socialUserId, myUser.name, profile_url).then((sendbirdUser: any) => {
            {
              if (!sendbirdUser) {
                return {
                  isSuccess: false,
                  msg: 'error_creating_social_user',
                  user: null,
                  social: null
                };
              }
              return {
                isSuccess: true,
                msg: 'sign_up_success',
                user: myUser,
                social: sendbirdUser
              };
            }
          });
        })
        .catch((error: any) => {
          return {
            isSuccess: false,
            msg: error.parent?.code,
            user: null,
            social: null
          };
        });
    },
    editProfile: async (root: any, args: any, context: any, info: any) => {
      if (!args.token) return false;
      try {
        const myUser: any = await Models.BomUser.findOne({
          include: [
            {
              model: Models.BomUserToken,
              where: {
                token: args.token
              }
            }
          ]
        });

        if (!myUser?.user) return null;
        
        let updatedValues = args;
        delete updatedValues.token;
        // console.log({ updatedValues });
        
        const result: any = await Models.BomUser.update(updatedValues, { where: { user: myUser.user } });
        // if(result.shift() === 0) return null
        Object.assign(myUser, updatedValues);
        const { user } = myUser;
        const hashed_id = md5(user);
        
        if (updatedValues?.name) {
          try {
            const sbResponse: any = await sendbird.updateUserNickname(hashed_id, updatedValues.name);
            if (!sbResponse) return null;
            return myUser;
          } catch (sendbirdError) {
            console.error('Sendbird update error:', sendbirdError);
            return myUser; // Return user even if sendbird update fails
          }
        }
        return myUser;
      } catch (error) {
        console.error('Database error during editProfile:', error);
        return null;
      }
    },
    changePassword: async (root: any, args: any, context: any, info: any) => {
      if (!args.password) return false;
      if (!args.token) return false;
      let newPassword = crypto
        .createHash('md5')
        .update(args.password)
        .digest('hex');
      
      try {
        const myUser: any = await Models.BomUser.findOne({
          attributes: ['user'],
          where: {
            pass: { [Op.notLike]: newPassword }
          },
          include: [
            {
              model: Models.BomUserToken,
              where: {
                token: args.token
              }
            }
          ]
        });

        if (!myUser?.user) return false;
        
        const result: any = await Models.BomUser.update({ pass: newPassword }, { where: { user: myUser.user } });
        return result.shift() === 1;
      } catch (error) {
        console.error('Database error during changePassword:', error);
        return false;
      }
    },
    log: async (root: any, args: any, context: any, info: any) => {
      return getUserForLog(args.token).then((userInfo: any) => {

        let now = Math.round(Date.now() / 1000);
        if (userInfo.userObj) userInfo.userObj.update({ last_active: now });

        return getValueForLog(args.key, args.val).then((value: string) => {
          // console.log({ context });
          // Extract the actual client IP (first in the chain) and truncate to fit the column
          const clientIp = context.ip ? context.ip.split(',')[0].trim().substring(0, 45) : '';
          return Models.BomLog.create({
            timestamp: now,
            user: userInfo.queryBy,
            ip: clientIp,
            type: args.key,
            value: value,
            credit: -1,
            flag: 0
          }).then((r: any) => {
            return scoreRecentItems(userInfo).then(success => {
              if (success) {
                return {
                  logged: true,
                  progress: scoreSlugsfromUserInfo(null, userInfo)
                };
              } else {
                return {
                  logged: false
                };
              }
            });
          });
        });
      });
    }
  },
  User: {
    progress: async (item: any, args: any, context: any, info: any) => {
      let userInfo = { queryBy: item.getDataValue('user'), lastcompleted: item.getDataValue('finished') };
      return scoreSlugsfromUserInfo(null, userInfo);
    }
  },
  UserSession: {}
};

async function processSocialUser(args, incr: number) {
  let { network, social_id, name, profile_url, token, email, social_token } = args;

  if (!social_id) return {
    isSuccess: false,
    msg: `${network} failure`
  }

  let myUserEmail: any = email ? await Models.BomUser.findOne({ where: { email } }) : null;
  let myUserSocial: any = await Models.BomUserSocial.findOne({ where: { network, social_id } });

  //CREATE USER
  if (!myUserSocial && !myUserEmail) {
    var user = cleanUsername(name, email);
    if (incr > 0) user = user + "." + incr;
    let myUser = await Models.BomUser.findOne({ where: { [Op.or]: [{ user }, { email }] } });
    if (myUser !== null) return processSocialUser(args, incr + 1);
    await Models.BomUser.create({
      user: user,
      pass: md5(social_token + Date.now()),
      name: name,
      email: email,
      zip: ''
    });

    await Models.BomUserToken.create({ token, user });
    await Models.BomUserSocial.create({ user, network, social_id });
    const hashed_id = md5(user)
    let social = await sendbird.loadUser(hashed_id, name, profile_url);
    await sendbird.updateUserNickname(hashed_id, name);
    return {
      isSuccess: true,
      msg: `${network} create + login Success`,
      user: Models.BomUser.findOne({ where: { user } }),
      profile_url: profile_url,
      social: social
    };
  }
  // LINK TO EXISTING USER
  else if (myUserEmail && !myUserSocial) {
    await Models.BomUserToken.create({ token, user: myUserEmail.getDataValue('name') });
    await Models.BomUserSocial.create({ user: myUserEmail.getDataValue('user'), network, social_id });
    const hashed_id = md5(myUserEmail.getDataValue('user'))
    let social = await sendbird.loadUser(hashed_id, myUserEmail.getDataValue('name'), profile_url, email);
    return {
      isSuccess: true,
      msg: `${network} link account success`,
      user: myUserEmail,
      profile_url: profile_url,
      social: social
    };
  }
  // //SIMPLY LOGIN
  else {
    await Models.BomUserToken.create({ token: args.token, user: myUserSocial.user });
    let myUser: any = await Models.BomUser.findOne({ where: { user: myUserSocial.user } });
    const hashed_id = md5(myUser.getDataValue('user'))
    let social = await sendbird.loadUser(hashed_id, myUser.getDataValue('name'), profile_url);
    return {
      isSuccess: true,
      msg: `${network} login success`,
      user: myUser,
      profile_url: profile_url,
      social: social
    };
  }
}

async function facebooksignin(args: any) {
  const string = await request('https://graph.facebook.com/me?fields=email,name&access_token=' + args.social_token);
  var data = JSON.parse(string);
  const profile_url = `https://graph.facebook.com/${data.id}/picture?type=large&access_token=${args.social_token}`;
  if (!data.email) data.email = `${data.id}@fb.com`;

  return processSocialUser(
    {
      network: 'facebook',
      social_id: data.id,
      name: data.name, profile_url,
      token: args.token,
      email: data.email,
      social_token: args.social_token
    },
    0
  );
}
async function googlesignin(args: any) {
  const string = await request(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${args.social_token}`);
  var data = JSON.parse(string);

  return processSocialUser(
    {
      network: 'google',
      social_id: data.sub,
      name: data.name,
      profile_url: data.picture,
      token: args.token,
      email: data.email,
      social_token: args.social_token
    },
    0
  );
}

async function naversignin(args: any) {
  var options = {
    'method': 'POST',
    'url': 'https://openapi.naver.com/v1/nid/me',
    'headers': {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${args.social_token}`
    }
  };
  let string = await request(options);
  var data = JSON.parse(string).response;
  const nicknameHasAsterisk = /[*]/.test(data.nickname);
  const nameHasAsterisk = /[*]/.test(data.name);
  let nickname = !nicknameHasAsterisk ? data.nickname : !nameHasAsterisk ? data.name : data.nickname.replace(/[*]/g, "") || data.name.replace(/[*]/g, "") || data.email.split("@")[0];
  nickname = nickname.replace(/\w\S*/g, (w: string) => (w.replace(/^\w/, (c: string) => c.toUpperCase())));
  return processSocialUser(
    {
      network: 'naver',
      social_id: data.id,
      name: data.nickname,
      profile_url: data.profile_image,
      token: args.token,
      email: data.email,
      social_token: args.social_token
    },
    0
  );
}

async function kakaosignin(args: any) {
  const keys = encodeURIComponent(JSON.stringify(["properties.nickname", "kakao_account.email", "kakao_account.profile"]));
  var options = {
    'method': 'GET',
    'url': 'https://kapi.kakao.com/v2/user/me?property_keys=' + keys,
    'headers': {
      'Authorization': `Bearer ${args.social_token}`
    }
  };
  let string = await request(options);
  var data = JSON.parse(string);
  return processSocialUser(
    {
      network: 'kakao',
      social_id: data.id,
      name: data.properties?.nickname,
      profile_url: data.kakao_account?.profile?.profile_image_url,
      token: args.token,
      email: data.kakao_account?.email,
      social_token: args.social_token
    }, 0
  );
}

async function scoreRecentItems(userInfo: any) {
  let textItems = await Models.BomLog.findAll({
    attributes: ['timestamp', 'type', 'value'],
    where: {
      user: userInfo.queryBy,
      type: {
        [Op.in]: ["block"]
      }
    },
    limit: 5,
    order: [['timestamp', 'desc']],
    include: [
      {
        as: 'logText',
        model: Models.BomText,
        required: false,
        attributes: ['duration']
      }
    ]
  });

  let dataItems = textItems.map((i: any) => {
    return {
      duration: i?.getDataValue('logText')?.getDataValue('duration'),
      type: i?.getDataValue('type'),
      value: i?.getDataValue('value'),
      timestamp: i?.getDataValue('timestamp')
    };
  });

  for (let i in dataItems) {
    let followingItem = dataItems[i];
    let itemToScore = dataItems[parseInt(i) + 1];
    if (!itemToScore || itemToScore.type !== 'block') continue;
    let nextTime = followingItem.timestamp;
    let startTime = itemToScore.timestamp;
    let timespent = nextTime - startTime;
    let duration = itemToScore?.duration || 0;
    let score = duration > 0 ? Math.round((timespent * 100) / duration) : 0;
    if (score > 10000) score = 9999;
    //console.log({startTime,nextTime,timespent,duration,score});
    await Models.BomLog.update(
      {
        credit: score
      },
      {
        where: {
          user: userInfo.queryBy,
          timestamp: itemToScore.timestamp,
          value: itemToScore.value
        }
      }
    );
  }

  return true;
}
