import { models as Models, sequelize, SQLQueryTypes } from '../config/database';
import Sequelize, { Model } from 'sequelize';
import moment from 'moment';
import Bluebird from 'bluebird';
moment.locale('en');

export const getSlug = (key: any, val: any, suffix?: string) => {
  //console.log({ key, val, suffix });
  return sequelize
    .query(
      `SELECT   GROUP_CONCAT(slug SEPARATOR '/') as slug
      FROM (with recursive temp (num, guid, slug, parent) as (
        select    0 as num,
                  guid,
                  slug,
                  parent
        from      bom_slug
        where     ${key} = :val
        union all
        select    @i := @i + 1  as num, 
              p.guid,
                  p.slug,
                  p.parent
        from      bom_slug p
        inner join temp
                  on p.guid = temp.parent, 
                  (SELECT @i := 0) r
      )
      select num,  slug from temp group by slug order by num DESC) parts`,
      {
        replacements: {
          val: val
        },
        type: SQLQueryTypes.SELECT
      }
    )
    .then(function(r: any) {
      return r[0].slug + (suffix ? '/' + suffix : '');
    })
    .catch((e: any) => {
      return 'error/loading/slug';
    });
};

export const Op = Sequelize.Op;

export const translatedValue = (item: any, field: string) => {
  var translations = item.getDataValue('translation');
  if (!translations) return item.getDataValue(field);
  for (var t of translations) {
    const refkey = t.getDataValue('refkey');
    if (refkey === field || !refkey) {
      return t.getDataValue('value');
    }
  }
  return  item.getDataValue(field);
};

export const includeTranslation = (refkey: any, lang: string): object => {
  if (!lang || lang === 'en') return null;
  return {
    model: Models.BomTranslation,
    separate: true,
    as: 'translation',
    where: {
      lang: lang,
      refkey: refkey
    },
    attributes: typeof refkey === 'string' ? ['value'] : ['value', 'refkey'],
    required: false
  };
};

export const includeWhere = (model: any, key: string, filter: any, as?: any, attributes?: any) => {
  if (!filter) return null;
  let r = {
    model: model,
    as: as,
    where: { [key]: filter },
    attributes: attributes
  };
  if (!attributes) delete r.attributes;
  if (!as) delete r.as;
  return r;
};

export const completedFromTextItems = (items: Array<any>) => {
  let completed = [];

  for (let i in items) {
    let item = items[i]._bom_log.dataValues;
    if (item.type === 'finished') completed.push(item.timestamp);
  }
  return completed;
};

export const sessionsFromTextItems = (items: Array<any>) => {
  let lasttimestamp = null;
  let session_index = -1;
  let sessions: any = [];
  let guids: Array<string> = [];
  for (let i in items) {
    let item = items[i]._bom_log.dataValues;
    if (!lasttimestamp || lasttimestamp - item.timestamp > 60 * 30) {
      session_index++;
    }
    if (!sessions[session_index]) sessions[session_index] = [];
    sessions[session_index].push(item);
    lasttimestamp = item.timestamp;
    if (item.type === 'block' && !guids.includes(item.value)) guids.push(item.value);
  }
  //console.log(sessions);
  return sessions.filter(checkSessionDuration);
};

const checkSessionDuration = (session: Array<any>) => {
  let start_timestamp = session[session.length - 1]?.timestamp;
  let end_timestamp = session[0]?.timestamp;
  let duration = parseInt(end_timestamp) - parseInt(start_timestamp);
  return duration > 10;
};

export const summaryFromSessions = (sessions: Array<any>, finished: Array<number>) => {
  let duration = 0;
  let firstsession = 0;
  for (let i in sessions) {
    let session = sessions[i];
    let start_timestamp = session[session.length - 1]?.timestamp;
    let end_timestamp = session[0]?.timestamp;
    duration = duration + (parseInt(end_timestamp) - parseInt(start_timestamp));
    firstsession = start_timestamp;
  }
  return {
    first: firstsession,
    duration: duration,
    count: sessions.length,
    finished: finished
  };
};

