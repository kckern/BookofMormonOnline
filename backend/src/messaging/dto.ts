/**
 * Messaging DTOs — the cross-layer contract shared by the Kysely services, the
 * socket handlers, and the GraphQL community resolvers. Ported verbatim from
 * the legacy Sequelize lib (src/library/messenger.ts:20-78) so the client
 * (frontend/webapp/src/models/MessengerController.js) sees identical shapes.
 */

export interface UserDTO {
  user_id: string;
  nickname: string;
  profile_url: string;
  metadata: Record<string, unknown> | null;
  is_online: boolean;
  last_seen_at: number | null; // ms epoch
  is_bot: boolean;
}

export interface MemberDTO extends UserDTO {
  role: 'operator' | 'member';
  state: 'joined' | 'invited' | 'requested';
  is_muted: boolean;
}

export interface MessageDTO {
  message_id: string; // nanoid(11)
  channel_url: string;
  user: UserDTO | null;
  message_type: 'MESG' | 'FILE' | 'ADMN';
  message: string;
  custom_type: string;
  data: string; // JSON string carrying links/highlights (back-compat)
  parent_message_id: string | null;
  thread_info: {
    reply_count: number;
    most_replies: UserDTO[];
  } | null;
  reactions: { key: string; user_ids: string[] }[];
  created_at: number; // ms epoch
  updated_at: number;
}

export interface ChannelDTO {
  channel_url: string;
  name: string;
  cover_url: string;
  custom_type: string;
  data: string; // JSON string (back-compat)
  metadata: Record<string, unknown> | null;
  members: MemberDTO[];
  member_count: number;
  unread_message_count: number;
  last_message: MessageDTO | null;
  created_at: number;
  lang: string;
}

export interface HighlightDTO {
  id: string;
  message_id: string;
  ordinal: number;
  text: string;
}
