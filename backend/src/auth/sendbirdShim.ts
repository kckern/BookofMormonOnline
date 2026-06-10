/**
 * Sendbird social shim — Sendbird was gutted from the backend (messaging
 * rip-and-replace pending). The legacy backend returns this exact shim shape
 * for the `social` field on signin/signup responses when MESSENGER_ENABLED is
 * false (src/resolvers/BomUser.ts:36). Replicated for byte-parity.
 */
export interface SocialShim {
  user_id: string;
  nickname: string;
  profile_url: string;
  access_token?: string | null;
}

export const sendbird = {
  loadUser(id: string, name?: string, url?: string): SocialShim {
    return { user_id: id, nickname: name || 'User', profile_url: url || '' };
  },
  createUser(id: string, name: string, url: string): SocialShim {
    return { user_id: id, nickname: name, profile_url: url };
  },
};
