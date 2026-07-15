import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { AppContext } from '../src/graphql/context.js';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  JSON: { input: unknown; output: unknown; }
};

export type Book = {
  __typename?: 'Book';
  book?: Maybe<Scalars['String']['output']>;
  chapters?: Maybe<Array<Maybe<Scalars['Int']['output']>>>;
};

export type Bot = {
  __typename?: 'Bot';
  description?: Maybe<Scalars['String']['output']>;
  enabled?: Maybe<Scalars['Boolean']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  picture?: Maybe<Scalars['String']['output']>;
};

export type Caps = {
  __typename?: 'Caps';
  description?: Maybe<Scalars['String']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  link?: Maybe<Scalars['String']['output']>;
  parent?: Maybe<Scalars['String']['output']>;
  reference?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
};

export type Chiasmus = {
  __typename?: 'Chiasmus';
  chiasmus_id?: Maybe<Scalars['String']['output']>;
  lines?: Maybe<Array<Maybe<ChiasmusLine>>>;
  reference?: Maybe<Scalars['String']['output']>;
  scheme?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type ChiasmusLine = {
  __typename?: 'ChiasmusLine';
  guid?: Maybe<Scalars['String']['output']>;
  highlights?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  line_key?: Maybe<Scalars['String']['output']>;
  line_text?: Maybe<Scalars['String']['output']>;
};

export type Commentary = {
  __typename?: 'Commentary';
  id?: Maybe<Scalars['String']['output']>;
  location?: Maybe<TextBlock>;
  preview?: Maybe<Scalars['String']['output']>;
  publication?: Maybe<Source>;
  reference?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  verse_id?: Maybe<Scalars['String']['output']>;
  verse_range?: Maybe<Scalars['String']['output']>;
};

export type Conn = {
  __typename?: 'Conn';
  guid?: Maybe<Scalars['String']['output']>;
  isPage?: Maybe<Scalars['Boolean']['output']>;
  link?: Maybe<Scalars['String']['output']>;
  parent?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
};

export type ContentLink = {
  __typename?: 'ContentLink';
  key?: Maybe<Scalars['String']['output']>;
  val?: Maybe<Scalars['String']['output']>;
};

export type Division = {
  __typename?: 'Division';
  description?: Maybe<Scalars['String']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  link?: Maybe<Scalars['String']['output']>;
  page?: Maybe<Scalars['String']['output']>;
  pages?: Maybe<Array<Maybe<Page>>>;
  progress?: Maybe<ProgressScore>;
  slug?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  titlepage?: Maybe<Page>;
  weight?: Maybe<Scalars['Int']['output']>;
};


export type DivisionProgressArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};

export type Event = {
  __typename?: 'Event';
  date?: Maybe<Scalars['String']['output']>;
  file?: Maybe<Scalars['String']['output']>;
  grid?: Maybe<EventGrid>;
  h?: Maybe<Scalars['Float']['output']>;
  heading?: Maybe<Scalars['String']['output']>;
  html?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  /**
   * Translated short display label for the grid tile, routed by label_category:
   * people/place reuse the entity's translated name; event uses heading.
   */
  label?: Maybe<Scalars['String']['output']>;
  link?: Maybe<Scalars['String']['output']>;
  narr?: Maybe<Scalars['String']['output']>;
  o?: Maybe<Scalars['Float']['output']>;
  p?: Maybe<Scalars['Boolean']['output']>;
  reference?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  text?: Maybe<TextBlock>;
  w?: Maybe<Scalars['Float']['output']>;
  x?: Maybe<Scalars['Float']['output']>;
  y?: Maybe<Scalars['Float']['output']>;
  z?: Maybe<Scalars['Float']['output']>;
};

/**
 * Event grid placement for the tile-grid timeline (null until backfilled).
 * Only events are placed here; pins/bands/dates are the frontend canvas.
 */
export type EventGrid = {
  __typename?: 'EventGrid';
  /** Label anchor within/around the tile: center|start|end|above|below. Null → center. */
  anchor?: Maybe<Scalars['String']['output']>;
  bg?: Maybe<Scalars['String']['output']>;
  col?: Maybe<Scalars['Int']['output']>;
  colSpan?: Maybe<Scalars['Int']['output']>;
  /** Movement direction for migration/expedition bars: l|r. Null → none. */
  dir?: Maybe<Scalars['String']['output']>;
  /**
   * Marker icon (battle|ship|question, extensible). Non-null → the event renders
   * as a marker medallion via the marker path, NOT as a chip/bar, and never stamps
   * the compositor bar layer.
   */
  icon?: Maybe<Scalars['String']['output']>;
  row?: Maybe<Scalars['Int']['output']>;
  rowSpan?: Maybe<Scalars['Int']['output']>;
  /** Zoom LOD tier: 1 band names (always visible) · 2 major · 3 detail. Null → by kind. */
  tier?: Maybe<Scalars['Int']['output']>;
};

