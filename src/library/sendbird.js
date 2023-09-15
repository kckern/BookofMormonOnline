const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const crypto = require('crypto');
const isJSON = require("is-json");


const {SENDBIRD_APPID, SENDBIRD_TOKEN} = process.env;

class Sendbird {

  async createUser(user_id, nickname="", profile_url="", email="") {
   // console.log(`createUser ${user_id}`)
    if (user_id === '' || user_id === undefined) return false;
    if (nickname === '' || nickname === undefined) nickname = user_id;
 //   console.log(`createUser ${user_id} ${nickname} ${email}`);
    const profile_path = `./tmp/${Math.random() * 1000}.jpg`;
  //  console.log({profile_path});
    if (!profile_url) profile_url = '';

    var data = new FormData();
    data.append('user_id', user_id);
    data.append('nickname', nickname);
    data.append('issue_access_token', 'true');

    if (email && !profile_url) {
      let gravatarUrl =
        'https://www.gravatar.com/avatar/' +
        crypto
          .createHash('md5')
          .update(email)
          .digest('hex');
      try {
        await axios.get(gravatarUrl + '?d=404');
        profile_url = gravatarUrl;
      } catch (e) {}
    } else if (profile_url && !/svg$/.test(profile_url)) {
      const response = await axios({
        method: 'get',
        url: profile_url,
        responseType: 'stream'
      });
      await response.data.pipe(fs.createWriteStream(profile_path));
      await checkExistsWithTimeout(profile_path,2000);
      profile_url = '';
      data.append('profile_file', fs.createReadStream(profile_path));
    }
    data.append('profile_url', profile_url);
    var config = {
      method: 'POST',
      url: 'https://api-' + SENDBIRD_APPID + '.sendbird.com/v3/users',
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json',
        ...data.getHeaders()
      },
      data: data
    };
    return axios(config)
      .then(function(response) {
        fs.unlink(profile_path, () => {});
        const newProfileUrl = response.data.profile_url;
        if (!newProfileUrl) return  sendbird.loadUser(user_id);
        return getFwdUrl(newProfileUrl).then(S3Url => {
       //   console.log({ newProfileUrl, S3Url });
          return sendbird.updateUserProfileUrl(user_id, S3Url).then(r=>{
              return sendbird.loadUser(user_id);
          })
        });
      })
      .catch(function(error) {
    //    console.log("LINE 71 ERROR - ",error.response.data.message);
       return sendbird.loadUser(user_id)
      });
  }

  async updateUserNickname(user_id, nickname) {
    if (!user_id) return false;
    if (!nickname) nickname = user_id;

    var authOptions = {
      method: 'PUT',
      url: 'https://api-' + SENDBIRD_APPID + `.sendbird.com/v3/users/${encodeURI(user_id)}`,
      data: JSON.stringify({ nickname: nickname }),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    return axios(authOptions)
      .then((res) => {
        //console.error({ res });
        if (res.data.nickname) return res.data.nickname;
        return false;
      })
      .catch((error) => {
        console.log({ authOptions });
        console.error({ error });
        return false;
      });
  }
  async updateUserProfileUrl(user_id, profile_url) {
    if (!profile_url) return false;

    var authOptions = {
      method: 'PUT',
      url: 'https://api-' + SENDBIRD_APPID + `.sendbird.com/v3/users/${encodeURI(user_id)}`,
      data: JSON.stringify({ profile_url: profile_url }),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    return axios(authOptions)
      .then((res) => {
        //console.error({ res });
        if (res.data.profile_url) return res.data.profile_url;
        return false;
      })
      .catch((error) => {
        console.log({ authOptions });
        console.error({ error });
        return false;
      });
  }
  async closeTab(user_id) {
    if (!user_id) return false;
    return this.updateUserMetadatum(user_id, 'activeGroup', '').then(r =>
      this.getStudyGroupChannels(user_id).then(channels => {
        let items = channels.map((channel) => {
          return this.updateChannelMetadatum(
            channel.channel_url,
            'action',
            JSON.stringify({ username: user_id, key: 'action', val: { activeGroup: '', activeCall: '' } })
          ).then(() => channel.name);
        });
        return Promise.all([user_id].concat(items));
      })
    );
  }
  async updateUserMetadatum(user_id, key, val) {
    if (!user_id) return false;

    var authOptions = {
      method: 'PUT',
      url: 'https://api-' + SENDBIRD_APPID + `.sendbird.com/v3/users/${encodeURI(user_id)}/metadata/${key}`,
      data: JSON.stringify({ upsert: true, value: val }),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    return axios(authOptions)
      .then((res) => {
        return res.data;
      })
      .catch((error) => {
        console.log({ authOptions });
        console.error({ error });
        return false;
      });
  }
  async updateChannelMetadatum(channel_id, key, val) {
    if (!channel_id) return false;
    // console.log('update', { channel_id, key, val });
    var authOptions = {
      method: 'PUT',
      url: 'https://api-' + SENDBIRD_APPID + `.sendbird.com/v3/group_channels/${channel_id}/metadata/${key}`,
      data: JSON.stringify({ upsert: true, value: JSON.stringify(val) }),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    return axios(authOptions)
      .then((res) => {
        return res.data;
      })
      .catch((error) => {
        console.log({ authOptions });
        console.error({ error });
        return false;
      });
  }
  async getStudyGroupChannels(user_id) {
    if (!user_id) return false;

    var authOptions = {
      method: 'GET',
      url: 'https://api-' + SENDBIRD_APPID + `.sendbird.com/v3/group_channels?members_include_in=${encodeURI(user_id)}&custom_types=private,public,open`,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        Authorization: 'Basic Og==',
        'Content-Type': 'application/json'
      }
    };

    return axios(authOptions)
      .then(function(res) {
        return res.data.channels || false;
      })
      .catch((error) => {
        console.log({ authOptions });
        console.error({ error });
        return false;
      });
  }

  loadUser(user_id, nickname="", profile_url="", email="") {
   // console.log(`LOAD ${user_id}`)
    if (user_id === '' || !user_id) return false;

    var authOptions = {
      method: 'GET',
      url: 'https://api-' + SENDBIRD_APPID + '.sendbird.com/v3/users/' + encodeURI(user_id),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    return axios(authOptions)
      .then((res) => {
        // console.log("loadUserHTTPResponse",{res});
        if (res.data.is_active === true){
          const {user_id,nickname,profile_url,access_token} = res.data;
          return {user_id,nickname,profile_url,access_token};
        } 

       // console.log(`${user_id} Not Active, Creating`);
        return this.createUser(user_id, nickname, profile_url, email);
      })
      .catch((error) => {
      //  console.log(`${user_id} Not Found, Creating`);
        return this.createUser(user_id, nickname, profile_url, email);
      });
  }

  listUsers(user_ids) {
    if (!user_ids.length) return [];
    var authOptions = {
      method: 'GET',
      url: 'https://api-' + SENDBIRD_APPID + '.sendbird.com/v3/users' + `?limit=100&user_ids=${encodeURI(user_ids.join(','))}`,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    return axios(authOptions)
      .then((res) => {
        return res.data.users || [];
      })
      .catch((error) => {
        console.log('loadUserHTTPError', { error });
      });
  }

  isUser(user_id) {
    if (user_id === '' || user_id === undefined) return false;
    var authOptions = {
      method: 'GET',
      url: 'https://api-' + SENDBIRD_APPID + '.sendbird.com/v3/users/' + user_id,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    // console.log(authOptions);
    return axios(authOptions)
      .then((res) => {
        if (res.data.is_active === true) return true;
        return false;
      })
      .catch((error) => {
        return false;
      });
  }

  async loadChannel(channelUrl) {
    let baseUrl = 'https://api-' + SENDBIRD_APPID + '.sendbird.com/v3/group_channels/' + channelUrl;
    var authOptions = {
      method: 'GET',
      url: baseUrl,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    let response = { data: null };
    try {
      response = await axios(authOptions);
    } catch (e) {
      return {};
    }

    let channel = response?.data?.channel;

    //get messages
    authOptions.url = baseUrl + '/messages?message_type=MESG&message_ts=' + Date.now();
    response = await axios(authOptions);
    let messages = response?.data?.messages;

    //get members
    authOptions.url = baseUrl + '/members?limit=100';
    response = await axios(authOptions);
    let members = response?.data?.members;

    //get metdata
    authOptions.url = baseUrl + '/metadata';
    response = await axios(authOptions);
    let metadata = response?.data || {}

    for(let i in Object.keys(metadata)){
      let key = Object.keys(metadata)[i];
      metadata[key] = isJSON(metadata[key]) ? JSON.parse(metadata[key]) : metadata[key];
    }

    let returnData = channel;
    returnData.messages = messages;
    returnData.members = members;
    returnData.metadata = metadata;
    return returnData;
  }

  request(channelObj, username) {
    let data = JSON.parse(channelObj.data);

    if (!data.requests) data.requests = [];
    if (data.requests.includes(username)) return { isSuccess: true, msg: 'Already Sent' };
    data.requests.push(username);
    var authOptions = {
      method: 'PUT',
      url: 'https://api-' + SENDBIRD_APPID + '.sendbird.com/v3/group_channels/' + channelObj.channel_url,
      data: JSON.stringify({ data: JSON.stringify(data) }),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    return axios(authOptions).then((res, error) => {
      if (error) return { isSuccess: false, msg: 'Request Failed' };
      return { isSuccess: true, msg: 'Request Sent' };
    });
  }

  withdraw(channelObj, username) {
    let data = JSON.parse(channelObj.data);
    if (!data.requests) data.requests = [];
    let index = data.requests.indexOf(username);
    if (index === -1) return { isSuccess: true, msg: 'No request found' };
    data.requests.splice(index, 1);
    var authOptions = {
      method: 'PUT',
      url: 'https://api-' + SENDBIRD_APPID + '.sendbird.com/v3/group_channels/' + channelObj.channel_url,
      data: JSON.stringify({ data: JSON.stringify(data) }),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    return axios(authOptions).then((res, error) => {
      if (error) return { isSuccess: false, msg: 'Withdraw request failed' };
      return { isSuccess: true, msg: 'Request withdrawn' };
    });
  }

  invite(channel, username) {
    var authOptions = {
      method: 'POST',
      url: 'https://api-' + SENDBIRD_APPID + '.sendbird.com/v3/group_channels/' + channel + '/invite',
      data: JSON.stringify({ user_ids: [username] }),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    return axios(authOptions)
      .then((res) => {
        for (var i in res.data.members) {
          var member = res.data.members[i];
          if (member.user_id === username && member.state === 'invited') return this.accept(channel, username);
          if (member.user_id === username) return { isSuccess: true, msg: 'Auto-added to group', channel: channel, user: username };
        }
        return { isSuccess: false, msg: 'Failed to invite' };
      })
      .catch((error) => {
        console.error(error);
        return { isSuccess: false, msg: 'Error to inviting' };
      });
  }

  accept(channel, username) {
    var authOptions = {
      method: 'PUT',
      url: 'https://api-' + SENDBIRD_APPID + '.sendbird.com/v3/group_channels/' + channel + '/accept',
      data: JSON.stringify({ user_id: username }),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    };
    return axios(authOptions)
      .then((res) => {
        //  console.log({ channel });
        for (var i in res.data.members) {
          var member = res.data.members[i];
          if (member.user_id === username && channel && username) return { isSuccess: true, msg: 'Join success', channel: channel, user: username };
        }
        return { isSuccess: false, msg: 'Failed to join' };
      })
      .catch((error) => {
        //console.error(error);
        return { isSuccess: false, msg: 'Error accepting' + JSON.stringify(error) };
      });
  }

  async getMyGroups({ user_id }) {
    let response = await axios({
      method: 'GET',
      url:
        `https://api-${SENDBIRD_APPID}.sendbird.com/v3/users/${encodeURI(user_id)}/my_group_channels` +
        '?custom_types=private,public,open&order=latest_last_message&show_empty=true',
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });
    return response?.data?.channels || [];
  }

  async getOthersGroups(user_ids, lang) {
    let response = await axios({
      method: 'GET',
      url:
        `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels` +
        `?members_include_in=${encodeURI(user_ids.join(','))}&custom_types=public,open&query_type=OR&metadata_key=lang&metadata_values=${lang}`,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });
    return response?.data?.channels || [];
  }

  async getMembers(channelUrl) {
    let response = await axios({
      method: 'GET',
      url: `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels/${channelUrl}/members?limit=100`,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });
    return response?.data?.members || [];
  }


  

  async addUserToChannel(channelUrl, user_id) {
    
    await this.invite(channelUrl, user_id);
    try{
      await this.accept(channelUrl, user_id);
    }
    catch(e){
      console.log(`Error accepting invite for ${user_id} to ${channelUrl}`)
    }
    return true;

  }

  async getMembersofPrivateGroups(user_id){

    /*
      1. Load the custom_type=private study groups this user_id is in
      2. Load the members of each of those groups
      3. Return a unique list of user_ids
    */
   let channels = await axios({
    method: 'GET',
     url: `https://api-${SENDBIRD_APPID}.sendbird.com/v3/users/${user_id}/my_group_channels?custom_types=private&limit=100`,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });


   let members = await Promise.all(channels.data.channels.map(async (channel)=>{
      let members = await axios({
        method: 'GET',
        url: `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels/${channel.channel_url}/members?limit=100`,
        headers: {
          'Api-Token': SENDBIRD_TOKEN,
          'Content-Type': 'application/json'
        },
        json: true
      });
      return members.data.members.map((m)=>{return {...m,channel_name:channel.name}});
    }));

    return members.flat().map(i=>i.user_id).filter(x=>!!x); 


  }

  async getMembersofPublicGroups(){

    let channels = await axios({
      method: 'GET',
      url: `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels?custom_types=public,open&limit=100`,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });

    let members = await Promise.all(channels.data.channels.map(async (channel)=>{
      let members = await axios({
        method: 'GET',
        url: `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels/${channel.channel_url}/members?limit=100`,
        headers: {
          'Api-Token': SENDBIRD_TOKEN,
          'Content-Type': 'application/json'
        },
        json: true
      });
      return members.data.members.map((m)=>{return {...m,channel_name:channel.name}});
    }));

    
    let combined =  members.flat();
    let unique = combined.filter((v,i,a)=>a.findIndex(t=>(t.user_id === v.user_id))===i);
    return unique.map(i=>i.user_id);

  }


  async getGroup(channelUrl) {
    let response = await axios({
      method: 'GET',
      url: `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels/${channelUrl}`,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });
    return response?.data || {};
  }
  async getThread({ channelUrl, messageId }) {
    let now = Math.round(Date.now() / 1);
    let response = await axios({
      method: 'GET',
      url:
        `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels/${channelUrl}/messages` +
        `?message_ts=${now}&include_reply_type=ALL&parent_message_id=${messageId}`,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });

    return response?.data?.messages;
  }

  async replyToMessage({ channelUrl, messageId, user_id, message }) {
    let response = await axios({
      method: 'POST',
      url: `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels/${channelUrl}/messages`,
      data: JSON.stringify({
        message_type: 'MESG',
        user_id: user_id,
        message: message,
        parent_message_id: messageId
      }),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });
    //log curl
   //console.log(`curl -X POST "https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels/${channelUrl}/messages" -H "accept: application/json" -H "Api-Token: ${SENDBIRD_TOKEN}" -H "Content-Type: application/json" -d "{\\"message_type\\":\\"MESG\\",\\"user_id\\":\\"${user_id}\\",\\"message\\":\\"${message}\\",\\"parent_message_id\\":\\"${messageId}\\"}"`)
    return response?.data || {};

  }
  
  async startStopTypingIndicator(channelUrl, user_ids, typing) {

    let response = await axios({
      method: typing ? 'POST' : 'DELETE',
      url: `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels/${channelUrl}/typing`,
      data: JSON.stringify({
        user_ids: [user_ids]
      }),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });
    return response?.data || {};

  }

  async updateUserMetadata(user_id, metadata) {
    let response = await axios({
      method: 'PUT',
      url: `https://api-${SENDBIRD_APPID}.sendbird.com/v3/users/${user_id}/metadata`,
      data: JSON.stringify({
        metadata: metadata,
        upsert: true
      }),
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });
    return response?.data || {};
  }


  async getLatestMessage(channelUrl) {
    let now = Math.round(Date.now() / 1);
    let response = await axios({
      method: 'GET',
      url:
        `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels/${channelUrl}/messages` +
        `?message_ts=${now}&reverse=true&include_thread_info=true&include_reactions=true&message_type=MESG&limit=1`,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });
    return response?.data?.messages?.shift() || [];
  }

  async getGroupMessages(channelUrl) {
    let now = Math.round(Date.now() / 1);
    let response = await axios({
      method: 'GET',
      url:
        `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels/${channelUrl}/messages` +
        `?message_ts=${now}&reverse=true&include_thread_info=true&include_reactions=true&message_type=MESG&limit=100`,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });
    return response?.data?.messages || [];
  }

  async getGroupMessageById(channelUrl, message_id) {
    const url =
      `https://api-${SENDBIRD_APPID}.sendbird.com/v3/group_channels/${channelUrl}/messages/${message_id}` +
      `?include_thread_info=true&include_reactions=true&message_type=MESG&limit=1`;
    let response = await axios({
      method: 'GET',
      url: url,
      headers: {
        'Api-Token': SENDBIRD_TOKEN,
        'Content-Type': 'application/json'
      },
      json: true
    });
    return response?.data || {};
  }
}

var sendbird = new Sendbird();

async function getFwdUrl(url) {
  return axios.get(url).then(r => r.request.res.responseUrl.replace(/\?.*?$/, ''));
}


function checkExistsWithTimeout(path, timeout) {
  return new Promise((resolve, reject) => {
    const timeoutTimerId = setTimeout(handleTimeout, timeout)
    const interval = timeout / 6
    let intervalTimerId

    function handleTimeout() {
      clearTimeout(timeoutTimerId)

      const error = new Error('path check timed out')
      error.name = 'PATH_CHECK_TIMED_OUT'
      reject(error)
    }

    function handleInterval() {
      fs.access(path, (err) => {
        if(err) {
          intervalTimerId = setTimeout(handleInterval, interval)
        } else {
          clearTimeout(timeoutTimerId)
          resolve(path)
        }
      })
    }

    intervalTimerId = setTimeout(handleInterval, interval)
  })
}

module.exports = { sendbird, getFwdUrl };