export const logFromSessions = (sessions: Array<any>, lang: string) => {
  let returnData: any = [];
  let rep_guids: Array<string> = [];
  for (let i in sessions) {
    let session = sessions[i];
    let start_timestamp = session[session.length - 1]?.timestamp;
    let end_timestamp = session[0]?.timestamp;
    let duration = end_timestamp - start_timestamp;
    let studyguids = session
      .map((item: any) => {
        if (item.type === 'block') return item.value;
        return null;
      })
      .filter((x: any) => !!x);
    let repguid = studyguids[0];
    if (repguid && !rep_guids.includes(repguid)) rep_guids.push(repguid);
    returnData.push({
      timestamp: start_timestamp,
      datetime: new Date(start_timestamp * 1000).toISOString(),
      duration: duration,
      description: repguid,
      slug: null
    });
  }
  return Models.BomText.findAll({
    where: { guid: rep_guids },
    attributes: ['guid', 'page', 'link'],
    include: [
      {
        model: Models.BomPage,
        attributes: ['title'],
        as: 'parent_page',
        include: [
          {
            model: Models.BomSlug,
            as: 'pageSlug',
            attributes: ['slug']
          },
          includeTranslation('title', lang)
        ].filter(x => !!x)
      },
      {
        model: Models.BomSection,
        attributes: ['title'],
        as: 'parent_section',
        include: [includeTranslation('title', lang)].filter(x => !!x)
      }
    ]
  }).then((metadata: any) => {
    let guidmap: any = {};
    for (let i in metadata) {
      guidmap[metadata[i].getDataValue('guid')] = {
        page: translatedValue(metadata[i].getDataValue('parent_page'), 'title'),
        section: translatedValue(metadata[i].getDataValue('parent_section'), 'title'),
        slug: metadata[i]?.getDataValue('parent_page')?.pageSlug?.getDataValue('slug') + '/' + metadata[i]?.getDataValue('link')
      };
    }
    returnData = returnData.map((data: any) => {
      let repguid = data.description;
      data.description = repguid ? guidmap[repguid]?.page + '—' + guidmap[repguid]?.section : null;
      data.slug = repguid ? guidmap[repguid]?.slug : 'home';
      data.pagelink = repguid ? guidmap[repguid]?.pagelink : null;
      return data;
    });
    return { sessions: returnData };
  });
};

export const includeModel = (requestInfo: any, model: any, as: any, include?: Array<any>) => {
  // console.log('includeModel', { requestInfo, model, as, include });
  if (requestInfo !== true) {
    let requestQuery = JSON.stringify(requestInfo.fieldNodes);
    if (!new RegExp(`{"kind":"Name","value":"${as}"`).test(requestQuery)) return null;
  }

  var includeModel = {
    model: model,
    as: as,
    include: include?.filter(x => !!x)
  };
  if (!includeModel.include) delete includeModel.include;
  // console.log({ includeModel });
  return includeModel;
};

export const queryWhere = (key: string, filter: any) => {
  if (!filter) return null;
  return { [key]: filter };
};

export const scoreTextItems = (textItems: Array<any>, summary: any) => {
  //console.log("scoreTextItems",{textItems})
  let started = [];
  let completed = [];
  let active = [];
  for (let i in textItems) {
    let item = textItems[i];
    let scores = item._bom_logs?.map((item: any) => parseInt(item.getDataValue('credit')));
    if (!scores) continue;
    let num = item.getDataValue('link');
    let credit = Math.max(...scores);
    //console.log({num,credit,scores});

    if (scores.includes(-1)) active.push(num);
    else if (credit >= 80 || credit === -1) completed.push(num);
    else if (credit >= 0) started.push(num);
  }
  let count = textItems?.length;
  return {
    count: textItems?.length,
    started: Math.round((started.length * 1000) / count) / 10,
    completed: Math.round((completed.length * 1000) / count) / 10,
    started_items: started,
    completed_items: completed,
    active_items: active,
    summary: summary
  };
};

export const findScoredPageTextItems = (pageslugs: Array<string>, queryBy: string, lastcompleted: number) => {
  return {
    attributes: ['title'],
    include: [
      includeWhere(Models.BomSlug, 'slug', pageslugs, 'pageSlug', ['slug']),
      {
        model: Models.BomText,
        attributes: ['guid', 'link'],
        include: [
          {
            separate: true,
            model: Models.BomLog,
            attributes: ['credit'], // TODO FIND MAX CREDIT
            where: {
              type: 'block',
              user: queryBy,
              timestamp: { [Op.gt]: lastcompleted }
            },
            required: false
          }
        ]
      }
    ].filter(x => !!x)
  };
};

