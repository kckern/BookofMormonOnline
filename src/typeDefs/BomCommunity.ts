
// Login, password CRUD, progress history, log

import { gql } from 'apollo-server-express';

export default gql`
# -----------------------------------------------
# Queries
# -----------------------------------------------

extend type Query {

  studygrouphistory(token: String, studyGroupID: String): StudyGroupHistory
  loadGroupsFromHash(hash:[String]): [StudyGroup]
  homefeed(token:String,channel: [String],message: [String]): HomeFeed 
  homethread(token:String,channel: String,message: String): [HomeFeedItem] 
  homegroups(token:String, grouping:String): [HomeGroup]
  postcomments(token:String,message: Int): [HomeFeedItem] 
  moregroups(token:String, grouping:String): [HomeGroup]
  requestedUsers(token:String, channel:String): [HomeUser]
  leaderboard(token:String): LeaderBoard
  botlist: [Bot]
}


extend type Mutation {
  joinGroup(token:String,hash:String): JoinedGroup
  joinOpenGroup(token:String,url:String): JoinedGroup
  requestToJoinGroup(token:String,url:String): JoinedGroup
  withdrawRequest(token:String,url:String): JoinedGroup
  processRequest(token:String,channel:String,user_id:String,grant:Boolean): Boolean
  addBot(token:String,channel:String,bot:String): Boolean
  removeBot(token:String,channel:String,bot:String): Boolean
}



  # -----------------------------------------------
  # TYPES
  # -----------------------------------------------


  type StudyGroupHistory
  {
    studyGroupID: String
    studyGroupName: String
    dates: [String]
    userHistories: [UserHistory]
  }

  type LeaderBoard
  {
    recentFinishers: [HomeUser],
    currentProgress: [HomeUser]
  }
  
  
  type StudyGroup
  {
    name: String
    member_count: Float
    custom_type: String
    channel_url: String
    created_at: Float
    cover_url: String
    max_length_message: Float
    data: String
    messages: [Message]
    members: [SendbirdUser]
  }

  type Message
  {
    message_survival_seconds: Float
    custom_type: String
    mentioned_users: [SendbirdUser]
    updated_at: Float,
    is_op_msg: Boolean,
    is_removed: Boolean,
    user: SendbirdUser,
    message: String
    data:  String
    message_retention_hour: Float
    silent: Boolean
    type: String
    created_at: Float,
    channel_type: String
    mention_type: String
    channel_url: String
    message_id: Float
  }

  type SendbirdUser
  {
    user_id: String
    is_active: Boolean
    joined_ts: Boolean
    state: String
    role: String
    is_online: Boolean
    require_auth_for_profile_image: Boolean
    last_seen_at: Boolean
    nickname: String
    profile_url: String
    metadata: SendbirdUserMetadata
  }

  type SendbirdUserMetadata
  {
    summary: String
    bookmark: String
  }

  type JoinedGroup
  {
    isSuccess: Boolean
    msg: String
    channel: String
    user: String
  }

  type HomeFeed
  {
    groups: [HomeGroup]
    feed: [HomeFeedItem]
  }

  type HomeFeedItem
  {
    channel_url: String
    id: Float
    timestamp: Float
    msg: String
    user: HomeUser
    mentioned_users: [HomeUser]
    likes: [String]
    replycount: Int
    repliers: [HomeUser]
    link: ContentLink
    highlights: [String]
  }

  type HomeUser
  {
    user_id: String
    nickname: String
    picture: String
    progress: Float
    finished: [Float]
    lastseen: Float
    laststudied: String
    bookmark: String
    public: Boolean
  }

  type ContentLink
  {
    key: String
    val: String
  }


  type Bot
  {
    id: String
    name: String
    description: String
    picture: String
    enabled: Boolean
  }


  type HomeGroup
  {
    grouping: String
    url: String
    name: String
    description: String
    privacy: String
    picture: String
    latest: HomeFeedItem
    requests: [String]
    members: [HomeUser]
  }


`


/*

SQL for top users:


SELECT `user`, MAX(`timestamp`) as `latest`
FROM `bom_log`
WHERE `timestamp` > UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 30 day))
AND `user` NOT REGEXP '^[a-f0-9]{32}$'
AND type = 'block'
Group by `user`
Order by `latest` DESC
LIMIT 10



*/