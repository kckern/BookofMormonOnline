# GraphQL Mutations

This document provides comprehensive documentation for all GraphQL mutations available in the Book of Mormon Online API.

## Table of Contents

- [User Mutations](#user-mutations)
- [Community Mutations](#community-mutations)
- [Utility Mutations](#utility-mutations)
- [Messenger Mutations](#messenger-mutations)

---

## User Mutations

Mutations for user authentication, profile management, and activity logging.

### log

Logs user activity and study progress.

```graphql
mutation log($token: String!, $key: String!, $val: String): LogResult
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | Yes | User authentication token |
| `key` | String | Yes | Activity key identifier (e.g., "block", "page") |
| `val` | String | No | Value associated with the activity (e.g., slug, verse ID) |

**Returns:** `LogResult`

**Example:**

```graphql
mutation {
  log(token: "abc123", key: "block", val: "alma-32-21") {
    logged
    progress {
      slug
      count
      started
      completed
    }
  }
}
```

---

### changePassword

Changes the user's password.

```graphql
mutation changePassword($token: String, $password: String): Boolean
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | No | User authentication token |
| `password` | String | No | New password to set |

**Returns:** `Boolean` - True if password was changed successfully

**Example:**

```graphql
mutation {
  changePassword(token: "abc123", password: "newSecurePassword123")
}
```

---

### signup

Registers a new user account.

```graphql
mutation signup(
  $token: String
  $username: String
  $password: String
  $name: String
  $email: String
  $zip: String
): SignIn
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | No | Session token |
| `username` | String | No | Desired username |
| `password` | String | No | Account password |
| `name` | String | No | User's display name |
| `email` | String | No | User's email address |
| `zip` | String | No | User's ZIP/postal code |

**Returns:** `SignIn`

**Example:**

```graphql
mutation {
  signup(
    token: "session123"
    username: "newuser"
    password: "securePass123"
    name: "John Doe"
    email: "john@example.com"
    zip: "84601"
  ) {
    isSuccess
    msg
    user {
      user
      name
      email
    }
  }
}
```

---

### signout

Signs out the current user.

```graphql
mutation signout($token: String): Boolean
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | No | User authentication token |

**Returns:** `Boolean` - True if signout was successful

**Example:**

```graphql
mutation {
  signout(token: "abc123")
}
```

---

### editProfile

Updates user profile information.

```graphql
mutation editProfile($token: String, $name: String, $email: String, $zip: String): User
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | No | User authentication token |
| `name` | String | No | New display name |
| `email` | String | No | New email address |
| `zip` | String | No | New ZIP/postal code |

**Returns:** `User`

**Example:**

```graphql
mutation {
  editProfile(token: "abc123", name: "Jane Doe", email: "jane@example.com") {
    user
    name
    email
    zip
  }
}
```

---

## Community Mutations

Mutations for managing study groups and community features.

### joinGroup

Joins a study group using an invite hash.

```graphql
mutation joinGroup($token: String, $hash: String): JoinedGroup
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | No | User authentication token |
| `hash` | String | No | Invite hash/code for the group |

**Returns:** `JoinedGroup`

**Example:**

```graphql
mutation {
  joinGroup(token: "abc123", hash: "inviteHash456") {
    isSuccess
    msg
    channel
    user
  }
}
```

---

### joinOpenGroup

Joins a public/open study group directly.

```graphql
mutation joinOpenGroup($token: String, $url: String): JoinedGroup
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | No | User authentication token |
| `url` | String | No | Channel URL of the open group |

**Returns:** `JoinedGroup`

**Example:**

```graphql
mutation {
  joinOpenGroup(token: "abc123", url: "group_channel_123") {
    isSuccess
    msg
    channel
    user
  }
}
```

---

### requestToJoinGroup

Requests to join a private study group (requires approval).

```graphql
mutation requestToJoinGroup($token: String, $url: String): JoinedGroup
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | No | User authentication token |
| `url` | String | No | Channel URL of the private group |

**Returns:** `JoinedGroup`

**Example:**

```graphql
mutation {
  requestToJoinGroup(token: "abc123", url: "private_group_456") {
    isSuccess
    msg
    channel
    user
  }
}
```

---

### withdrawRequest

Withdraws a pending request to join a group.

```graphql
mutation withdrawRequest($token: String, $url: String): JoinedGroup
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | No | User authentication token |
| `url` | String | No | Channel URL of the group |

**Returns:** `JoinedGroup`

**Example:**

```graphql
mutation {
  withdrawRequest(token: "abc123", url: "private_group_456") {
    isSuccess
    msg
    channel
    user
  }
}
```

---

### processRequest

Approves or denies a user's request to join a group (admin only).

```graphql
mutation processRequest(
  $token: String
  $channel: String
  $user_id: String
  $grant: Boolean
): Boolean
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | No | Admin user authentication token |
| `channel` | String | No | Channel URL of the group |
| `user_id` | String | No | User ID of the requester |
| `grant` | Boolean | No | True to approve, false to deny |

**Returns:** `Boolean` - True if request was processed successfully

**Example:**

```graphql
mutation {
  processRequest(
    token: "adminToken123"
    channel: "private_group_456"
    user_id: "user789"
    grant: true
  )
}
```

---

### addBot

Adds a bot to a study group channel.

```graphql
mutation addBot($token: String, $channel: String, $bot: String): Boolean
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | No | User authentication token |
| `channel` | String | No | Channel URL of the group |
| `bot` | String | No | Bot identifier to add |

**Returns:** `Boolean` - True if bot was added successfully

**Example:**

```graphql
mutation {
  addBot(token: "abc123", channel: "group_channel_456", bot: "scripture_bot")
}
```

---

### removeBot

Removes a bot from a study group channel.

```graphql
mutation removeBot($token: String, $channel: String, $bot: String): Boolean
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | String | No | User authentication token |
| `channel` | String | No | Channel URL of the group |
| `bot` | String | No | Bot identifier to remove |

**Returns:** `Boolean` - True if bot was removed successfully

**Example:**

```graphql
mutation {
  removeBot(token: "abc123", channel: "group_channel_456", bot: "scripture_bot")
}
```

---

## Utility Mutations

General utility mutations.

### shortlink

Creates a shortlink from a string value.

```graphql
mutation shortlink($string: String): Shortlinks
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `string` | String | No | The string value to create a shortlink for |

**Returns:** `Shortlinks`

**Example:**

```graphql
mutation {
  shortlink(string: "/contents/alma/32?verse=21&highlight=true") {
    hash
    string
  }
}
```

---

## Messenger Mutations

Mutations for the messenger system (real-time chat and communication).

### messengerUpsertUser

Creates or updates a messenger user profile.

```graphql
mutation messengerUpsertUser(
  $userId: String!
  $nickname: String
  $profileUrl: String
  $bomUserId: String
  $metadata: JSON
  $isBot: Boolean
): MessengerUser!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `userId` | String | Yes | Unique user identifier |
| `nickname` | String | No | Display name for the user |
| `profileUrl` | String | No | URL to user's profile picture |
| `bomUserId` | String | No | Associated Book of Mormon Online user ID |
| `metadata` | JSON | No | Additional user metadata |
| `isBot` | Boolean | No | Whether this user is a bot |

**Returns:** `MessengerUser!`

**Example:**

```graphql
mutation {
  messengerUpsertUser(
    userId: "user123"
    nickname: "John Doe"
    profileUrl: "https://example.com/avatar.jpg"
    metadata: { role: "member" }
  ) {
    user_id
    nickname
    profile_url
    is_online
  }
}
```

---

### messengerUpdateNickname

Updates a user's display nickname.

```graphql
mutation messengerUpdateNickname($userId: String!, $nickname: String!): Boolean!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `userId` | String | Yes | User identifier |
| `nickname` | String | Yes | New nickname to set |

**Returns:** `Boolean!` - True if update was successful

**Example:**

```graphql
mutation {
  messengerUpdateNickname(userId: "user123", nickname: "Johnny D")
}
```

---

### messengerUpdateProfileUrl

Updates a user's profile picture URL.

```graphql
mutation messengerUpdateProfileUrl($userId: String!, $profileUrl: String!): Boolean!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `userId` | String | Yes | User identifier |
| `profileUrl` | String | Yes | New profile picture URL |

**Returns:** `Boolean!` - True if update was successful

**Example:**

```graphql
mutation {
  messengerUpdateProfileUrl(
    userId: "user123"
    profileUrl: "https://example.com/new-avatar.jpg"
  )
}
```

---

### messengerUpdateUserMetadata

Updates a user's metadata object.

```graphql
mutation messengerUpdateUserMetadata($userId: String!, $metadata: JSON!): Boolean!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `userId` | String | Yes | User identifier |
| `metadata` | JSON | Yes | New metadata object |

**Returns:** `Boolean!` - True if update was successful

**Example:**

```graphql
mutation {
  messengerUpdateUserMetadata(
    userId: "user123"
    metadata: { preferences: { notifications: true }, bookmark: "alma-32" }
  )
}
```

---

### messengerSetOnline

Sets a user's online/offline status.

```graphql
mutation messengerSetOnline($userId: String!, $isOnline: Boolean!): Boolean!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `userId` | String | Yes | User identifier |
| `isOnline` | Boolean | Yes | True for online, false for offline |

**Returns:** `Boolean!` - True if status was updated successfully

**Example:**

```graphql
mutation {
  messengerSetOnline(userId: "user123", isOnline: true)
}
```

---

### messengerCreateChannel

Creates a new messenger channel.

```graphql
mutation messengerCreateChannel($input: MessengerCreateChannelInput!): MessengerChannel!
```

**Input Type:** `MessengerCreateChannelInput`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channelUrl` | String | No | Custom channel URL (auto-generated if not provided) |
| `name` | String | Yes | Display name for the channel |
| `customType` | String | Yes | Channel type (e.g., "group", "study", "private") |
| `userIds` | [String!]! | Yes | Initial member user IDs |
| `operatorIds` | [String!]! | Yes | Channel operator (admin) user IDs |
| `coverUrl` | String | No | Channel cover image URL |
| `description` | String | No | Channel description |
| `metadata` | JSON | No | Additional channel metadata |
| `lang` | String | No | Channel language code |

**Returns:** `MessengerChannel!`

**Example:**

```graphql
mutation {
  messengerCreateChannel(
    input: {
      name: "Alma Study Group"
      customType: "study"
      userIds: ["user1", "user2", "user3"]
      operatorIds: ["user1"]
      coverUrl: "https://example.com/group-cover.jpg"
      description: "A group to study the book of Alma together"
      lang: "en"
    }
  ) {
    channel_url
    name
    custom_type
    member_count
    created_at
  }
}
```

---

### messengerAddMember

Adds a user to a channel.

```graphql
mutation messengerAddMember(
  $channelUrl: String!
  $userId: String!
  $role: String
): Boolean!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `channelUrl` | String | Yes | Channel URL to add member to |
| `userId` | String | Yes | User ID to add |
| `role` | String | No | Member role (e.g., "member", "operator") |

**Returns:** `Boolean!` - True if member was added successfully

**Example:**

```graphql
mutation {
  messengerAddMember(
    channelUrl: "channel_123"
    userId: "newUser456"
    role: "member"
  )
}
```

---

### messengerRemoveMember

Removes a user from a channel.

```graphql
mutation messengerRemoveMember($channelUrl: String!, $userId: String!): Boolean!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `channelUrl` | String | Yes | Channel URL to remove member from |
| `userId` | String | Yes | User ID to remove |

**Returns:** `Boolean!` - True if member was removed successfully

**Example:**

```graphql
mutation {
  messengerRemoveMember(channelUrl: "channel_123", userId: "user456")
}
```

---

### messengerMarkAsRead

Marks all messages in a channel as read for a user.

```graphql
mutation messengerMarkAsRead($channelUrl: String!, $userId: String!): Boolean!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `channelUrl` | String | Yes | Channel URL |
| `userId` | String | Yes | User ID marking as read |

**Returns:** `Boolean!` - True if marked successfully

**Example:**

```graphql
mutation {
  messengerMarkAsRead(channelUrl: "channel_123", userId: "user456")
}
```

---

### messengerPostMessage

Posts a new message to a channel.

```graphql
mutation messengerPostMessage($input: MessengerPostMessageInput!): MessengerMessage!
```

**Input Type:** `MessengerPostMessageInput`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channelUrl` | String | Yes | Channel URL to post to |
| `userId` | String | Yes | ID of user posting the message |
| `message` | String | Yes | Message content |
| `messageType` | String | No | Type of message (default: "MESG") |
| `customType` | String | No | Custom message type |
| `link` | MessengerLinkInput | No | Associated link/reference |
| `highlights` | [String!] | No | Text highlights in the message |
| `metadata` | JSON | No | Additional message metadata |
| `parentMessageId` | String | No | Parent message ID for replies/threads |

**Link Input Type:** `MessengerLinkInput`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | String | Yes | Link type (e.g., "verse", "page") |
| `target` | String | Yes | Link target (e.g., verse ID, page slug) |
| `aux` | String | No | Auxiliary link data |

**Returns:** `MessengerMessage!`

**Example:**

```graphql
mutation {
  messengerPostMessage(
    input: {
      channelUrl: "channel_123"
      userId: "user456"
      message: "This verse really speaks to me!"
      customType: "comment"
      link: { type: "verse", target: "alma-32-21" }
      highlights: ["faith", "things which are hoped for"]
    }
  ) {
    message_id
    channel_url
    message
    created_at
    user {
      user_id
      nickname
    }
  }
}
```

---

### messengerUpdateMessage

Updates an existing message.

```graphql
mutation messengerUpdateMessage(
  $channelUrl: String!
  $messageId: String!
  $message: String
  $customType: String
  $link: MessengerLinkInput
  $highlights: [String!]
  $metadata: JSON
): MessengerMessage
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `channelUrl` | String | Yes | Channel URL containing the message |
| `messageId` | String | Yes | ID of message to update |
| `message` | String | No | New message content |
| `customType` | String | No | New custom type |
| `link` | MessengerLinkInput | No | New link/reference |
| `highlights` | [String!] | No | New text highlights |
| `metadata` | JSON | No | New metadata |

**Returns:** `MessengerMessage` (null if update failed)

**Example:**

```graphql
mutation {
  messengerUpdateMessage(
    channelUrl: "channel_123"
    messageId: "msg_789"
    message: "Updated: This verse really speaks to me! (edited)"
  ) {
    message_id
    message
    updated_at
  }
}
```

---

### messengerDeleteMessage

Soft deletes a message.

```graphql
mutation messengerDeleteMessage($channelUrl: String!, $messageId: String!): Boolean!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `channelUrl` | String | Yes | Channel URL containing the message |
| `messageId` | String | Yes | ID of message to delete |

**Returns:** `Boolean!` - True if message was deleted successfully

**Example:**

```graphql
mutation {
  messengerDeleteMessage(channelUrl: "channel_123", messageId: "msg_789")
}
```

---

### messengerAddReaction

Adds a reaction (emoji) to a message.

```graphql
mutation messengerAddReaction(
  $messageId: String!
  $userId: String!
  $reactionKey: String!
): Boolean!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `messageId` | String | Yes | Message ID to react to |
| `userId` | String | Yes | User ID adding the reaction |
| `reactionKey` | String | Yes | Reaction identifier (e.g., "like", "heart") |

**Returns:** `Boolean!` - True if reaction was added successfully

**Example:**

```graphql
mutation {
  messengerAddReaction(
    messageId: "msg_789"
    userId: "user456"
    reactionKey: "heart"
  )
}
```

---

### messengerRemoveReaction

Removes a reaction from a message.

```graphql
mutation messengerRemoveReaction(
  $messageId: String!
  $userId: String!
  $reactionKey: String!
): Boolean!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `messageId` | String | Yes | Message ID to remove reaction from |
| `userId` | String | Yes | User ID removing the reaction |
| `reactionKey` | String | Yes | Reaction identifier to remove |

**Returns:** `Boolean!` - True if reaction was removed successfully

**Example:**

```graphql
mutation {
  messengerRemoveReaction(
    messageId: "msg_789"
    userId: "user456"
    reactionKey: "heart"
  )
}
```

---

## Return Types Reference

### LogResult

```graphql
type LogResult {
  logged: Boolean
  progress: ProgressScore
}
```

### SignIn

```graphql
type SignIn {
  isSuccess: Boolean
  msg: String
  user: User
  social: Social
  profile_url: String
}
```

### JoinedGroup

```graphql
type JoinedGroup {
  isSuccess: Boolean
  msg: String
  channel: String
  user: String
}
```

### Shortlinks

```graphql
type Shortlinks {
  hash: String
  string: String
}
```

### MessengerUser

```graphql
type MessengerUser {
  user_id: String!
  nickname: String
  profile_url: String
  metadata: JSON
  is_online: Boolean
  last_seen_at: Float
  is_bot: Boolean
}
```

### MessengerChannel

```graphql
type MessengerChannel {
  channel_url: String!
  name: String!
  cover_url: String
  custom_type: String!
  data: String
  metadata: JSON
  members: [MessengerMember!]
  member_count: Int
  unread_message_count: Int
  last_message: MessengerMessage
  created_at: Float
  lang: String
}
```

### MessengerMessage

```graphql
type MessengerMessage {
  message_id: String!
  channel_url: String!
  user: MessengerUser
  message_type: String!
  message: String!
  custom_type: String
  data: String
  parent_message_id: String
  thread_info: MessengerThreadInfo
  reactions: [MessengerReaction!]
  created_at: Float!
  updated_at: Float
}
```