export const findUserByToken = (userToken: string) => {
  // console.log('findUserByToken', { userToken });
  let include = {
    include: [
      {
        model: Models.BomUserToken,
        where: {
          token: userToken
        }
      },
      includeModel(true, Models.BomUserSocial, 'networks', [])
    ]
  };
  return include;
};

export const getSlugTip = (slugs: Array<string>) => {
  if (!slugs) return null;
  return slugs.map(function(s: any) {
    return s.split('/').pop();
  });
};

export const getUserForLog = (userToken: string) => {
  //console.log('getUserForLog', { userToken });
  let findOne = findUserByToken(userToken);
  //console.log({ userToken });
  //console.log({ findOne });
  return Models.BomUser.findOne(findOne).then((foundUser: any) => {
    let lastcompleted = foundUser?.getDataValue('finished') || 0;
    let queryBy = foundUser?.getDataValue('user') || userToken;
    return { userToken, queryBy, lastcompleted, userObj: foundUser };
  });
};

export const updateActiveItems = async (userInfo: any) => {
  let now = Math.round(new Date().getTime() / 1000);

  let activeItems = await Models.BomLog.findAll({
    attributes: ['timestamp', 'type', 'value'],
    where: { user: userInfo.queryBy, type: 'block', credit: -1 },
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

  for (let i in activeItems) {
    let thisAction = activeItems[i];
    let timestamp = (thisAction as any).getDataValue('timestamp');
    let elapsedtime = now - parseInt(timestamp);
    let duration = (thisAction as any)?.getDataValue('logText')?.getDataValue('duration');
    let score = duration > 0 ? Math.round((elapsedtime * 100) / duration) : 100;
    if (score > 10000) score = 10000;
    let r = await Models.BomLog.update(
      {
        credit: score
      },
      {
        where: {
          user: userInfo.queryBy,
          timestamp: (thisAction as any).getDataValue('timestamp'),
          value: (thisAction as any).getDataValue('value')
        }
      }
    );
  }
  return true;
};

export const scoreSlugsfromUserInfo = (slugs: any, userInfo: any) => {
  if (!userInfo.lastcompleted) userInfo.lastcompleted = 0;
  let findThis = {
    attributes: ['guid', 'link'],
    where: { [Op.or]: { '$parent_page->pageSlug.slug$': slugs, page: slugs } },
    include: [
      {
        model: Models.BomPage,
        attributes: ['guid'],
        as: 'parent_page',
        include: [
          {
            model: Models.BomSlug,
            attributes: ['slug'],
            as: 'pageSlug'
          }
        ]
      },
      {
        separate: true,
        model: Models.BomLog,
        attributes: ['credit'], // TODO FIND MAX CREDIT
        required: false,
        where: {
          type: 'block',
          user: userInfo.queryBy,
          timestamp: {
            [Op.gt]: userInfo.lastcompleted
          }
        }
      }
    ]
  };
  if (!slugs) delete findThis.where;
  //Insert Log
  return Models.BomText.findAll(findThis).then((textItems: any) => {
    let progress = scoreTextItems(textItems, undefined);
    //mark as
    //UPDATE User
    return progress;
  });
};

//force return promise of string
export const getValueForLog = (key: string, val: string) : Promise<string> => {
  //BLOCK
  if (key === 'block') {

    
    let pageSlug = getSlugTip([val.replace(/\/\d+$/, '')]).shift();
    let linkNum = val.match(/\d+$/).pop();
    return new Promise((resolve, reject) => {
        Models.BomText.findOne({
            attributes: ['guid'],
            where: {
                link: linkNum
            },
            include: [
                {
                    model: Models.BomSlug,
                    as: 'textSlug',
                    where: {
                        slug: pageSlug
                    }
                }
            ]
        })
        .then((item: any) => {
            resolve(item.getDataValue('guid'));
        })
        .catch(reject);
    });

  }

  //PAGE

  //STUDY HALL

  //PEOPLE

  //PLACE

  //MAP

  //OTHER...

  //DEFAULT
  return new Promise(resolve => {
    resolve(val);
  });
};

export const getLoggedTextItems = async (token: string) => {
  return Models.BomUser.findAll({
    attributes: ['user'],
    include: [
      {
        model: Models.BomUserToken,
        where: {
          token: token
        }
      },
      {
        model: Models.BomLog,
        attributes: ['timestamp', 'type', 'value'],
        where: {
          type: { [Op.not]: 'referral' }
        }
      }
    ],
    //limit: 400,
    order: [[Models.BomLog, 'timestamp', 'desc']]
  });
};

export const getStandardizedValuesFromUserList = async (userList: Array<string>) => {
  let finishes = await Models.BomLog.findAll({
    raw: true,
    attributes: ['timestamp', 'user'], // TODO FIND MAX CREDIT
    where: {
      type: ['finished'],
      user: userList
    }
  });

  let finishers: any = {};
  for (let i in finishes) {
    let f: any = finishes[i];
    if (!finishers[f.user]) finishers[f.user] = Array();
    finishers[f.user].push(f.timestamp);
  }
  let textItems = await Models.BomText.findAll({
    attributes: ['guid'],
    nest: false,
    include: [
      {
        separate: true,
        model: Models.BomLog,
        attributes: ['timestamp', 'user', 'type'], // TODO FIND MAX CREDIT
        where: {
          type: ['block'],
          credit: { [Op.gte]: 80 },
          user: userList
        },
        required: false
      }
    ],
    order: [
      // [Models.BomLog, 'user', 'asc'],
      //[{model:Models.BomLog, as: "bom_log"}, 'timestamp', 'asc']
    ]
  });
  let guids = textItems.map(i => (i as any).guid).filter((item, pos, self) => self.indexOf(item) == pos);
  const maxBlocks = guids.length;

  //Score by user
  let history: any = {};
  let earliestDate = null;
  let progress = 0;

  let logItems = {};
  //PRE SORT
  for (let i in textItems) {
    let item: any = textItems[i];
    if (!item.getDataValue('_bom_logs')) continue;
    const guid = item.getDataValue('guid');
    const entires = item.getDataValue('_bom_logs');
    for (let i in entires) {
      const entry = entires[i];
      const user = entry.getDataValue('user');
      const timestamp = entry.getDataValue('timestamp');
      logItems[user + timestamp] = { guid, user, timestamp };
    }
  }
  let keys: object = Object.keys(logItems).sort();
  //ITEM PROCESS
  for (let i in keys) {
    let key = keys[i];
    const { guid, user, timestamp } = logItems[key];

    let date = new Date(timestamp * 1000).toLocaleString('fr-CA', { timeZone: 'America/New_York' }).substr(0, 10);
    if (!earliestDate || date < earliestDate) earliestDate = date;
    if (!history[user]) history[user] = { content: {}, progress: {} };
    if (!history[user].progress[date]) history[user].progress[date] = progress;
    if (!history[user].content[guid]) history[user].content[guid] = 0;
    history[user].content[guid]++;
    progress = Math.round((Object.keys(history[user].content).length * 10000) / maxBlocks) / 100;
    history[user].progress[date] = progress;
    if (finishers[user]?.[0] < timestamp) {
      history[user].progress[date] = 100;
      history[user].content = {};
      finishers[user].shift();
    }
  }

  if (!earliestDate) return [];

  var now = new Date();
  var fullDateRange = [];
  for (var d = new Date(earliestDate); d <= now; d.setDate(d.getDate() + 1)) {
    fullDateRange.push(new Date(d).toLocaleString('fr-CA', { timeZone: 'America/New_York' }).substr(0, 10));
  }

  let standardizedValues: any = [];
  let lastValues: any = {};
  let dateProgress: any = {};
  for (let i in fullDateRange) {
    let date = fullDateRange[i];
    dateProgress[date] = {};
    for (let j in userList) {
      let user = userList[j];
      if (!lastValues[user]) lastValues[user] = 0;
      if (history[user].progress[date]) dateProgress[date][user] = history[user].progress[date];
      else dateProgress[date][user] = lastValues[user];
      lastValues[user] = dateProgress[date][user];
    }
    standardizedValues.push({ date: date, progress: dateProgress[date] });
  }

  return standardizedValues;
};