export type Fax = {
  __typename?: 'Fax';
  bgcolor?: Maybe<Scalars['String']['output']>;
  code?: Maybe<Scalars['String']['output']>;
  com?: Maybe<Scalars['Int']['output']>;
  fax?: Maybe<Scalars['Int']['output']>;
  format?: Maybe<Scalars['String']['output']>;
  hide?: Maybe<Scalars['String']['output']>;
  index?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  indexRef?: Maybe<Scalars['String']['output']>;
  info?: Maybe<Scalars['String']['output']>;
  pages?: Maybe<Scalars['Int']['output']>;
  pgfirstVerse?: Maybe<Scalars['Int']['output']>;
  pgoffset?: Maybe<Scalars['Int']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type FaxIndex = {
  __typename?: 'FaxIndex';
  pages?: Maybe<Array<Maybe<Array<Maybe<Scalars['Int']['output']>>>>>;
  slug?: Maybe<Scalars['String']['output']>;
};

export type HighlightRange = {
  __typename?: 'HighlightRange';
  end?: Maybe<Scalars['Int']['output']>;
  start?: Maybe<Scalars['Int']['output']>;
};

export type HistoricalDocument = {
  __typename?: 'HistoricalDocument';
  archive?: Maybe<Scalars['String']['output']>;
  aspect?: Maybe<Scalars['Float']['output']>;
  author?: Maybe<Scalars['String']['output']>;
  citation?: Maybe<Scalars['String']['output']>;
  date?: Maybe<Scalars['String']['output']>;
  document?: Maybe<Scalars['String']['output']>;
  event_date?: Maybe<Scalars['String']['output']>;
  event_year?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  link?: Maybe<Scalars['String']['output']>;
  pages?: Maybe<Scalars['Int']['output']>;
  principal?: Maybe<Scalars['String']['output']>;
  seq?: Maybe<Scalars['Int']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  source?: Maybe<Scalars['String']['output']>;
  teaser?: Maybe<Scalars['String']['output']>;
  transcript?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  year?: Maybe<Scalars['Int']['output']>;
};

export type HomeFeed = {
  __typename?: 'HomeFeed';
  feed?: Maybe<Array<Maybe<HomeFeedItem>>>;
  groups?: Maybe<Array<Maybe<HomeGroup>>>;
};

export type HomeFeedItem = {
  __typename?: 'HomeFeedItem';
  channel_url?: Maybe<Scalars['String']['output']>;
  highlights?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  id?: Maybe<Scalars['Float']['output']>;
  likes?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  link?: Maybe<ContentLink>;
  mentioned_users?: Maybe<Array<Maybe<HomeUser>>>;
  msg?: Maybe<Scalars['String']['output']>;
  repliers?: Maybe<Array<Maybe<HomeUser>>>;
  replycount?: Maybe<Scalars['Int']['output']>;
  timestamp?: Maybe<Scalars['Float']['output']>;
  user?: Maybe<HomeUser>;
};

export type HomeGroup = {
  __typename?: 'HomeGroup';
  description?: Maybe<Scalars['String']['output']>;
  grouping?: Maybe<Scalars['String']['output']>;
  latest?: Maybe<HomeFeedItem>;
  members?: Maybe<Array<Maybe<HomeUser>>>;
  name?: Maybe<Scalars['String']['output']>;
  picture?: Maybe<Scalars['String']['output']>;
  privacy?: Maybe<Scalars['String']['output']>;
  requests?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  url?: Maybe<Scalars['String']['output']>;
};

export type HomeSampler = {
  __typename?: 'HomeSampler';
  commentary?: Maybe<Commentary>;
  contents?: Maybe<Division>;
  fax?: Maybe<Fax>;
  people?: Maybe<Array<Maybe<People>>>;
  places?: Maybe<Array<Maybe<Place>>>;
  seed?: Maybe<Scalars['Int']['output']>;
};

export type HomeUser = {
  __typename?: 'HomeUser';
  bookmark?: Maybe<Scalars['String']['output']>;
  finished?: Maybe<Array<Maybe<Scalars['Float']['output']>>>;
  isBot?: Maybe<Scalars['Boolean']['output']>;
  lastseen?: Maybe<Scalars['Float']['output']>;
  laststudied?: Maybe<Scalars['String']['output']>;
  nickname?: Maybe<Scalars['String']['output']>;
  picture?: Maybe<Scalars['String']['output']>;
  progress?: Maybe<Scalars['Float']['output']>;
  public?: Maybe<Scalars['Boolean']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

export type Image = {
  __typename?: 'Image';
  artist?: Maybe<Scalars['String']['output']>;
  file?: Maybe<Scalars['String']['output']>;
  height?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  link?: Maybe<Scalars['String']['output']>;
  location?: Maybe<TextBlock>;
  title?: Maybe<Scalars['String']['output']>;
  width?: Maybe<Scalars['Int']['output']>;
};

export type Index = {
  __typename?: 'Index';
  pkey?: Maybe<Scalars['String']['output']>;
  ref?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  verse_id?: Maybe<Scalars['String']['output']>;
  verse_id_end?: Maybe<Scalars['String']['output']>;
};

export type JoinedGroup = {
  __typename?: 'JoinedGroup';
  channel?: Maybe<Scalars['String']['output']>;
  isSuccess?: Maybe<Scalars['Boolean']['output']>;
  msg?: Maybe<Scalars['String']['output']>;
  user?: Maybe<Scalars['String']['output']>;
};

export type Label = {
  __typename?: 'Label';
  key?: Maybe<Scalars['String']['output']>;
  val?: Maybe<Scalars['String']['output']>;
};

export type LeaderBoard = {
  __typename?: 'LeaderBoard';
  currentProgress?: Maybe<Array<Maybe<HomeUser>>>;
  recentFinishers?: Maybe<Array<Maybe<HomeUser>>>;
};

export type LogResult = {
  __typename?: 'LogResult';
  logged?: Maybe<Scalars['Boolean']['output']>;
  progress?: Maybe<ProgressScore>;
};

export type Map = {
  __typename?: 'Map';
  centerx?: Maybe<Scalars['Float']['output']>;
  centery?: Maybe<Scalars['Float']['output']>;
  desc?: Maybe<Scalars['String']['output']>;
  group?: Maybe<Scalars['String']['output']>;
  maxzoom?: Maybe<Scalars['Int']['output']>;
  minzoom?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  places?: Maybe<Array<Maybe<Place>>>;
  slug?: Maybe<Scalars['String']['output']>;
  tiles?: Maybe<Scalars['Boolean']['output']>;
  zoom?: Maybe<Scalars['Int']['output']>;
};

export type MapMove = {
  __typename?: 'MapMove';
  description?: Maybe<Scalars['String']['output']>;
  duration?: Maybe<Scalars['String']['output']>;
  end?: Maybe<Scalars['String']['output']>;
  endPlace?: Maybe<Place>;
  guid?: Maybe<Scalars['String']['output']>;
  people?: Maybe<Array<Maybe<People>>>;
  seq?: Maybe<Scalars['Int']['output']>;
  start?: Maybe<Scalars['String']['output']>;
  startPlace?: Maybe<Place>;
  travelers?: Maybe<Scalars['String']['output']>;
  verse_ids?: Maybe<Array<Maybe<Scalars['Int']['output']>>>;
};

export type MapStory = {
  __typename?: 'MapStory';
  description?: Maybe<Scalars['String']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  moves?: Maybe<Array<Maybe<MapMove>>>;
  slug?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type Markdown = {
  __typename?: 'Markdown';
  markdown?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
};

export type Menu = {
  __typename?: 'Menu';
  label?: Maybe<Scalars['String']['output']>;
  link?: Maybe<Scalars['String']['output']>;
};

export type Message = {
  __typename?: 'Message';
  channel_type?: Maybe<Scalars['String']['output']>;
  channel_url?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['Float']['output']>;
  custom_type?: Maybe<Scalars['String']['output']>;
  data?: Maybe<Scalars['String']['output']>;
  is_op_msg?: Maybe<Scalars['Boolean']['output']>;
  is_removed?: Maybe<Scalars['Boolean']['output']>;
  mention_type?: Maybe<Scalars['String']['output']>;
  mentioned_users?: Maybe<Array<Maybe<SendbirdUser>>>;
  message?: Maybe<Scalars['String']['output']>;
  message_id?: Maybe<Scalars['Float']['output']>;
  message_retention_hour?: Maybe<Scalars['Float']['output']>;
  message_survival_seconds?: Maybe<Scalars['Float']['output']>;
  silent?: Maybe<Scalars['Boolean']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['Float']['output']>;
  user?: Maybe<SendbirdUser>;
};

export type MessengerChannel = {
  __typename?: 'MessengerChannel';
  channel_url?: Maybe<Scalars['String']['output']>;
  cover_url?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['Float']['output']>;
  custom_type?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  lang?: Maybe<Scalars['String']['output']>;
  last_message?: Maybe<MessengerMessage>;
  member_count?: Maybe<Scalars['Int']['output']>;
  members?: Maybe<Array<Maybe<MessengerMember>>>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  unread_message_count?: Maybe<Scalars['Int']['output']>;
};

export type MessengerMember = {
  __typename?: 'MessengerMember';
  is_bot?: Maybe<Scalars['Boolean']['output']>;
  is_muted?: Maybe<Scalars['Boolean']['output']>;
  is_online?: Maybe<Scalars['Boolean']['output']>;
  last_seen_at?: Maybe<Scalars['Float']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  nickname?: Maybe<Scalars['String']['output']>;
  profile_url?: Maybe<Scalars['String']['output']>;
  role?: Maybe<Scalars['String']['output']>;
  state?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

export type MessengerMessage = {
  __typename?: 'MessengerMessage';
  channel_url?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['Float']['output']>;
  custom_type?: Maybe<Scalars['String']['output']>;
  data?: Maybe<Scalars['String']['output']>;
  link_target?: Maybe<Scalars['String']['output']>;
  link_type?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  message_id?: Maybe<Scalars['String']['output']>;
  message_type?: Maybe<Scalars['String']['output']>;
  parent_message_id?: Maybe<Scalars['String']['output']>;
  reactions?: Maybe<Array<Maybe<MessengerReaction>>>;
  thread_info?: Maybe<MessengerThreadInfo>;
  updated_at?: Maybe<Scalars['Float']['output']>;
  user?: Maybe<MessengerUser>;
  user_id?: Maybe<Scalars['String']['output']>;
};

export type MessengerPageComments = {
  __typename?: 'MessengerPageComments';
  counts?: Maybe<Scalars['JSON']['output']>;
  messages?: Maybe<Array<Maybe<MessengerMessage>>>;
};

export type MessengerReaction = {
  __typename?: 'MessengerReaction';
  reaction_key?: Maybe<Scalars['String']['output']>;
  user_ids?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
};

export type MessengerThreadInfo = {
  __typename?: 'MessengerThreadInfo';
  most_replied_users?: Maybe<Array<Maybe<MessengerUser>>>;
  reply_count?: Maybe<Scalars['Int']['output']>;
};

export type MessengerUnreadDm = {
  __typename?: 'MessengerUnreadDM';
  channel_url?: Maybe<Scalars['String']['output']>;
  other_user_id?: Maybe<Scalars['String']['output']>;
  unread_count?: Maybe<Scalars['Int']['output']>;
};

export type MessengerUser = {
  __typename?: 'MessengerUser';
  is_bot?: Maybe<Scalars['Boolean']['output']>;
  is_online?: Maybe<Scalars['Boolean']['output']>;
  last_seen_at?: Maybe<Scalars['Float']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  nickname?: Maybe<Scalars['String']['output']>;
  profile_url?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  _?: Maybe<Scalars['Boolean']['output']>;
  addBot?: Maybe<Scalars['Boolean']['output']>;
  changePassword?: Maybe<Scalars['Boolean']['output']>;
  editProfile?: Maybe<User>;
  endReadingPlan?: Maybe<ReadingPlanResult>;
  joinGroup?: Maybe<JoinedGroup>;
  joinOpenGroup?: Maybe<JoinedGroup>;
  log?: Maybe<LogResult>;
  markAllNotificationsRead?: Maybe<Scalars['Boolean']['output']>;
  markNotificationRead?: Maybe<Scalars['Boolean']['output']>;
  messengerAcceptInvitation?: Maybe<Scalars['Boolean']['output']>;
  messengerBanMember?: Maybe<Scalars['Boolean']['output']>;
  messengerCreateChannel?: Maybe<MessengerChannel>;
  messengerDeclineInvitation?: Maybe<Scalars['Boolean']['output']>;
  messengerInviteMembers?: Maybe<Scalars['Boolean']['output']>;
  messengerRemoveMember?: Maybe<Scalars['Boolean']['output']>;
  messengerSetMute?: Maybe<Scalars['Boolean']['output']>;
  messengerUnbanMember?: Maybe<Scalars['Boolean']['output']>;
  messengerUpdateChannel?: Maybe<MessengerChannel>;
  messengerUpdateMemberRole?: Maybe<Scalars['Boolean']['output']>;
  messengerUpdateUser?: Maybe<MessengerUser>;
  messengerUpdateUserMetadata?: Maybe<Scalars['Boolean']['output']>;
  ping?: Maybe<Scalars['Boolean']['output']>;
  processRequest?: Maybe<Scalars['Boolean']['output']>;
  removeBot?: Maybe<Scalars['Boolean']['output']>;
  requestToJoinGroup?: Maybe<JoinedGroup>;
  shortlink?: Maybe<Shortlinks>;
  signout?: Maybe<Scalars['Boolean']['output']>;
  signup?: Maybe<SignIn>;
  startReadingPlan?: Maybe<ReadingPlanResult>;
  updateReadingPlan?: Maybe<ReadingPlanResult>;
  uploadProfileImage?: Maybe<Scalars['Boolean']['output']>;
  withdrawRequest?: Maybe<JoinedGroup>;
};


export type MutationAddBotArgs = {
  bot?: InputMaybe<Scalars['String']['input']>;
  channel?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type MutationChangePasswordArgs = {
  password?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type MutationEditProfileArgs = {
  email?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
  zip?: InputMaybe<Scalars['String']['input']>;
};


export type MutationEndReadingPlanArgs = {
  action: PlanEndAction;
  token: Scalars['String']['input'];
};


export type MutationJoinGroupArgs = {
  hash?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type MutationJoinOpenGroupArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
};


export type MutationLogArgs = {
  key: Scalars['String']['input'];
  token: Scalars['String']['input'];
  val?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMarkNotificationReadArgs = {
  notificationId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMessengerAcceptInvitationArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMessengerBanMemberArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMessengerCreateChannelArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  coverUrl?: InputMaybe<Scalars['String']['input']>;
  customType?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  isDistinct?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  operatorIds?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  userIds?: InputMaybe<Array<Scalars['String']['input']>>;
};


export type MutationMessengerDeclineInvitationArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMessengerInviteMembersArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  userIds?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type MutationMessengerRemoveMemberArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMessengerSetMuteArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  muted?: InputMaybe<Scalars['Boolean']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMessengerUnbanMemberArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMessengerUpdateChannelArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  membersCanInvite?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMessengerUpdateMemberRoleArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMessengerUpdateUserArgs = {
  nickname?: InputMaybe<Scalars['String']['input']>;
  profileUrl?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMessengerUpdateUserMetadataArgs = {
  metadata?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationPingArgs = {
  data?: InputMaybe<Scalars['String']['input']>;
};


export type MutationProcessRequestArgs = {
  channel?: InputMaybe<Scalars['String']['input']>;
  grant?: InputMaybe<Scalars['Boolean']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
};


export type MutationRemoveBotArgs = {
  bot?: InputMaybe<Scalars['String']['input']>;
  channel?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type MutationRequestToJoinGroupArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
};


export type MutationShortlinkArgs = {
  string?: InputMaybe<Scalars['String']['input']>;
};


export type MutationSignoutArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};


export type MutationSignupArgs = {
  email?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  password?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
  username?: InputMaybe<Scalars['String']['input']>;
  zip?: InputMaybe<Scalars['String']['input']>;
};


export type MutationStartReadingPlanArgs = {
  input: StartPlanInput;
  token: Scalars['String']['input'];
};


export type MutationUpdateReadingPlanArgs = {
  input: UpdatePlanInput;
  token: Scalars['String']['input'];
};


export type MutationUploadProfileImageArgs = {
  imageData: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationWithdrawRequestArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
};

export type Narration = {
  __typename?: 'Narration';
  description?: Maybe<Scalars['String']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  parent?: Maybe<Scalars['String']['output']>;
  section?: Maybe<Section>;
  text?: Maybe<TextBlock>;
  timeline?: Maybe<Event>;
};

export type NarrativePath = {
  __typename?: 'NarrativePath';
  narration?: Maybe<Scalars['String']['output']>;
  nextclass?: Maybe<Scalars['String']['output']>;
  page?: Maybe<Scalars['String']['output']>;
  section?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Scalars['String']['output']>;
};

export type Network = {
  __typename?: 'Network';
  network?: Maybe<Scalars['String']['output']>;
  social_id?: Maybe<Scalars['String']['output']>;
};

export type Note = {
  __typename?: 'Note';
  id?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type Notification = {
  __typename?: 'Notification';
  actor?: Maybe<MessengerUser>;
  channel_url?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['Float']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  is_read?: Maybe<Scalars['Boolean']['output']>;
  message_id?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
};

export type Object = {
  __typename?: 'Object';
  aliases?: Maybe<Scalars['String']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  era?: Maybe<Scalars['String']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  index?: Maybe<Array<Maybe<Index>>>;
  name?: Maybe<Scalars['String']['output']>;
  provenance?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  specificity?: Maybe<Scalars['String']['output']>;
  subtitle?: Maybe<Scalars['String']['output']>;
  tags?: Maybe<Scalars['String']['output']>;
  usage?: Maybe<Scalars['String']['output']>;
  verse_id?: Maybe<Scalars['Int']['output']>;
  weight?: Maybe<Scalars['Int']['output']>;
  xrels?: Maybe<Array<Maybe<Xrel>>>;
};

export type Page = {
  __typename?: 'Page';
  counts?: Maybe<Array<Maybe<Scalars['Int']['output']>>>;
  guid?: Maybe<Scalars['String']['output']>;
  parent?: Maybe<Scalars['String']['output']>;
  progress?: Maybe<ProgressScore>;
  ref?: Maybe<Scalars['String']['output']>;
  sections?: Maybe<Array<Maybe<Section>>>;
  slug?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Array<Maybe<TextBlock>>>;
  title?: Maybe<Scalars['String']['output']>;
  weight?: Maybe<Scalars['Int']['output']>;
};


export type PageProgressArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};

export type Passage = {
  __typename?: 'Passage';
  heading?: Maybe<Scalars['String']['output']>;
  meta?: Maybe<Array<Maybe<SectionMeta>>>;
  reference?: Maybe<Scalars['String']['output']>;
  verses?: Maybe<Array<Maybe<Scripture>>>;
};

export type PassageNotes = {
  __typename?: 'PassageNotes';
  chiasmus?: Maybe<Array<Maybe<Chiasmus>>>;
  commentary?: Maybe<Array<Maybe<Commentary>>>;
  fax?: Maybe<Array<Maybe<Fax>>>;
  images?: Maybe<Array<Maybe<Image>>>;
  mapstory?: Maybe<Array<Maybe<MapStory>>>;
  notes?: Maybe<Array<Maybe<Note>>>;
  objects?: Maybe<Array<Maybe<Object>>>;
  people?: Maybe<Array<Maybe<People>>>;
  places?: Maybe<Array<Maybe<Place>>>;
  refs?: Maybe<Array<Maybe<Reference>>>;
  sources?: Maybe<Array<Maybe<Source>>>;
};

export type People = {
  __typename?: 'People';
  classification?: Maybe<Scalars['String']['output']>;
  date?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  identification?: Maybe<Scalars['String']['output']>;
  index?: Maybe<Array<Maybe<Index>>>;
  name?: Maybe<Scalars['String']['output']>;
  relations?: Maybe<Array<Maybe<Relation>>>;
  slug?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  unit?: Maybe<Scalars['String']['output']>;
};

export type PeopleLink = {
  __typename?: 'PeopleLink';
  charge?: Maybe<Scalars['Float']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  source?: Maybe<Scalars['Int']['output']>;
  strokeColor?: Maybe<Scalars['String']['output']>;
  strokeWidth?: Maybe<Scalars['Float']['output']>;
  target?: Maybe<Scalars['Int']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
};

export type PeopleNetwork = {
  __typename?: 'PeopleNetwork';
  links?: Maybe<Array<Maybe<PeopleLink>>>;
  nodes?: Maybe<Array<Maybe<PeopleNode>>>;
};

export type PeopleNode = {
  __typename?: 'PeopleNode';
  charge?: Maybe<Scalars['Float']['output']>;
  classif?: Maybe<Scalars['String']['output']>;
  cluster?: Maybe<Scalars['String']['output']>;
  degree?: Maybe<Scalars['Float']['output']>;
  fill?: Maybe<Scalars['String']['output']>;
  group?: Maybe<Scalars['String']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  radius?: Maybe<Scalars['Float']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  stroke?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  unit?: Maybe<Scalars['String']['output']>;
};

export type Place = {
  __typename?: 'Place';
  aka?: Maybe<Scalars['String']['output']>;
  ax?: Maybe<Scalars['Int']['output']>;
  ay?: Maybe<Scalars['Int']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  h?: Maybe<Scalars['Int']['output']>;
  icon?: Maybe<Scalars['String']['output']>;
  index?: Maybe<Array<Maybe<Index>>>;
  info?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  lat?: Maybe<Scalars['Float']['output']>;
  lng?: Maybe<Scalars['Float']['output']>;
  location?: Maybe<Scalars['String']['output']>;
  maps?: Maybe<Array<Maybe<Map>>>;
  maxZoom?: Maybe<Scalars['Int']['output']>;
  minZoom?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  occupants?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  w?: Maybe<Scalars['Int']['output']>;
};

export enum PlanEndAction {
  Abandon = 'ABANDON',
  Complete = 'COMPLETE'
}

export type PlanWarning = {
  __typename?: 'PlanWarning';
  code?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['Int']['output']>;
};

export type PreviewSegment = {
  __typename?: 'PreviewSegment';
  blocks?: Maybe<Scalars['Int']['output']>;
  duedate?: Maybe<Scalars['String']['output']>;
  period?: Maybe<Scalars['String']['output']>;
  ref?: Maybe<Scalars['String']['output']>;
};

export type ProgressScore = {
  __typename?: 'ProgressScore';
  active_items?: Maybe<Array<Maybe<Scalars['Float']['output']>>>;
  completed?: Maybe<Scalars['Float']['output']>;
  completed_items?: Maybe<Array<Maybe<Scalars['Float']['output']>>>;
  count?: Maybe<Scalars['Float']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  started?: Maybe<Scalars['Float']['output']>;
  started_items?: Maybe<Array<Maybe<Scalars['Float']['output']>>>;
  summary?: Maybe<UserStudySummary>;
};

export type Query = {
  __typename?: 'Query';
  _?: Maybe<Scalars['Boolean']['output']>;
  books?: Maybe<Array<Maybe<Book>>>;
  botlist?: Maybe<Array<Maybe<Bot>>>;
  chiasmus?: Maybe<Array<Maybe<Chiasmus>>>;
  closetab?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  commentary?: Maybe<Array<Maybe<Commentary>>>;
  division?: Maybe<Array<Maybe<Division>>>;
  fax?: Maybe<Array<Maybe<Fax>>>;
  faxIndex?: Maybe<FaxIndex>;
  generateToken?: Maybe<Scalars['String']['output']>;
  highlight?: Maybe<HighlightRange>;
  history?: Maybe<Array<Maybe<HistoricalDocument>>>;
  homefeed?: Maybe<HomeFeed>;
  homegroups?: Maybe<Array<Maybe<HomeGroup>>>;
  homesampler?: Maybe<HomeSampler>;
  homethread?: Maybe<Array<Maybe<HomeFeedItem>>>;
  image?: Maybe<Array<Maybe<Image>>>;
  labels?: Maybe<Array<Maybe<Label>>>;
  leaderboard?: Maybe<LeaderBoard>;
  loadGroupsFromHash?: Maybe<Array<Maybe<StudyGroup>>>;
  lookup?: Maybe<Array<Maybe<TextBlock>>>;
  maps?: Maybe<Array<Maybe<Map>>>;
  mapstories?: Maybe<Array<Maybe<MapStory>>>;
  mapstory?: Maybe<Array<Maybe<MapStory>>>;
  markdown?: Maybe<Array<Maybe<Markdown>>>;
  menu?: Maybe<Array<Maybe<Menu>>>;
  messengerChannel?: Maybe<MessengerChannel>;
  messengerChannelBannedMembers?: Maybe<Array<Maybe<MessengerMember>>>;
  messengerChannelOperators?: Maybe<Array<Maybe<MessengerUser>>>;
  messengerMessage?: Maybe<MessengerMessage>;
  messengerMessages?: Maybe<Array<Maybe<MessengerMessage>>>;
  messengerMyChannels?: Maybe<Array<Maybe<MessengerChannel>>>;
  messengerThreadMessages?: Maybe<Array<Maybe<MessengerMessage>>>;
  messengerUnreadDMs?: Maybe<Array<Maybe<MessengerUnreadDm>>>;
  messengerUser?: Maybe<MessengerUser>;
  messengerUsers?: Maybe<Array<Maybe<MessengerUser>>>;
  moregroups?: Maybe<Array<Maybe<HomeGroup>>>;
  notificationUnreadCount?: Maybe<Scalars['Int']['output']>;
  notifications?: Maybe<Array<Maybe<Notification>>>;
  object?: Maybe<Array<Maybe<Object>>>;
  page?: Maybe<Array<Maybe<Page>>>;
  pagecomments?: Maybe<MessengerPageComments>;
  pageprogress?: Maybe<Array<Maybe<ProgressScore>>>;
  passagenotes?: Maybe<PassageNotes>;
  people?: Maybe<Array<Maybe<People>>>;
  peoplenetwork?: Maybe<PeopleNetwork>;
  person?: Maybe<Array<Maybe<People>>>;
  place?: Maybe<Array<Maybe<Place>>>;
  places?: Maybe<Array<Maybe<Place>>>;
  postcomments?: Maybe<Array<Maybe<HomeFeedItem>>>;
  publications?: Maybe<Array<Maybe<Source>>>;
  queue?: Maybe<Array<Maybe<TextBlock>>>;
  read?: Maybe<ReadBlock>;
  readingplan?: Maybe<ReadingPlan>;
  readingplanhistory?: Maybe<Array<Maybe<ReadingPlanSummary>>>;
  readingplanpreview?: Maybe<ReadingPlanPreview>;
  readingplanprograms?: Maybe<Array<Maybe<ReadingPlanProgram>>>;
  readingplansegment?: Maybe<ReadingPlanSegment>;
  requestedUsers?: Maybe<Array<Maybe<HomeUser>>>;
  scripture?: Maybe<ScriptureResults>;
  search?: Maybe<Array<Maybe<SearchResult>>>;
  searchAll: SearchAllResult;
  section?: Maybe<Array<Maybe<Section>>>;
  shortlink?: Maybe<Shortlinks>;
  signin?: Maybe<SignIn>;
  socialsignin?: Maybe<SignIn>;
  sourceUsage?: Maybe<Scalars['Float']['output']>;
  sources?: Maybe<Array<Maybe<Source>>>;
  studygrouphistory?: Maybe<StudyGroupHistory>;
  studylog?: Maybe<StudyLog>;
  test?: Maybe<Test>;
  text?: Maybe<Array<Maybe<TextBlock>>>;
  timeline?: Maybe<Array<Maybe<Event>>>;
  tokensignin?: Maybe<SignIn>;
  user?: Maybe<User>;
  userdailyscores?: Maybe<UserDailyScore>;
  userprogress?: Maybe<ProgressScore>;
  users?: Maybe<Array<Maybe<User>>>;
  versehighlights?: Maybe<Array<Maybe<ScriptureHighlights>>>;
  verses?: Maybe<Array<Maybe<Scripture>>>;
};


export type QueryBooksArgs = {
  seed?: InputMaybe<Scalars['String']['input']>;
};


export type QueryBotlistArgs = {
  channel?: InputMaybe<Scalars['String']['input']>;
};


export type QueryChiasmusArgs = {
  id?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryClosetabArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryCommentaryArgs = {
  id?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryDivisionArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryFaxArgs = {
  filter?: InputMaybe<Scalars['String']['input']>;
};


export type QueryFaxIndexArgs = {
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGenerateTokenArgs = {
  seed?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryHighlightArgs = {
  query: Scalars['String']['input'];
  text: Scalars['String']['input'];
};


export type QueryHistoryArgs = {
  archive?: InputMaybe<Scalars['String']['input']>;
  principal?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryHomefeedArgs = {
  channel?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  message?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryHomegroupsArgs = {
  grouping?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryHomesamplerArgs = {
  seed?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryHomethreadArgs = {
  channel?: InputMaybe<Scalars['String']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryImageArgs = {
  id?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryLeaderboardArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryLoadGroupsFromHashArgs = {
  hash?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryLookupArgs = {
  ref?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryMapsArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryMapstoriesArgs = {
  map: Array<InputMaybe<Scalars['String']['input']>>;
};


export type QueryMapstoryArgs = {
  map?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type QueryMarkdownArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryMenuArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryMessengerChannelArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
};


export type QueryMessengerChannelBannedMembersArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
};


export type QueryMessengerChannelOperatorsArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
};


export type QueryMessengerMessageArgs = {
  messageId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryMessengerMessagesArgs = {
  before?: InputMaybe<Scalars['String']['input']>;
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  customTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMessengerMyChannelsArgs = {
  customTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryMessengerThreadMessagesArgs = {
  parentMessageId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryMessengerUnreadDMsArgs = {
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryMessengerUserArgs = {
  userId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryMessengerUsersArgs = {
  userIds?: InputMaybe<Array<Scalars['String']['input']>>;
};


export type QueryMoregroupsArgs = {
  grouping?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryObjectArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryPageArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryPagecommentsArgs = {
  channelUrl?: InputMaybe<Scalars['String']['input']>;
  pageSlug?: InputMaybe<Scalars['String']['input']>;
};


export type QueryPageprogressArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryPassagenotesArgs = {
  end_verse_id?: InputMaybe<Scalars['Int']['input']>;
  start_verse_id?: InputMaybe<Scalars['Int']['input']>;
  verse_ids?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};


export type QueryPeopleArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryPersonArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryPlaceArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryPlacesArgs = {
  map?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryPostcommentsArgs = {
  message?: InputMaybe<Scalars['Int']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryQueueArgs = {
  items?: InputMaybe<Array<InputMaybe<QueueInput>>>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryReadArgs = {
  ref?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryReadingplanArgs = {
  slug?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryReadingplanhistoryArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryReadingplanpreviewArgs = {
  config: Scalars['String']['input'];
  startdate?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryReadingplanprogramsArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryReadingplansegmentArgs = {
  guid?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryRequestedUsersArgs = {
  channel?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryScriptureArgs = {
  ref?: InputMaybe<Scalars['String']['input']>;
  verse_ids?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  version?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySearchArgs = {
  query?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySearchAllArgs = {
  query: Scalars['String']['input'];
};


export type QuerySectionArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryShortlinkArgs = {
  hash?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QuerySigninArgs = {
  password?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
  username?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySocialsigninArgs = {
  network?: InputMaybe<Scalars['String']['input']>;
  social_token?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySourceUsageArgs = {
  source?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySourcesArgs = {
  id?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryStudygrouphistoryArgs = {
  studyGroupID?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryStudylogArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryTextArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryTimelineArgs = {
  slug?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryTokensigninArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryUserArgs = {
  token?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryUserdailyscoresArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryUserprogressArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryUsersArgs = {
  user_ids?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


export type QueryVersehighlightsArgs = {
  verse_pairs?: InputMaybe<Array<InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>>>;
};


export type QueryVersesArgs = {
  verse_ids?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};

export type QueueInput = {
  blocks?: InputMaybe<Array<Scalars['Int']['input']>>;
  plan?: InputMaybe<Scalars['String']['input']>;
  reference?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type ReadBlock = {
  __typename?: 'ReadBlock';
  next_ref?: Maybe<Scalars['String']['output']>;
  prev_ref?: Maybe<Scalars['String']['output']>;
  ref?: Maybe<Scalars['String']['output']>;
  sections?: Maybe<Array<Maybe<ReadSection>>>;
  verse_count?: Maybe<Scalars['Int']['output']>;
  verse_id?: Maybe<Scalars['Int']['output']>;
};

export type ReadExtra = {
  __typename?: 'ReadExtra';
  chiasmus?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  commentary?: Maybe<Array<Maybe<Scalars['Int']['output']>>>;
  events?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  fax?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  images?: Maybe<Array<Maybe<Scalars['Int']['output']>>>;
  maps?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  notes?: Maybe<Array<Maybe<Scalars['Int']['output']>>>;
  people?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  places?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  references?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
};

export type ReadLine = {
  __typename?: 'ReadLine';
  format?: Maybe<Scalars['String']['output']>;
  ref?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Scalars['String']['output']>;
  verse_id?: Maybe<Scalars['Int']['output']>;
  verse_num?: Maybe<Scalars['Int']['output']>;
};

export type ReadSection = {
  __typename?: 'ReadSection';
  blocks?: Maybe<Array<Maybe<ReadUnit>>>;
  extra?: Maybe<Array<Maybe<ReadExtra>>>;
  heading?: Maybe<Scalars['String']['output']>;
  meta?: Maybe<Array<Maybe<SectionMeta>>>;
  ref?: Maybe<Scalars['String']['output']>;
  verse_count?: Maybe<Scalars['Int']['output']>;
  verse_id?: Maybe<Scalars['Int']['output']>;
};

export type ReadUnit = {
  __typename?: 'ReadUnit';
  lines?: Maybe<Array<Maybe<ReadLine>>>;
  person_slug?: Maybe<Scalars['String']['output']>;
  ref?: Maybe<Scalars['String']['output']>;
  verse_count?: Maybe<Scalars['Int']['output']>;
  verse_id?: Maybe<Scalars['Int']['output']>;
  voice?: Maybe<Scalars['String']['output']>;
};

export type ReadingPlan = {
  __typename?: 'ReadingPlan';
  config?: Maybe<Scalars['String']['output']>;
  current?: Maybe<Scalars['Int']['output']>;
  duedate?: Maybe<Scalars['String']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  progress?: Maybe<Scalars['Float']['output']>;
  segments?: Maybe<Array<Maybe<ReadingPlanSegment>>>;
  slug?: Maybe<Scalars['String']['output']>;
  startdate?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type ReadingPlanPreview = {
  __typename?: 'ReadingPlanPreview';
  enddate?: Maybe<Scalars['String']['output']>;
  parts?: Maybe<Scalars['Int']['output']>;
  segments?: Maybe<Array<Maybe<PreviewSegment>>>;
  warnings?: Maybe<Array<Maybe<PlanWarning>>>;
};

export type ReadingPlanProgram = {
  __typename?: 'ReadingPlanProgram';
  config?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  durationLabel?: Maybe<Scalars['String']['output']>;
  scopeLabel?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type ReadingPlanResult = {
  __typename?: 'ReadingPlanResult';
  isSuccess?: Maybe<Scalars['Boolean']['output']>;
  msg?: Maybe<Scalars['String']['output']>;
  plan?: Maybe<ReadingPlan>;
};

export type ReadingPlanSegment = {
  __typename?: 'ReadingPlanSegment';
  duedate?: Maybe<Scalars['String']['output']>;
  end?: Maybe<Scalars['Int']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  period?: Maybe<Scalars['String']['output']>;
  progress?: Maybe<Scalars['Float']['output']>;
  ref?: Maybe<Scalars['String']['output']>;
  sections?: Maybe<Array<Maybe<Section>>>;
  start?: Maybe<Scalars['Int']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  url?: Maybe<Scalars['String']['output']>;
};

export type ReadingPlanSummary = {
  __typename?: 'ReadingPlanSummary';
  enddate?: Maybe<Scalars['String']['output']>;
  progress?: Maybe<Scalars['Float']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  startdate?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type Reference = {
  __typename?: 'Reference';
  ref?: Maybe<Scalars['String']['output']>;
  significant?: Maybe<Scalars['Int']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  verse_id?: Maybe<Scalars['Int']['output']>;
};

export type Relation = {
  __typename?: 'Relation';
  person?: Maybe<People>;
  relation?: Maybe<Scalars['String']['output']>;
};

export type ResultCard = {
  __typename?: 'ResultCard';
  highlight?: Maybe<HighlightRange>;
  ref?: Maybe<Scalars['String']['output']>;
  score?: Maybe<Scalars['Float']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  snippet?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type Row = {
  __typename?: 'Row';
  capsulation?: Maybe<Caps>;
  connection?: Maybe<Conn>;
  guid?: Maybe<Scalars['String']['output']>;
  narration?: Maybe<Narration>;
  parent?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  weight?: Maybe<Scalars['Int']['output']>;
};

export type Scripture = {
  __typename?: 'Scripture';
  book?: Maybe<Scalars['String']['output']>;
  chapter?: Maybe<Scalars['Int']['output']>;
  heading?: Maybe<Scalars['String']['output']>;
  reference?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Scalars['String']['output']>;
  verse?: Maybe<Scalars['Int']['output']>;
  verse_id?: Maybe<Scalars['Int']['output']>;
  version?: Maybe<Scalars['String']['output']>;
};

export type ScriptureHighlights = {
  __typename?: 'ScriptureHighlights';
  bible_highlight?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  bible_verse_id?: Maybe<Scalars['Int']['output']>;
  bom_highlight?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  bom_verse_id?: Maybe<Scalars['Int']['output']>;
  isQuote?: Maybe<Scalars['Boolean']['output']>;
};

export type ScriptureResults = {
  __typename?: 'ScriptureResults';
  passages?: Maybe<Array<Maybe<Passage>>>;
  ref?: Maybe<Scalars['String']['output']>;
  verses?: Maybe<Array<Maybe<Scripture>>>;
};

export type SearchAllResult = {
  __typename?: 'SearchAllResult';
  commentary: Array<ResultCard>;
  events: Array<ResultCard>;
  narration: Array<ResultCard>;
  pages: Array<ResultCard>;
  people: Array<ResultCard>;
  places: Array<ResultCard>;
  semantic?: Maybe<Scalars['Boolean']['output']>;
  verses: Array<SearchResult>;
};

export type SearchResult = {
  __typename?: 'SearchResult';
  highlight?: Maybe<HighlightRange>;
  lang?: Maybe<Scalars['String']['output']>;
  narration?: Maybe<Scalars['String']['output']>;
  page?: Maybe<Scalars['String']['output']>;
  reference?: Maybe<Scalars['String']['output']>;
  section?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  speaker?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Scalars['String']['output']>;
  voice?: Maybe<Scalars['String']['output']>;
};

export type Section = {
  __typename?: 'Section';
  ambient?: Maybe<Scalars['String']['output']>;
  badge?: Maybe<Scalars['String']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  page?: Maybe<Page>;
  parent?: Maybe<Scalars['String']['output']>;
  ref?: Maybe<Scalars['String']['output']>;
  rows?: Maybe<Array<Maybe<Row>>>;
  sectionText?: Maybe<Array<Maybe<TextBlock>>>;
  slug?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  weight?: Maybe<Scalars['Int']['output']>;
};

export type SectionMeta = {
  __typename?: 'SectionMeta';
  key?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
  verse_id?: Maybe<Scalars['Int']['output']>;
};

export type SendbirdUser = {
  __typename?: 'SendbirdUser';
  is_active?: Maybe<Scalars['Boolean']['output']>;
  is_online?: Maybe<Scalars['Boolean']['output']>;
  joined_ts?: Maybe<Scalars['Boolean']['output']>;
  last_seen_at?: Maybe<Scalars['Boolean']['output']>;
  metadata?: Maybe<SendbirdUserMetadata>;
  nickname?: Maybe<Scalars['String']['output']>;
  profile_url?: Maybe<Scalars['String']['output']>;
  require_auth_for_profile_image?: Maybe<Scalars['Boolean']['output']>;
  role?: Maybe<Scalars['String']['output']>;
  state?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

export type SendbirdUserMetadata = {
  __typename?: 'SendbirdUserMetadata';
  bookmark?: Maybe<Scalars['String']['output']>;
  summary?: Maybe<Scalars['String']['output']>;
};

export type Shortlinks = {
  __typename?: 'Shortlinks';
  hash?: Maybe<Scalars['String']['output']>;
  string?: Maybe<Scalars['String']['output']>;
};

export type SignIn = {
  __typename?: 'SignIn';
  isSuccess?: Maybe<Scalars['Boolean']['output']>;
  msg?: Maybe<Scalars['String']['output']>;
  profile_url?: Maybe<Scalars['String']['output']>;
  social?: Maybe<Social>;
  user?: Maybe<User>;
};

export type Social = {
  __typename?: 'Social';
  access_token?: Maybe<Scalars['String']['output']>;
  nickname?: Maybe<Scalars['String']['output']>;
  profile_url?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

export type Source = {
  __typename?: 'Source';
  excerpt?: Maybe<Scalars['String']['output']>;
  source_description?: Maybe<Scalars['String']['output']>;
  source_id?: Maybe<Scalars['String']['output']>;
  source_name?: Maybe<Scalars['String']['output']>;
  source_publisher?: Maybe<Scalars['String']['output']>;
  source_rating?: Maybe<Scalars['String']['output']>;
  source_short?: Maybe<Scalars['String']['output']>;
  source_slug?: Maybe<Scalars['String']['output']>;
  source_title?: Maybe<Scalars['String']['output']>;
  source_url?: Maybe<Scalars['String']['output']>;
  source_year?: Maybe<Scalars['Int']['output']>;
};

export type StartPlanInput = {
  config?: InputMaybe<Scalars['String']['input']>;
  credit?: InputMaybe<Scalars['String']['input']>;
  programSlug?: InputMaybe<Scalars['String']['input']>;
  startdate?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type StudyGroup = {
  __typename?: 'StudyGroup';
  channel_url?: Maybe<Scalars['String']['output']>;
  cover_url?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['Float']['output']>;
  custom_type?: Maybe<Scalars['String']['output']>;
  data?: Maybe<Scalars['String']['output']>;
  max_length_message?: Maybe<Scalars['Float']['output']>;
  member_count?: Maybe<Scalars['Float']['output']>;
  members?: Maybe<Array<Maybe<SendbirdUser>>>;
  messages?: Maybe<Array<Maybe<Message>>>;
  name?: Maybe<Scalars['String']['output']>;
};

export type StudyGroupHistory = {
  __typename?: 'StudyGroupHistory';
  dates?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  studyGroupID?: Maybe<Scalars['String']['output']>;
  studyGroupName?: Maybe<Scalars['String']['output']>;
  userHistories?: Maybe<Array<Maybe<UserHistory>>>;
};

export type StudyLog = {
  __typename?: 'StudyLog';
  sessions?: Maybe<Array<Maybe<UserSession>>>;
  summary?: Maybe<UserStudySummary>;
};

export type Test = {
  __typename?: 'Test';
  db?: Maybe<Scalars['String']['output']>;
  http?: Maybe<Scalars['String']['output']>;
  http2?: Maybe<Scalars['String']['output']>;
};

export type TextBlock = {
  __typename?: 'TextBlock';
  chrono?: Maybe<Scalars['String']['output']>;
  comIds?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  coms?: Maybe<Array<Maybe<Commentary>>>;
  content?: Maybe<Scalars['String']['output']>;
  duration?: Maybe<Scalars['Float']['output']>;
  guid?: Maybe<Scalars['String']['output']>;
  heading?: Maybe<Scalars['String']['output']>;
  imgIds?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  imgs?: Maybe<Array<Maybe<Image>>>;
  link?: Maybe<Scalars['Int']['output']>;
  narration?: Maybe<Narration>;
  next?: Maybe<Array<Maybe<NarrativePath>>>;
  note_count?: Maybe<Scalars['Int']['output']>;
  notes?: Maybe<Array<Maybe<Note>>>;
  parent?: Maybe<Scalars['String']['output']>;
  parentSlug?: Maybe<Scalars['String']['output']>;
  parent_page?: Maybe<Page>;
  parent_section?: Maybe<Section>;
  people?: Maybe<Array<Maybe<People>>>;
  places?: Maybe<Array<Maybe<Place>>>;
  quotes?: Maybe<Array<Maybe<TextBlock>>>;
  refs?: Maybe<Array<Maybe<Reference>>>;
  slug?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
};


export type TextBlockStatusArgs = {
  token?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePlanInput = {
  config: Scalars['String']['input'];
};

export type User = {
  __typename?: 'User';
  bookmark?: Maybe<Scalars['String']['output']>;
  complete?: Maybe<Scalars['Float']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  finished?: Maybe<Scalars['Float']['output']>;
  history?: Maybe<Array<Maybe<UserHistory>>>;
  name?: Maybe<Scalars['String']['output']>;
  networks?: Maybe<Array<Maybe<Network>>>;
  progress?: Maybe<ProgressScore>;
  sessions?: Maybe<Scalars['Int']['output']>;
  social?: Maybe<Social>;
  started?: Maybe<Scalars['Float']['output']>;
  time?: Maybe<Scalars['Float']['output']>;
  user?: Maybe<Scalars['String']['output']>;
  zip?: Maybe<Scalars['String']['output']>;
};

export type UserDailyScore = {
  __typename?: 'UserDailyScore';
  dates?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  progress?: Maybe<Array<Maybe<Scalars['Float']['output']>>>;
};

export type UserHistory = {
  __typename?: 'UserHistory';
  completed?: Maybe<Array<Maybe<Scalars['Float']['output']>>>;
  dates?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  user?: Maybe<Scalars['String']['output']>;
};

export type UserSession = {
  __typename?: 'UserSession';
  datetime?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  duration?: Maybe<Scalars['Float']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  timestamp?: Maybe<Scalars['Float']['output']>;
};

export type UserStudySummary = {
  __typename?: 'UserStudySummary';
  count?: Maybe<Scalars['Float']['output']>;
  duration?: Maybe<Scalars['Float']['output']>;
  finished?: Maybe<Array<Maybe<Scalars['Float']['output']>>>;
  first?: Maybe<Scalars['Float']['output']>;
};

export type Xrel = {
  __typename?: 'Xrel';
  dst_name?: Maybe<Scalars['String']['output']>;
  dst_slug?: Maybe<Scalars['String']['output']>;
  dst_title?: Maybe<Scalars['String']['output']>;
  dst_type?: Maybe<Scalars['String']['output']>;
  note?: Maybe<Scalars['String']['output']>;
  rel?: Maybe<Scalars['String']['output']>;
  srcweight?: Maybe<Scalars['Int']['output']>;
  verse_id?: Maybe<Scalars['Int']['output']>;
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Book: ResolverTypeWrapper<Partial<Book>>;
  Boolean: ResolverTypeWrapper<Partial<Scalars['Boolean']['output']>>;
  Bot: ResolverTypeWrapper<Partial<Bot>>;
  Caps: ResolverTypeWrapper<Partial<Caps>>;
  Chiasmus: ResolverTypeWrapper<Partial<Chiasmus>>;
  ChiasmusLine: ResolverTypeWrapper<Partial<ChiasmusLine>>;
  Commentary: ResolverTypeWrapper<Partial<Commentary>>;
  Conn: ResolverTypeWrapper<Partial<Conn>>;
  ContentLink: ResolverTypeWrapper<Partial<ContentLink>>;
  Division: ResolverTypeWrapper<Partial<Division>>;
  Event: ResolverTypeWrapper<Partial<Event>>;
  EventGrid: ResolverTypeWrapper<Partial<EventGrid>>;
  Fax: ResolverTypeWrapper<Partial<Fax>>;
  FaxIndex: ResolverTypeWrapper<Partial<FaxIndex>>;
  Float: ResolverTypeWrapper<Partial<Scalars['Float']['output']>>;
  HighlightRange: ResolverTypeWrapper<Partial<HighlightRange>>;
  HistoricalDocument: ResolverTypeWrapper<Partial<HistoricalDocument>>;
  HomeFeed: ResolverTypeWrapper<Partial<HomeFeed>>;
  HomeFeedItem: ResolverTypeWrapper<Partial<HomeFeedItem>>;
  HomeGroup: ResolverTypeWrapper<Partial<HomeGroup>>;
  HomeSampler: ResolverTypeWrapper<Partial<HomeSampler>>;
  HomeUser: ResolverTypeWrapper<Partial<HomeUser>>;
  Image: ResolverTypeWrapper<Partial<Image>>;
  Index: ResolverTypeWrapper<Partial<Index>>;
  Int: ResolverTypeWrapper<Partial<Scalars['Int']['output']>>;
  JSON: ResolverTypeWrapper<Partial<Scalars['JSON']['output']>>;
  JoinedGroup: ResolverTypeWrapper<Partial<JoinedGroup>>;
  Label: ResolverTypeWrapper<Partial<Label>>;
  LeaderBoard: ResolverTypeWrapper<Partial<LeaderBoard>>;
  LogResult: ResolverTypeWrapper<Partial<LogResult>>;
  Map: ResolverTypeWrapper<Partial<Map>>;
  MapMove: ResolverTypeWrapper<Partial<MapMove>>;
  MapStory: ResolverTypeWrapper<Partial<MapStory>>;
  Markdown: ResolverTypeWrapper<Partial<Markdown>>;
  Menu: ResolverTypeWrapper<Partial<Menu>>;
  Message: ResolverTypeWrapper<Partial<Message>>;
  MessengerChannel: ResolverTypeWrapper<Partial<MessengerChannel>>;
  MessengerMember: ResolverTypeWrapper<Partial<MessengerMember>>;
  MessengerMessage: ResolverTypeWrapper<Partial<MessengerMessage>>;
  MessengerPageComments: ResolverTypeWrapper<Partial<MessengerPageComments>>;
  MessengerReaction: ResolverTypeWrapper<Partial<MessengerReaction>>;
  MessengerThreadInfo: ResolverTypeWrapper<Partial<MessengerThreadInfo>>;
  MessengerUnreadDM: ResolverTypeWrapper<Partial<MessengerUnreadDm>>;
  MessengerUser: ResolverTypeWrapper<Partial<MessengerUser>>;
  Mutation: ResolverTypeWrapper<{}>;
  Narration: ResolverTypeWrapper<Partial<Narration>>;
  NarrativePath: ResolverTypeWrapper<Partial<NarrativePath>>;
  Network: ResolverTypeWrapper<Partial<Network>>;
  Note: ResolverTypeWrapper<Partial<Note>>;
  Notification: ResolverTypeWrapper<Partial<Notification>>;
  Object: ResolverTypeWrapper<Partial<Object>>;
  Page: ResolverTypeWrapper<Partial<Page>>;
  Passage: ResolverTypeWrapper<Partial<Passage>>;
  PassageNotes: ResolverTypeWrapper<Partial<PassageNotes>>;
  People: ResolverTypeWrapper<Partial<People>>;
  PeopleLink: ResolverTypeWrapper<Partial<PeopleLink>>;
  PeopleNetwork: ResolverTypeWrapper<Partial<PeopleNetwork>>;
  PeopleNode: ResolverTypeWrapper<Partial<PeopleNode>>;
  Place: ResolverTypeWrapper<Partial<Place>>;
  PlanEndAction: ResolverTypeWrapper<Partial<PlanEndAction>>;
  PlanWarning: ResolverTypeWrapper<Partial<PlanWarning>>;
  PreviewSegment: ResolverTypeWrapper<Partial<PreviewSegment>>;
  ProgressScore: ResolverTypeWrapper<Partial<ProgressScore>>;
  Query: ResolverTypeWrapper<{}>;
  QueueInput: ResolverTypeWrapper<Partial<QueueInput>>;
  ReadBlock: ResolverTypeWrapper<Partial<ReadBlock>>;
  ReadExtra: ResolverTypeWrapper<Partial<ReadExtra>>;
  ReadLine: ResolverTypeWrapper<Partial<ReadLine>>;
  ReadSection: ResolverTypeWrapper<Partial<ReadSection>>;
  ReadUnit: ResolverTypeWrapper<Partial<ReadUnit>>;
  ReadingPlan: ResolverTypeWrapper<Partial<ReadingPlan>>;
  ReadingPlanPreview: ResolverTypeWrapper<Partial<ReadingPlanPreview>>;
  ReadingPlanProgram: ResolverTypeWrapper<Partial<ReadingPlanProgram>>;
  ReadingPlanResult: ResolverTypeWrapper<Partial<ReadingPlanResult>>;
  ReadingPlanSegment: ResolverTypeWrapper<Partial<ReadingPlanSegment>>;
  ReadingPlanSummary: ResolverTypeWrapper<Partial<ReadingPlanSummary>>;
  Reference: ResolverTypeWrapper<Partial<Reference>>;
  Relation: ResolverTypeWrapper<Partial<Relation>>;
  ResultCard: ResolverTypeWrapper<Partial<ResultCard>>;
  Row: ResolverTypeWrapper<Partial<Row>>;
  Scripture: ResolverTypeWrapper<Partial<Scripture>>;
  ScriptureHighlights: ResolverTypeWrapper<Partial<ScriptureHighlights>>;
  ScriptureResults: ResolverTypeWrapper<Partial<ScriptureResults>>;
  SearchAllResult: ResolverTypeWrapper<Partial<SearchAllResult>>;
  SearchResult: ResolverTypeWrapper<Partial<SearchResult>>;
  Section: ResolverTypeWrapper<Partial<Section>>;
  SectionMeta: ResolverTypeWrapper<Partial<SectionMeta>>;
  SendbirdUser: ResolverTypeWrapper<Partial<SendbirdUser>>;
  SendbirdUserMetadata: ResolverTypeWrapper<Partial<SendbirdUserMetadata>>;
  Shortlinks: ResolverTypeWrapper<Partial<Shortlinks>>;
  SignIn: ResolverTypeWrapper<Partial<SignIn>>;
  Social: ResolverTypeWrapper<Partial<Social>>;
  Source: ResolverTypeWrapper<Partial<Source>>;
  StartPlanInput: ResolverTypeWrapper<Partial<StartPlanInput>>;
  String: ResolverTypeWrapper<Partial<Scalars['String']['output']>>;
  StudyGroup: ResolverTypeWrapper<Partial<StudyGroup>>;
  StudyGroupHistory: ResolverTypeWrapper<Partial<StudyGroupHistory>>;
  StudyLog: ResolverTypeWrapper<Partial<StudyLog>>;
  Test: ResolverTypeWrapper<Partial<Test>>;
  TextBlock: ResolverTypeWrapper<Partial<TextBlock>>;
  UpdatePlanInput: ResolverTypeWrapper<Partial<UpdatePlanInput>>;
  User: ResolverTypeWrapper<Partial<User>>;
  UserDailyScore: ResolverTypeWrapper<Partial<UserDailyScore>>;
  UserHistory: ResolverTypeWrapper<Partial<UserHistory>>;
  UserSession: ResolverTypeWrapper<Partial<UserSession>>;
  UserStudySummary: ResolverTypeWrapper<Partial<UserStudySummary>>;
  Xrel: ResolverTypeWrapper<Partial<Xrel>>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Book: Partial<Book>;
  Boolean: Partial<Scalars['Boolean']['output']>;
  Bot: Partial<Bot>;
  Caps: Partial<Caps>;
  Chiasmus: Partial<Chiasmus>;
  ChiasmusLine: Partial<ChiasmusLine>;
  Commentary: Partial<Commentary>;
  Conn: Partial<Conn>;
  ContentLink: Partial<ContentLink>;
  Division: Partial<Division>;
  Event: Partial<Event>;
  EventGrid: Partial<EventGrid>;
  Fax: Partial<Fax>;
  FaxIndex: Partial<FaxIndex>;
  Float: Partial<Scalars['Float']['output']>;
  HighlightRange: Partial<HighlightRange>;
  HistoricalDocument: Partial<HistoricalDocument>;
  HomeFeed: Partial<HomeFeed>;
  HomeFeedItem: Partial<HomeFeedItem>;
  HomeGroup: Partial<HomeGroup>;
  HomeSampler: Partial<HomeSampler>;
  HomeUser: Partial<HomeUser>;
  Image: Partial<Image>;
  Index: Partial<Index>;
  Int: Partial<Scalars['Int']['output']>;
  JSON: Partial<Scalars['JSON']['output']>;
  JoinedGroup: Partial<JoinedGroup>;
  Label: Partial<Label>;
  LeaderBoard: Partial<LeaderBoard>;
  LogResult: Partial<LogResult>;
  Map: Partial<Map>;
  MapMove: Partial<MapMove>;
  MapStory: Partial<MapStory>;
  Markdown: Partial<Markdown>;
  Menu: Partial<Menu>;
  Message: Partial<Message>;
  MessengerChannel: Partial<MessengerChannel>;
  MessengerMember: Partial<MessengerMember>;
  MessengerMessage: Partial<MessengerMessage>;
  MessengerPageComments: Partial<MessengerPageComments>;
  MessengerReaction: Partial<MessengerReaction>;
  MessengerThreadInfo: Partial<MessengerThreadInfo>;
  MessengerUnreadDM: Partial<MessengerUnreadDm>;
  MessengerUser: Partial<MessengerUser>;
  Mutation: {};
  Narration: Partial<Narration>;
  NarrativePath: Partial<NarrativePath>;
  Network: Partial<Network>;
  Note: Partial<Note>;
  Notification: Partial<Notification>;
  Object: Partial<Object>;
  Page: Partial<Page>;
  Passage: Partial<Passage>;
  PassageNotes: Partial<PassageNotes>;
  People: Partial<People>;
  PeopleLink: Partial<PeopleLink>;
  PeopleNetwork: Partial<PeopleNetwork>;
  PeopleNode: Partial<PeopleNode>;
  Place: Partial<Place>;
  PlanWarning: Partial<PlanWarning>;
  PreviewSegment: Partial<PreviewSegment>;
  ProgressScore: Partial<ProgressScore>;
  Query: {};
  QueueInput: Partial<QueueInput>;
  ReadBlock: Partial<ReadBlock>;
  ReadExtra: Partial<ReadExtra>;
  ReadLine: Partial<ReadLine>;
  ReadSection: Partial<ReadSection>;
  ReadUnit: Partial<ReadUnit>;
  ReadingPlan: Partial<ReadingPlan>;
  ReadingPlanPreview: Partial<ReadingPlanPreview>;
  ReadingPlanProgram: Partial<ReadingPlanProgram>;
  ReadingPlanResult: Partial<ReadingPlanResult>;
  ReadingPlanSegment: Partial<ReadingPlanSegment>;
  ReadingPlanSummary: Partial<ReadingPlanSummary>;
  Reference: Partial<Reference>;
  Relation: Partial<Relation>;
  ResultCard: Partial<ResultCard>;
  Row: Partial<Row>;
  Scripture: Partial<Scripture>;
  ScriptureHighlights: Partial<ScriptureHighlights>;
  ScriptureResults: Partial<ScriptureResults>;
  SearchAllResult: Partial<SearchAllResult>;
  SearchResult: Partial<SearchResult>;
  Section: Partial<Section>;
  SectionMeta: Partial<SectionMeta>;
  SendbirdUser: Partial<SendbirdUser>;
  SendbirdUserMetadata: Partial<SendbirdUserMetadata>;
  Shortlinks: Partial<Shortlinks>;
  SignIn: Partial<SignIn>;
  Social: Partial<Social>;
  Source: Partial<Source>;
  StartPlanInput: Partial<StartPlanInput>;
  String: Partial<Scalars['String']['output']>;
  StudyGroup: Partial<StudyGroup>;
  StudyGroupHistory: Partial<StudyGroupHistory>;
  StudyLog: Partial<StudyLog>;
  Test: Partial<Test>;
  TextBlock: Partial<TextBlock>;
  UpdatePlanInput: Partial<UpdatePlanInput>;
  User: Partial<User>;
  UserDailyScore: Partial<UserDailyScore>;
  UserHistory: Partial<UserHistory>;
  UserSession: Partial<UserSession>;
  UserStudySummary: Partial<UserStudySummary>;
  Xrel: Partial<Xrel>;
};

export type BookResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Book'] = ResolversParentTypes['Book']> = {
  book?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  chapters?: Resolver<Maybe<Array<Maybe<ResolversTypes['Int']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type BotResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Bot'] = ResolversParentTypes['Bot']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  enabled?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  picture?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CapsResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Caps'] = ResolversParentTypes['Caps']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  link?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  parent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  reference?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChiasmusResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Chiasmus'] = ResolversParentTypes['Chiasmus']> = {
  chiasmus_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  lines?: Resolver<Maybe<Array<Maybe<ResolversTypes['ChiasmusLine']>>>, ParentType, ContextType>;
  reference?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  scheme?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChiasmusLineResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ChiasmusLine'] = ResolversParentTypes['ChiasmusLine']> = {
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  highlights?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  line_key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  line_text?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CommentaryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Commentary'] = ResolversParentTypes['Commentary']> = {
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['TextBlock']>, ParentType, ContextType>;
  preview?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  publication?: Resolver<Maybe<ResolversTypes['Source']>, ParentType, ContextType>;
  reference?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse_range?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ConnResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Conn'] = ResolversParentTypes['Conn']> = {
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  isPage?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  link?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  parent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ContentLinkResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ContentLink'] = ResolversParentTypes['ContentLink']> = {
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  val?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type DivisionResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Division'] = ResolversParentTypes['Division']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  link?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  page?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  pages?: Resolver<Maybe<Array<Maybe<ResolversTypes['Page']>>>, ParentType, ContextType>;
  progress?: Resolver<Maybe<ResolversTypes['ProgressScore']>, ParentType, ContextType, Partial<DivisionProgressArgs>>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  titlepage?: Resolver<Maybe<ResolversTypes['Page']>, ParentType, ContextType>;
  weight?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type EventResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Event'] = ResolversParentTypes['Event']> = {
  date?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  file?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  grid?: Resolver<Maybe<ResolversTypes['EventGrid']>, ParentType, ContextType>;
  h?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  heading?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  html?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  link?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  narr?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  o?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  p?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  reference?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['TextBlock']>, ParentType, ContextType>;
  w?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  x?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  y?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  z?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type EventGridResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['EventGrid'] = ResolversParentTypes['EventGrid']> = {
  anchor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  bg?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  col?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  colSpan?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  dir?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  icon?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  row?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  rowSpan?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  tier?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FaxResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Fax'] = ResolversParentTypes['Fax']> = {
  bgcolor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  code?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  com?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  fax?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  format?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hide?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  index?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  indexRef?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  info?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  pages?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pgfirstVerse?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pgoffset?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FaxIndexResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['FaxIndex'] = ResolversParentTypes['FaxIndex']> = {
  pages?: Resolver<Maybe<Array<Maybe<Array<Maybe<ResolversTypes['Int']>>>>>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HighlightRangeResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['HighlightRange'] = ResolversParentTypes['HighlightRange']> = {
  end?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  start?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HistoricalDocumentResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['HistoricalDocument'] = ResolversParentTypes['HistoricalDocument']> = {
  archive?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  aspect?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  author?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  citation?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  date?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  document?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  event_date?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  event_year?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  link?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  pages?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  principal?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  seq?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  teaser?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  transcript?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  year?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HomeFeedResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['HomeFeed'] = ResolversParentTypes['HomeFeed']> = {
  feed?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeFeedItem']>>>, ParentType, ContextType>;
  groups?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeGroup']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HomeFeedItemResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['HomeFeedItem'] = ResolversParentTypes['HomeFeedItem']> = {
  channel_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  highlights?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  likes?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  link?: Resolver<Maybe<ResolversTypes['ContentLink']>, ParentType, ContextType>;
  mentioned_users?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeUser']>>>, ParentType, ContextType>;
  msg?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  repliers?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeUser']>>>, ParentType, ContextType>;
  replycount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  timestamp?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['HomeUser']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HomeGroupResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['HomeGroup'] = ResolversParentTypes['HomeGroup']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  grouping?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  latest?: Resolver<Maybe<ResolversTypes['HomeFeedItem']>, ParentType, ContextType>;
  members?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeUser']>>>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  picture?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  privacy?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  requests?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HomeSamplerResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['HomeSampler'] = ResolversParentTypes['HomeSampler']> = {
  commentary?: Resolver<Maybe<ResolversTypes['Commentary']>, ParentType, ContextType>;
  contents?: Resolver<Maybe<ResolversTypes['Division']>, ParentType, ContextType>;
  fax?: Resolver<Maybe<ResolversTypes['Fax']>, ParentType, ContextType>;
  people?: Resolver<Maybe<Array<Maybe<ResolversTypes['People']>>>, ParentType, ContextType>;
  places?: Resolver<Maybe<Array<Maybe<ResolversTypes['Place']>>>, ParentType, ContextType>;
  seed?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HomeUserResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['HomeUser'] = ResolversParentTypes['HomeUser']> = {
  bookmark?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  finished?: Resolver<Maybe<Array<Maybe<ResolversTypes['Float']>>>, ParentType, ContextType>;
  isBot?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  lastseen?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  laststudied?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  nickname?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  picture?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  progress?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  public?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  user_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ImageResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Image'] = ResolversParentTypes['Image']> = {
  artist?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  file?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  height?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  link?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['TextBlock']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  width?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type IndexResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Index'] = ResolversParentTypes['Index']> = {
  pkey?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse_id_end?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSON'], any> {
  name: 'JSON';
}

export type JoinedGroupResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['JoinedGroup'] = ResolversParentTypes['JoinedGroup']> = {
  channel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  isSuccess?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  msg?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LabelResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Label'] = ResolversParentTypes['Label']> = {
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  val?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LeaderBoardResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['LeaderBoard'] = ResolversParentTypes['LeaderBoard']> = {
  currentProgress?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeUser']>>>, ParentType, ContextType>;
  recentFinishers?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeUser']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LogResultResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['LogResult'] = ResolversParentTypes['LogResult']> = {
  logged?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  progress?: Resolver<Maybe<ResolversTypes['ProgressScore']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MapResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Map'] = ResolversParentTypes['Map']> = {
  centerx?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  centery?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  desc?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  group?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  maxzoom?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  minzoom?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  places?: Resolver<Maybe<Array<Maybe<ResolversTypes['Place']>>>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  tiles?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  zoom?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MapMoveResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MapMove'] = ResolversParentTypes['MapMove']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  duration?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  end?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  endPlace?: Resolver<Maybe<ResolversTypes['Place']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  people?: Resolver<Maybe<Array<Maybe<ResolversTypes['People']>>>, ParentType, ContextType>;
  seq?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  start?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startPlace?: Resolver<Maybe<ResolversTypes['Place']>, ParentType, ContextType>;
  travelers?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse_ids?: Resolver<Maybe<Array<Maybe<ResolversTypes['Int']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MapStoryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MapStory'] = ResolversParentTypes['MapStory']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  moves?: Resolver<Maybe<Array<Maybe<ResolversTypes['MapMove']>>>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MarkdownResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Markdown'] = ResolversParentTypes['Markdown']> = {
  markdown?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MenuResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Menu'] = ResolversParentTypes['Menu']> = {
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  link?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessageResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Message'] = ResolversParentTypes['Message']> = {
  channel_type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  channel_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  created_at?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  custom_type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  data?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  is_op_msg?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  is_removed?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  mention_type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  mentioned_users?: Resolver<Maybe<Array<Maybe<ResolversTypes['SendbirdUser']>>>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message_id?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  message_retention_hour?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  message_survival_seconds?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  silent?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updated_at?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['SendbirdUser']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessengerChannelResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MessengerChannel'] = ResolversParentTypes['MessengerChannel']> = {
  channel_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  cover_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  created_at?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  custom_type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  lang?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  last_message?: Resolver<Maybe<ResolversTypes['MessengerMessage']>, ParentType, ContextType>;
  member_count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  members?: Resolver<Maybe<Array<Maybe<ResolversTypes['MessengerMember']>>>, ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  unread_message_count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessengerMemberResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MessengerMember'] = ResolversParentTypes['MessengerMember']> = {
  is_bot?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  is_muted?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  is_online?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  last_seen_at?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  nickname?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  profile_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  role?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  state?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  user_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessengerMessageResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MessengerMessage'] = ResolversParentTypes['MessengerMessage']> = {
  channel_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  created_at?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  custom_type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  data?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  link_target?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  link_type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message_type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  parent_message_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  reactions?: Resolver<Maybe<Array<Maybe<ResolversTypes['MessengerReaction']>>>, ParentType, ContextType>;
  thread_info?: Resolver<Maybe<ResolversTypes['MessengerThreadInfo']>, ParentType, ContextType>;
  updated_at?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['MessengerUser']>, ParentType, ContextType>;
  user_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessengerPageCommentsResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MessengerPageComments'] = ResolversParentTypes['MessengerPageComments']> = {
  counts?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  messages?: Resolver<Maybe<Array<Maybe<ResolversTypes['MessengerMessage']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessengerReactionResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MessengerReaction'] = ResolversParentTypes['MessengerReaction']> = {
  reaction_key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  user_ids?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessengerThreadInfoResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MessengerThreadInfo'] = ResolversParentTypes['MessengerThreadInfo']> = {
  most_replied_users?: Resolver<Maybe<Array<Maybe<ResolversTypes['MessengerUser']>>>, ParentType, ContextType>;
  reply_count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessengerUnreadDmResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MessengerUnreadDM'] = ResolversParentTypes['MessengerUnreadDM']> = {
  channel_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  other_user_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  unread_count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessengerUserResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MessengerUser'] = ResolversParentTypes['MessengerUser']> = {
  is_bot?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  is_online?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  last_seen_at?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  nickname?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  profile_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  user_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  _?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  addBot?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationAddBotArgs>>;
  changePassword?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationChangePasswordArgs>>;
  editProfile?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, Partial<MutationEditProfileArgs>>;
  endReadingPlan?: Resolver<Maybe<ResolversTypes['ReadingPlanResult']>, ParentType, ContextType, RequireFields<MutationEndReadingPlanArgs, 'action' | 'token'>>;
  joinGroup?: Resolver<Maybe<ResolversTypes['JoinedGroup']>, ParentType, ContextType, Partial<MutationJoinGroupArgs>>;
  joinOpenGroup?: Resolver<Maybe<ResolversTypes['JoinedGroup']>, ParentType, ContextType, Partial<MutationJoinOpenGroupArgs>>;
  log?: Resolver<Maybe<ResolversTypes['LogResult']>, ParentType, ContextType, RequireFields<MutationLogArgs, 'key' | 'token'>>;
  markAllNotificationsRead?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  markNotificationRead?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationMarkNotificationReadArgs>>;
  messengerAcceptInvitation?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationMessengerAcceptInvitationArgs>>;
  messengerBanMember?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationMessengerBanMemberArgs>>;
  messengerCreateChannel?: Resolver<Maybe<ResolversTypes['MessengerChannel']>, ParentType, ContextType, Partial<MutationMessengerCreateChannelArgs>>;
  messengerDeclineInvitation?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationMessengerDeclineInvitationArgs>>;
  messengerInviteMembers?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationMessengerInviteMembersArgs>>;
  messengerRemoveMember?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationMessengerRemoveMemberArgs>>;
  messengerSetMute?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationMessengerSetMuteArgs>>;
  messengerUnbanMember?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationMessengerUnbanMemberArgs>>;
  messengerUpdateChannel?: Resolver<Maybe<ResolversTypes['MessengerChannel']>, ParentType, ContextType, Partial<MutationMessengerUpdateChannelArgs>>;
  messengerUpdateMemberRole?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationMessengerUpdateMemberRoleArgs>>;
  messengerUpdateUser?: Resolver<Maybe<ResolversTypes['MessengerUser']>, ParentType, ContextType, Partial<MutationMessengerUpdateUserArgs>>;
  messengerUpdateUserMetadata?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationMessengerUpdateUserMetadataArgs>>;
  ping?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationPingArgs>>;
  processRequest?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationProcessRequestArgs>>;
  removeBot?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationRemoveBotArgs>>;
  requestToJoinGroup?: Resolver<Maybe<ResolversTypes['JoinedGroup']>, ParentType, ContextType, Partial<MutationRequestToJoinGroupArgs>>;
  shortlink?: Resolver<Maybe<ResolversTypes['Shortlinks']>, ParentType, ContextType, Partial<MutationShortlinkArgs>>;
  signout?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationSignoutArgs>>;
  signup?: Resolver<Maybe<ResolversTypes['SignIn']>, ParentType, ContextType, Partial<MutationSignupArgs>>;
  startReadingPlan?: Resolver<Maybe<ResolversTypes['ReadingPlanResult']>, ParentType, ContextType, RequireFields<MutationStartReadingPlanArgs, 'input' | 'token'>>;
  updateReadingPlan?: Resolver<Maybe<ResolversTypes['ReadingPlanResult']>, ParentType, ContextType, RequireFields<MutationUpdateReadingPlanArgs, 'input' | 'token'>>;
  uploadProfileImage?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, RequireFields<MutationUploadProfileImageArgs, 'imageData' | 'token'>>;
  withdrawRequest?: Resolver<Maybe<ResolversTypes['JoinedGroup']>, ParentType, ContextType, Partial<MutationWithdrawRequestArgs>>;
};

export type NarrationResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Narration'] = ResolversParentTypes['Narration']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  parent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  section?: Resolver<Maybe<ResolversTypes['Section']>, ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['TextBlock']>, ParentType, ContextType>;
  timeline?: Resolver<Maybe<ResolversTypes['Event']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NarrativePathResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['NarrativePath'] = ResolversParentTypes['NarrativePath']> = {
  narration?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  nextclass?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  page?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  section?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NetworkResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Network'] = ResolversParentTypes['Network']> = {
  network?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  social_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NoteResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Note'] = ResolversParentTypes['Note']> = {
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NotificationResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Notification'] = ResolversParentTypes['Notification']> = {
  actor?: Resolver<Maybe<ResolversTypes['MessengerUser']>, ParentType, ContextType>;
  channel_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  created_at?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  is_read?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  message_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ObjectResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Object'] = ResolversParentTypes['Object']> = {
  aliases?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  category?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  era?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  index?: Resolver<Maybe<Array<Maybe<ResolversTypes['Index']>>>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  provenance?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  specificity?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  subtitle?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  tags?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  usage?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  weight?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  xrels?: Resolver<Maybe<Array<Maybe<ResolversTypes['Xrel']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PageResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Page'] = ResolversParentTypes['Page']> = {
  counts?: Resolver<Maybe<Array<Maybe<ResolversTypes['Int']>>>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  parent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  progress?: Resolver<Maybe<ResolversTypes['ProgressScore']>, ParentType, ContextType, Partial<PageProgressArgs>>;
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  sections?: Resolver<Maybe<Array<Maybe<ResolversTypes['Section']>>>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  text?: Resolver<Maybe<Array<Maybe<ResolversTypes['TextBlock']>>>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  weight?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PassageResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Passage'] = ResolversParentTypes['Passage']> = {
  heading?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  meta?: Resolver<Maybe<Array<Maybe<ResolversTypes['SectionMeta']>>>, ParentType, ContextType>;
  reference?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verses?: Resolver<Maybe<Array<Maybe<ResolversTypes['Scripture']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PassageNotesResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['PassageNotes'] = ResolversParentTypes['PassageNotes']> = {
  chiasmus?: Resolver<Maybe<Array<Maybe<ResolversTypes['Chiasmus']>>>, ParentType, ContextType>;
  commentary?: Resolver<Maybe<Array<Maybe<ResolversTypes['Commentary']>>>, ParentType, ContextType>;
  fax?: Resolver<Maybe<Array<Maybe<ResolversTypes['Fax']>>>, ParentType, ContextType>;
  images?: Resolver<Maybe<Array<Maybe<ResolversTypes['Image']>>>, ParentType, ContextType>;
  mapstory?: Resolver<Maybe<Array<Maybe<ResolversTypes['MapStory']>>>, ParentType, ContextType>;
  notes?: Resolver<Maybe<Array<Maybe<ResolversTypes['Note']>>>, ParentType, ContextType>;
  objects?: Resolver<Maybe<Array<Maybe<ResolversTypes['Object']>>>, ParentType, ContextType>;
  people?: Resolver<Maybe<Array<Maybe<ResolversTypes['People']>>>, ParentType, ContextType>;
  places?: Resolver<Maybe<Array<Maybe<ResolversTypes['Place']>>>, ParentType, ContextType>;
  refs?: Resolver<Maybe<Array<Maybe<ResolversTypes['Reference']>>>, ParentType, ContextType>;
  sources?: Resolver<Maybe<Array<Maybe<ResolversTypes['Source']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PeopleResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['People'] = ResolversParentTypes['People']> = {
  classification?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  date?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  identification?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  index?: Resolver<Maybe<Array<Maybe<ResolversTypes['Index']>>>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  relations?: Resolver<Maybe<Array<Maybe<ResolversTypes['Relation']>>>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  unit?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PeopleLinkResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['PeopleLink'] = ResolversParentTypes['PeopleLink']> = {
  charge?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  strokeColor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  strokeWidth?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  target?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PeopleNetworkResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['PeopleNetwork'] = ResolversParentTypes['PeopleNetwork']> = {
  links?: Resolver<Maybe<Array<Maybe<ResolversTypes['PeopleLink']>>>, ParentType, ContextType>;
  nodes?: Resolver<Maybe<Array<Maybe<ResolversTypes['PeopleNode']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PeopleNodeResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['PeopleNode'] = ResolversParentTypes['PeopleNode']> = {
  charge?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  classif?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  cluster?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  degree?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  fill?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  group?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  radius?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  stroke?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  unit?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PlaceResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Place'] = ResolversParentTypes['Place']> = {
  aka?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ax?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  ay?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  h?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  icon?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  index?: Resolver<Maybe<Array<Maybe<ResolversTypes['Index']>>>, ParentType, ContextType>;
  info?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  lat?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  lng?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  maps?: Resolver<Maybe<Array<Maybe<ResolversTypes['Map']>>>, ParentType, ContextType>;
  maxZoom?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  minZoom?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  occupants?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  w?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PlanWarningResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['PlanWarning'] = ResolversParentTypes['PlanWarning']> = {
  code?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  detail?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PreviewSegmentResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['PreviewSegment'] = ResolversParentTypes['PreviewSegment']> = {
  blocks?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  duedate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  period?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ProgressScoreResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ProgressScore'] = ResolversParentTypes['ProgressScore']> = {
  active_items?: Resolver<Maybe<Array<Maybe<ResolversTypes['Float']>>>, ParentType, ContextType>;
  completed?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  completed_items?: Resolver<Maybe<Array<Maybe<ResolversTypes['Float']>>>, ParentType, ContextType>;
  count?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  started?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  started_items?: Resolver<Maybe<Array<Maybe<ResolversTypes['Float']>>>, ParentType, ContextType>;
  summary?: Resolver<Maybe<ResolversTypes['UserStudySummary']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  _?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  books?: Resolver<Maybe<Array<Maybe<ResolversTypes['Book']>>>, ParentType, ContextType, Partial<QueryBooksArgs>>;
  botlist?: Resolver<Maybe<Array<Maybe<ResolversTypes['Bot']>>>, ParentType, ContextType, Partial<QueryBotlistArgs>>;
  chiasmus?: Resolver<Maybe<Array<Maybe<ResolversTypes['Chiasmus']>>>, ParentType, ContextType, Partial<QueryChiasmusArgs>>;
  closetab?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType, Partial<QueryClosetabArgs>>;
  commentary?: Resolver<Maybe<Array<Maybe<ResolversTypes['Commentary']>>>, ParentType, ContextType, Partial<QueryCommentaryArgs>>;
  division?: Resolver<Maybe<Array<Maybe<ResolversTypes['Division']>>>, ParentType, ContextType, Partial<QueryDivisionArgs>>;
  fax?: Resolver<Maybe<Array<Maybe<ResolversTypes['Fax']>>>, ParentType, ContextType, Partial<QueryFaxArgs>>;
  faxIndex?: Resolver<Maybe<ResolversTypes['FaxIndex']>, ParentType, ContextType, Partial<QueryFaxIndexArgs>>;
  generateToken?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, Partial<QueryGenerateTokenArgs>>;
  highlight?: Resolver<Maybe<ResolversTypes['HighlightRange']>, ParentType, ContextType, RequireFields<QueryHighlightArgs, 'query' | 'text'>>;
  history?: Resolver<Maybe<Array<Maybe<ResolversTypes['HistoricalDocument']>>>, ParentType, ContextType, Partial<QueryHistoryArgs>>;
  homefeed?: Resolver<Maybe<ResolversTypes['HomeFeed']>, ParentType, ContextType, Partial<QueryHomefeedArgs>>;
  homegroups?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeGroup']>>>, ParentType, ContextType, Partial<QueryHomegroupsArgs>>;
  homesampler?: Resolver<Maybe<ResolversTypes['HomeSampler']>, ParentType, ContextType, Partial<QueryHomesamplerArgs>>;
  homethread?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeFeedItem']>>>, ParentType, ContextType, Partial<QueryHomethreadArgs>>;
  image?: Resolver<Maybe<Array<Maybe<ResolversTypes['Image']>>>, ParentType, ContextType, Partial<QueryImageArgs>>;
  labels?: Resolver<Maybe<Array<Maybe<ResolversTypes['Label']>>>, ParentType, ContextType>;
  leaderboard?: Resolver<Maybe<ResolversTypes['LeaderBoard']>, ParentType, ContextType, Partial<QueryLeaderboardArgs>>;
  loadGroupsFromHash?: Resolver<Maybe<Array<Maybe<ResolversTypes['StudyGroup']>>>, ParentType, ContextType, Partial<QueryLoadGroupsFromHashArgs>>;
  lookup?: Resolver<Maybe<Array<Maybe<ResolversTypes['TextBlock']>>>, ParentType, ContextType, Partial<QueryLookupArgs>>;
  maps?: Resolver<Maybe<Array<Maybe<ResolversTypes['Map']>>>, ParentType, ContextType, Partial<QueryMapsArgs>>;
  mapstories?: Resolver<Maybe<Array<Maybe<ResolversTypes['MapStory']>>>, ParentType, ContextType, RequireFields<QueryMapstoriesArgs, 'map'>>;
  mapstory?: Resolver<Maybe<Array<Maybe<ResolversTypes['MapStory']>>>, ParentType, ContextType, Partial<QueryMapstoryArgs>>;
  markdown?: Resolver<Maybe<Array<Maybe<ResolversTypes['Markdown']>>>, ParentType, ContextType, Partial<QueryMarkdownArgs>>;
  menu?: Resolver<Maybe<Array<Maybe<ResolversTypes['Menu']>>>, ParentType, ContextType, Partial<QueryMenuArgs>>;
  messengerChannel?: Resolver<Maybe<ResolversTypes['MessengerChannel']>, ParentType, ContextType, Partial<QueryMessengerChannelArgs>>;
  messengerChannelBannedMembers?: Resolver<Maybe<Array<Maybe<ResolversTypes['MessengerMember']>>>, ParentType, ContextType, Partial<QueryMessengerChannelBannedMembersArgs>>;
  messengerChannelOperators?: Resolver<Maybe<Array<Maybe<ResolversTypes['MessengerUser']>>>, ParentType, ContextType, Partial<QueryMessengerChannelOperatorsArgs>>;
  messengerMessage?: Resolver<Maybe<ResolversTypes['MessengerMessage']>, ParentType, ContextType, Partial<QueryMessengerMessageArgs>>;
  messengerMessages?: Resolver<Maybe<Array<Maybe<ResolversTypes['MessengerMessage']>>>, ParentType, ContextType, Partial<QueryMessengerMessagesArgs>>;
  messengerMyChannels?: Resolver<Maybe<Array<Maybe<ResolversTypes['MessengerChannel']>>>, ParentType, ContextType, Partial<QueryMessengerMyChannelsArgs>>;
  messengerThreadMessages?: Resolver<Maybe<Array<Maybe<ResolversTypes['MessengerMessage']>>>, ParentType, ContextType, Partial<QueryMessengerThreadMessagesArgs>>;
  messengerUnreadDMs?: Resolver<Maybe<Array<Maybe<ResolversTypes['MessengerUnreadDM']>>>, ParentType, ContextType, Partial<QueryMessengerUnreadDMsArgs>>;
  messengerUser?: Resolver<Maybe<ResolversTypes['MessengerUser']>, ParentType, ContextType, Partial<QueryMessengerUserArgs>>;
  messengerUsers?: Resolver<Maybe<Array<Maybe<ResolversTypes['MessengerUser']>>>, ParentType, ContextType, Partial<QueryMessengerUsersArgs>>;
  moregroups?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeGroup']>>>, ParentType, ContextType, Partial<QueryMoregroupsArgs>>;
  notificationUnreadCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  notifications?: Resolver<Maybe<Array<Maybe<ResolversTypes['Notification']>>>, ParentType, ContextType>;
  object?: Resolver<Maybe<Array<Maybe<ResolversTypes['Object']>>>, ParentType, ContextType, Partial<QueryObjectArgs>>;
  page?: Resolver<Maybe<Array<Maybe<ResolversTypes['Page']>>>, ParentType, ContextType, Partial<QueryPageArgs>>;
  pagecomments?: Resolver<Maybe<ResolversTypes['MessengerPageComments']>, ParentType, ContextType, Partial<QueryPagecommentsArgs>>;
  pageprogress?: Resolver<Maybe<Array<Maybe<ResolversTypes['ProgressScore']>>>, ParentType, ContextType, Partial<QueryPageprogressArgs>>;
  passagenotes?: Resolver<Maybe<ResolversTypes['PassageNotes']>, ParentType, ContextType, Partial<QueryPassagenotesArgs>>;
  people?: Resolver<Maybe<Array<Maybe<ResolversTypes['People']>>>, ParentType, ContextType, Partial<QueryPeopleArgs>>;
  peoplenetwork?: Resolver<Maybe<ResolversTypes['PeopleNetwork']>, ParentType, ContextType>;
  person?: Resolver<Maybe<Array<Maybe<ResolversTypes['People']>>>, ParentType, ContextType, Partial<QueryPersonArgs>>;
  place?: Resolver<Maybe<Array<Maybe<ResolversTypes['Place']>>>, ParentType, ContextType, Partial<QueryPlaceArgs>>;
  places?: Resolver<Maybe<Array<Maybe<ResolversTypes['Place']>>>, ParentType, ContextType, Partial<QueryPlacesArgs>>;
  postcomments?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeFeedItem']>>>, ParentType, ContextType, Partial<QueryPostcommentsArgs>>;
  publications?: Resolver<Maybe<Array<Maybe<ResolversTypes['Source']>>>, ParentType, ContextType>;
  queue?: Resolver<Maybe<Array<Maybe<ResolversTypes['TextBlock']>>>, ParentType, ContextType, Partial<QueryQueueArgs>>;
  read?: Resolver<Maybe<ResolversTypes['ReadBlock']>, ParentType, ContextType, Partial<QueryReadArgs>>;
  readingplan?: Resolver<Maybe<ResolversTypes['ReadingPlan']>, ParentType, ContextType, Partial<QueryReadingplanArgs>>;
  readingplanhistory?: Resolver<Maybe<Array<Maybe<ResolversTypes['ReadingPlanSummary']>>>, ParentType, ContextType, Partial<QueryReadingplanhistoryArgs>>;
  readingplanpreview?: Resolver<Maybe<ResolversTypes['ReadingPlanPreview']>, ParentType, ContextType, RequireFields<QueryReadingplanpreviewArgs, 'config'>>;
  readingplanprograms?: Resolver<Maybe<Array<Maybe<ResolversTypes['ReadingPlanProgram']>>>, ParentType, ContextType, Partial<QueryReadingplanprogramsArgs>>;
  readingplansegment?: Resolver<Maybe<ResolversTypes['ReadingPlanSegment']>, ParentType, ContextType, Partial<QueryReadingplansegmentArgs>>;
  requestedUsers?: Resolver<Maybe<Array<Maybe<ResolversTypes['HomeUser']>>>, ParentType, ContextType, Partial<QueryRequestedUsersArgs>>;
  scripture?: Resolver<Maybe<ResolversTypes['ScriptureResults']>, ParentType, ContextType, Partial<QueryScriptureArgs>>;
  search?: Resolver<Maybe<Array<Maybe<ResolversTypes['SearchResult']>>>, ParentType, ContextType, Partial<QuerySearchArgs>>;
  searchAll?: Resolver<ResolversTypes['SearchAllResult'], ParentType, ContextType, RequireFields<QuerySearchAllArgs, 'query'>>;
  section?: Resolver<Maybe<Array<Maybe<ResolversTypes['Section']>>>, ParentType, ContextType, Partial<QuerySectionArgs>>;
  shortlink?: Resolver<Maybe<ResolversTypes['Shortlinks']>, ParentType, ContextType, Partial<QueryShortlinkArgs>>;
  signin?: Resolver<Maybe<ResolversTypes['SignIn']>, ParentType, ContextType, Partial<QuerySigninArgs>>;
  socialsignin?: Resolver<Maybe<ResolversTypes['SignIn']>, ParentType, ContextType, Partial<QuerySocialsigninArgs>>;
  sourceUsage?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType, Partial<QuerySourceUsageArgs>>;
  sources?: Resolver<Maybe<Array<Maybe<ResolversTypes['Source']>>>, ParentType, ContextType, Partial<QuerySourcesArgs>>;
  studygrouphistory?: Resolver<Maybe<ResolversTypes['StudyGroupHistory']>, ParentType, ContextType, Partial<QueryStudygrouphistoryArgs>>;
  studylog?: Resolver<Maybe<ResolversTypes['StudyLog']>, ParentType, ContextType, Partial<QueryStudylogArgs>>;
  test?: Resolver<Maybe<ResolversTypes['Test']>, ParentType, ContextType>;
  text?: Resolver<Maybe<Array<Maybe<ResolversTypes['TextBlock']>>>, ParentType, ContextType, Partial<QueryTextArgs>>;
  timeline?: Resolver<Maybe<Array<Maybe<ResolversTypes['Event']>>>, ParentType, ContextType, Partial<QueryTimelineArgs>>;
  tokensignin?: Resolver<Maybe<ResolversTypes['SignIn']>, ParentType, ContextType, Partial<QueryTokensigninArgs>>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, Partial<QueryUserArgs>>;
  userdailyscores?: Resolver<Maybe<ResolversTypes['UserDailyScore']>, ParentType, ContextType, Partial<QueryUserdailyscoresArgs>>;
  userprogress?: Resolver<Maybe<ResolversTypes['ProgressScore']>, ParentType, ContextType, Partial<QueryUserprogressArgs>>;
  users?: Resolver<Maybe<Array<Maybe<ResolversTypes['User']>>>, ParentType, ContextType, Partial<QueryUsersArgs>>;
  versehighlights?: Resolver<Maybe<Array<Maybe<ResolversTypes['ScriptureHighlights']>>>, ParentType, ContextType, Partial<QueryVersehighlightsArgs>>;
  verses?: Resolver<Maybe<Array<Maybe<ResolversTypes['Scripture']>>>, ParentType, ContextType, Partial<QueryVersesArgs>>;
};

export type ReadBlockResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ReadBlock'] = ResolversParentTypes['ReadBlock']> = {
  next_ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  prev_ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  sections?: Resolver<Maybe<Array<Maybe<ResolversTypes['ReadSection']>>>, ParentType, ContextType>;
  verse_count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  verse_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReadExtraResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ReadExtra'] = ResolversParentTypes['ReadExtra']> = {
  chiasmus?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  commentary?: Resolver<Maybe<Array<Maybe<ResolversTypes['Int']>>>, ParentType, ContextType>;
  events?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  fax?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  images?: Resolver<Maybe<Array<Maybe<ResolversTypes['Int']>>>, ParentType, ContextType>;
  maps?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  notes?: Resolver<Maybe<Array<Maybe<ResolversTypes['Int']>>>, ParentType, ContextType>;
  people?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  places?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  references?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReadLineResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ReadLine'] = ResolversParentTypes['ReadLine']> = {
  format?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  verse_num?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReadSectionResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ReadSection'] = ResolversParentTypes['ReadSection']> = {
  blocks?: Resolver<Maybe<Array<Maybe<ResolversTypes['ReadUnit']>>>, ParentType, ContextType>;
  extra?: Resolver<Maybe<Array<Maybe<ResolversTypes['ReadExtra']>>>, ParentType, ContextType>;
  heading?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  meta?: Resolver<Maybe<Array<Maybe<ResolversTypes['SectionMeta']>>>, ParentType, ContextType>;
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse_count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  verse_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReadUnitResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ReadUnit'] = ResolversParentTypes['ReadUnit']> = {
  lines?: Resolver<Maybe<Array<Maybe<ResolversTypes['ReadLine']>>>, ParentType, ContextType>;
  person_slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse_count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  verse_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  voice?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReadingPlanResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ReadingPlan'] = ResolversParentTypes['ReadingPlan']> = {
  config?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  current?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  duedate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  progress?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  segments?: Resolver<Maybe<Array<Maybe<ResolversTypes['ReadingPlanSegment']>>>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startdate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReadingPlanPreviewResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ReadingPlanPreview'] = ResolversParentTypes['ReadingPlanPreview']> = {
  enddate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  parts?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  segments?: Resolver<Maybe<Array<Maybe<ResolversTypes['PreviewSegment']>>>, ParentType, ContextType>;
  warnings?: Resolver<Maybe<Array<Maybe<ResolversTypes['PlanWarning']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReadingPlanProgramResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ReadingPlanProgram'] = ResolversParentTypes['ReadingPlanProgram']> = {
  config?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  durationLabel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  scopeLabel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReadingPlanResultResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ReadingPlanResult'] = ResolversParentTypes['ReadingPlanResult']> = {
  isSuccess?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  msg?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  plan?: Resolver<Maybe<ResolversTypes['ReadingPlan']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReadingPlanSegmentResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ReadingPlanSegment'] = ResolversParentTypes['ReadingPlanSegment']> = {
  duedate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  end?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  period?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  progress?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  sections?: Resolver<Maybe<Array<Maybe<ResolversTypes['Section']>>>, ParentType, ContextType>;
  start?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReadingPlanSummaryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ReadingPlanSummary'] = ResolversParentTypes['ReadingPlanSummary']> = {
  enddate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  progress?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startdate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReferenceResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Reference'] = ResolversParentTypes['Reference']> = {
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  significant?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type RelationResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Relation'] = ResolversParentTypes['Relation']> = {
  person?: Resolver<Maybe<ResolversTypes['People']>, ParentType, ContextType>;
  relation?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ResultCardResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ResultCard'] = ResolversParentTypes['ResultCard']> = {
  highlight?: Resolver<Maybe<ResolversTypes['HighlightRange']>, ParentType, ContextType>;
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  score?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  snippet?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type RowResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Row'] = ResolversParentTypes['Row']> = {
  capsulation?: Resolver<Maybe<ResolversTypes['Caps']>, ParentType, ContextType>;
  connection?: Resolver<Maybe<ResolversTypes['Conn']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  narration?: Resolver<Maybe<ResolversTypes['Narration']>, ParentType, ContextType>;
  parent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  weight?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ScriptureResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Scripture'] = ResolversParentTypes['Scripture']> = {
  book?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  chapter?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  heading?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  reference?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  verse_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  version?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ScriptureHighlightsResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ScriptureHighlights'] = ResolversParentTypes['ScriptureHighlights']> = {
  bible_highlight?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  bible_verse_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  bom_highlight?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  bom_verse_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  isQuote?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ScriptureResultsResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ScriptureResults'] = ResolversParentTypes['ScriptureResults']> = {
  passages?: Resolver<Maybe<Array<Maybe<ResolversTypes['Passage']>>>, ParentType, ContextType>;
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verses?: Resolver<Maybe<Array<Maybe<ResolversTypes['Scripture']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SearchAllResultResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['SearchAllResult'] = ResolversParentTypes['SearchAllResult']> = {
  commentary?: Resolver<Array<ResolversTypes['ResultCard']>, ParentType, ContextType>;
  events?: Resolver<Array<ResolversTypes['ResultCard']>, ParentType, ContextType>;
  narration?: Resolver<Array<ResolversTypes['ResultCard']>, ParentType, ContextType>;
  pages?: Resolver<Array<ResolversTypes['ResultCard']>, ParentType, ContextType>;
  people?: Resolver<Array<ResolversTypes['ResultCard']>, ParentType, ContextType>;
  places?: Resolver<Array<ResolversTypes['ResultCard']>, ParentType, ContextType>;
  semantic?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  verses?: Resolver<Array<ResolversTypes['SearchResult']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SearchResultResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['SearchResult'] = ResolversParentTypes['SearchResult']> = {
  highlight?: Resolver<Maybe<ResolversTypes['HighlightRange']>, ParentType, ContextType>;
  lang?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  narration?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  page?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  reference?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  section?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  speaker?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  voice?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SectionResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Section'] = ResolversParentTypes['Section']> = {
  ambient?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  badge?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  page?: Resolver<Maybe<ResolversTypes['Page']>, ParentType, ContextType>;
  parent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ref?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  rows?: Resolver<Maybe<Array<Maybe<ResolversTypes['Row']>>>, ParentType, ContextType>;
  sectionText?: Resolver<Maybe<Array<Maybe<ResolversTypes['TextBlock']>>>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  weight?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SectionMetaResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['SectionMeta'] = ResolversParentTypes['SectionMeta']> = {
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verse_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SendbirdUserResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['SendbirdUser'] = ResolversParentTypes['SendbirdUser']> = {
  is_active?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  is_online?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  joined_ts?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  last_seen_at?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['SendbirdUserMetadata']>, ParentType, ContextType>;
  nickname?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  profile_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  require_auth_for_profile_image?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  role?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  state?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  user_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SendbirdUserMetadataResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['SendbirdUserMetadata'] = ResolversParentTypes['SendbirdUserMetadata']> = {
  bookmark?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  summary?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ShortlinksResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Shortlinks'] = ResolversParentTypes['Shortlinks']> = {
  hash?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  string?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SignInResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['SignIn'] = ResolversParentTypes['SignIn']> = {
  isSuccess?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  msg?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  profile_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  social?: Resolver<Maybe<ResolversTypes['Social']>, ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SocialResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Social'] = ResolversParentTypes['Social']> = {
  access_token?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  nickname?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  profile_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  user_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SourceResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Source'] = ResolversParentTypes['Source']> = {
  excerpt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source_description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source_id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source_name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source_publisher?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source_rating?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source_short?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source_slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source_title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source_year?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type StudyGroupResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['StudyGroup'] = ResolversParentTypes['StudyGroup']> = {
  channel_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  cover_url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  created_at?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  custom_type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  data?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  max_length_message?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  member_count?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  members?: Resolver<Maybe<Array<Maybe<ResolversTypes['SendbirdUser']>>>, ParentType, ContextType>;
  messages?: Resolver<Maybe<Array<Maybe<ResolversTypes['Message']>>>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type StudyGroupHistoryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['StudyGroupHistory'] = ResolversParentTypes['StudyGroupHistory']> = {
  dates?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  studyGroupID?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  studyGroupName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  userHistories?: Resolver<Maybe<Array<Maybe<ResolversTypes['UserHistory']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type StudyLogResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['StudyLog'] = ResolversParentTypes['StudyLog']> = {
  sessions?: Resolver<Maybe<Array<Maybe<ResolversTypes['UserSession']>>>, ParentType, ContextType>;
  summary?: Resolver<Maybe<ResolversTypes['UserStudySummary']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TestResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Test'] = ResolversParentTypes['Test']> = {
  db?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  http?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  http2?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TextBlockResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['TextBlock'] = ResolversParentTypes['TextBlock']> = {
  chrono?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  comIds?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  coms?: Resolver<Maybe<Array<Maybe<ResolversTypes['Commentary']>>>, ParentType, ContextType>;
  content?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  duration?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  guid?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  heading?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  imgIds?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  imgs?: Resolver<Maybe<Array<Maybe<ResolversTypes['Image']>>>, ParentType, ContextType>;
  link?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  narration?: Resolver<Maybe<ResolversTypes['Narration']>, ParentType, ContextType>;
  next?: Resolver<Maybe<Array<Maybe<ResolversTypes['NarrativePath']>>>, ParentType, ContextType>;
  note_count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  notes?: Resolver<Maybe<Array<Maybe<ResolversTypes['Note']>>>, ParentType, ContextType>;
  parent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  parentSlug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  parent_page?: Resolver<Maybe<ResolversTypes['Page']>, ParentType, ContextType>;
  parent_section?: Resolver<Maybe<ResolversTypes['Section']>, ParentType, ContextType>;
  people?: Resolver<Maybe<Array<Maybe<ResolversTypes['People']>>>, ParentType, ContextType>;
  places?: Resolver<Maybe<Array<Maybe<ResolversTypes['Place']>>>, ParentType, ContextType>;
  quotes?: Resolver<Maybe<Array<Maybe<ResolversTypes['TextBlock']>>>, ParentType, ContextType>;
  refs?: Resolver<Maybe<Array<Maybe<ResolversTypes['Reference']>>>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, Partial<TextBlockStatusArgs>>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  bookmark?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  complete?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  finished?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  history?: Resolver<Maybe<Array<Maybe<ResolversTypes['UserHistory']>>>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  networks?: Resolver<Maybe<Array<Maybe<ResolversTypes['Network']>>>, ParentType, ContextType>;
  progress?: Resolver<Maybe<ResolversTypes['ProgressScore']>, ParentType, ContextType>;
  sessions?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  social?: Resolver<Maybe<ResolversTypes['Social']>, ParentType, ContextType>;
  started?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  time?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  zip?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserDailyScoreResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['UserDailyScore'] = ResolversParentTypes['UserDailyScore']> = {
  dates?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  progress?: Resolver<Maybe<Array<Maybe<ResolversTypes['Float']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserHistoryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['UserHistory'] = ResolversParentTypes['UserHistory']> = {
  completed?: Resolver<Maybe<Array<Maybe<ResolversTypes['Float']>>>, ParentType, ContextType>;
  dates?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserSessionResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['UserSession'] = ResolversParentTypes['UserSession']> = {
  datetime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  duration?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  timestamp?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserStudySummaryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['UserStudySummary'] = ResolversParentTypes['UserStudySummary']> = {
  count?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  duration?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  finished?: Resolver<Maybe<Array<Maybe<ResolversTypes['Float']>>>, ParentType, ContextType>;
  first?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type XrelResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Xrel'] = ResolversParentTypes['Xrel']> = {
  dst_name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dst_slug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dst_title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dst_type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  note?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  rel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  srcweight?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  verse_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = AppContext> = {
  Book?: BookResolvers<ContextType>;
  Bot?: BotResolvers<ContextType>;
  Caps?: CapsResolvers<ContextType>;
  Chiasmus?: ChiasmusResolvers<ContextType>;
  ChiasmusLine?: ChiasmusLineResolvers<ContextType>;
  Commentary?: CommentaryResolvers<ContextType>;
  Conn?: ConnResolvers<ContextType>;
  ContentLink?: ContentLinkResolvers<ContextType>;
  Division?: DivisionResolvers<ContextType>;
  Event?: EventResolvers<ContextType>;
  EventGrid?: EventGridResolvers<ContextType>;
  Fax?: FaxResolvers<ContextType>;
  FaxIndex?: FaxIndexResolvers<ContextType>;
  HighlightRange?: HighlightRangeResolvers<ContextType>;
  HistoricalDocument?: HistoricalDocumentResolvers<ContextType>;
  HomeFeed?: HomeFeedResolvers<ContextType>;
  HomeFeedItem?: HomeFeedItemResolvers<ContextType>;
  HomeGroup?: HomeGroupResolvers<ContextType>;
  HomeSampler?: HomeSamplerResolvers<ContextType>;
  HomeUser?: HomeUserResolvers<ContextType>;
  Image?: ImageResolvers<ContextType>;
  Index?: IndexResolvers<ContextType>;
  JSON?: GraphQLScalarType;
  JoinedGroup?: JoinedGroupResolvers<ContextType>;
  Label?: LabelResolvers<ContextType>;
  LeaderBoard?: LeaderBoardResolvers<ContextType>;
  LogResult?: LogResultResolvers<ContextType>;
  Map?: MapResolvers<ContextType>;
  MapMove?: MapMoveResolvers<ContextType>;
  MapStory?: MapStoryResolvers<ContextType>;
  Markdown?: MarkdownResolvers<ContextType>;
  Menu?: MenuResolvers<ContextType>;
  Message?: MessageResolvers<ContextType>;
  MessengerChannel?: MessengerChannelResolvers<ContextType>;
  MessengerMember?: MessengerMemberResolvers<ContextType>;
  MessengerMessage?: MessengerMessageResolvers<ContextType>;
  MessengerPageComments?: MessengerPageCommentsResolvers<ContextType>;
  MessengerReaction?: MessengerReactionResolvers<ContextType>;
  MessengerThreadInfo?: MessengerThreadInfoResolvers<ContextType>;
  MessengerUnreadDM?: MessengerUnreadDmResolvers<ContextType>;
  MessengerUser?: MessengerUserResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Narration?: NarrationResolvers<ContextType>;
  NarrativePath?: NarrativePathResolvers<ContextType>;
  Network?: NetworkResolvers<ContextType>;
  Note?: NoteResolvers<ContextType>;
  Notification?: NotificationResolvers<ContextType>;
  Object?: ObjectResolvers<ContextType>;
  Page?: PageResolvers<ContextType>;
  Passage?: PassageResolvers<ContextType>;
  PassageNotes?: PassageNotesResolvers<ContextType>;
  People?: PeopleResolvers<ContextType>;
  PeopleLink?: PeopleLinkResolvers<ContextType>;
  PeopleNetwork?: PeopleNetworkResolvers<ContextType>;
  PeopleNode?: PeopleNodeResolvers<ContextType>;
  Place?: PlaceResolvers<ContextType>;
  PlanWarning?: PlanWarningResolvers<ContextType>;
  PreviewSegment?: PreviewSegmentResolvers<ContextType>;
  ProgressScore?: ProgressScoreResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  ReadBlock?: ReadBlockResolvers<ContextType>;
  ReadExtra?: ReadExtraResolvers<ContextType>;
  ReadLine?: ReadLineResolvers<ContextType>;
  ReadSection?: ReadSectionResolvers<ContextType>;
  ReadUnit?: ReadUnitResolvers<ContextType>;
  ReadingPlan?: ReadingPlanResolvers<ContextType>;
  ReadingPlanPreview?: ReadingPlanPreviewResolvers<ContextType>;
  ReadingPlanProgram?: ReadingPlanProgramResolvers<ContextType>;
  ReadingPlanResult?: ReadingPlanResultResolvers<ContextType>;
  ReadingPlanSegment?: ReadingPlanSegmentResolvers<ContextType>;
  ReadingPlanSummary?: ReadingPlanSummaryResolvers<ContextType>;
  Reference?: ReferenceResolvers<ContextType>;
  Relation?: RelationResolvers<ContextType>;
  ResultCard?: ResultCardResolvers<ContextType>;
  Row?: RowResolvers<ContextType>;
  Scripture?: ScriptureResolvers<ContextType>;
  ScriptureHighlights?: ScriptureHighlightsResolvers<ContextType>;
  ScriptureResults?: ScriptureResultsResolvers<ContextType>;
  SearchAllResult?: SearchAllResultResolvers<ContextType>;
  SearchResult?: SearchResultResolvers<ContextType>;
  Section?: SectionResolvers<ContextType>;
  SectionMeta?: SectionMetaResolvers<ContextType>;
  SendbirdUser?: SendbirdUserResolvers<ContextType>;
  SendbirdUserMetadata?: SendbirdUserMetadataResolvers<ContextType>;
  Shortlinks?: ShortlinksResolvers<ContextType>;
  SignIn?: SignInResolvers<ContextType>;
  Social?: SocialResolvers<ContextType>;
  Source?: SourceResolvers<ContextType>;
  StudyGroup?: StudyGroupResolvers<ContextType>;
  StudyGroupHistory?: StudyGroupHistoryResolvers<ContextType>;
  StudyLog?: StudyLogResolvers<ContextType>;
  Test?: TestResolvers<ContextType>;
  TextBlock?: TextBlockResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  UserDailyScore?: UserDailyScoreResolvers<ContextType>;
  UserHistory?: UserHistoryResolvers<ContextType>;
  UserSession?: UserSessionResolvers<ContextType>;
  UserStudySummary?: UserStudySummaryResolvers<ContextType>;
  Xrel?: XrelResolvers<ContextType>;
};

