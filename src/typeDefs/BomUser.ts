
// Login, password CRUD, progress history, log

import { gql } from 'apollo-server-express';

export default gql`
# -----------------------------------------------
# Queries
# -----------------------------------------------

  extend type Query {
    user(token: [String]): User
    generateToken(seed: Int): String
    signin(token: String, username: String, password: String): SignIn
    tokensignin(token: String): SignIn
    socialsignin(network: String, token: String, social_token: String): SignIn\
    users(user_ids: [String]): [User]
    sourceUsage(token: String, source: String): Float
    studylog(token: String): StudyLog
    pageprogress(token: String, slug: [String]): [ProgressScore]
    userprogress(token: String): ProgressScore
    userdailyscores(token:String): UserDailyScore
    closetab(token:String): [String]
    test: Test
  }


extend type Mutation {
    log( token: String!,key: String!, val: String): LogResult
    changePassword(token: String, password: String): Boolean
    signup(token: String,  username: String, password: String, name: String, email: String, zip: String): SignIn
    signout(token: String): Boolean
    editProfile(token: String, name: String, email: String, zip: String): User
  }


  # -----------------------------------------------
  # TYPES
  # -----------------------------------------------

type SignIn {
  isSuccess: Boolean
  msg: String
  user: User
  social: Social
  profile_url: String
}


type Test {
  db: String
  http: String
  http2: String
}

type Social {
  user_id: String
  nickname: String
  profile_url: String
  access_token: String
}

type LogResult {
  logged: Boolean
  progress: ProgressScore
}

type User {
  user: String
  email: String
  name: String
  bookmark: String
  zip: String
  complete: Float
  started: Float
  time: Float
  finished: Float
  sessions: Int
  social: Social
  progress: ProgressScore
  history: [UserHistory]
  networks: [Network]
}

type UserDailyScore {
  dates: [String]
  progress: [Float]
}

type Network {
  network: String
  social_id: String
}


type ProgressScore {
  slug: String
  count: Float
  started: Float
  completed: Float
  started_items: [Float]
  completed_items: [Float]
  active_items: [Float]
  summary: UserStudySummary
}

type UserHistory {
  user: String
  dates: [String]
  completed: [Float]
}


type StudyLog {
  sessions: [UserSession]
  summary: UserStudySummary
}
type UserSession {
  timestamp: Float
  datetime: String
  duration: Float
  description: String
  slug: String
}


type UserStudySummary {
  first: Float
  duration: Float
  count: Float
  finished: [Float]
}

`

