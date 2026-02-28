# Bots API (Developer Reference)

This document is the implementation-aligned contract for bot integration in AChat.

- Source of truth: `src/routes.js`, `src/realtime.js`, `src/store.js`, `src/middleware/requireAuth.js`
- Sync date: 2026-02-28
- Scope: HTTP bot APIs, WS realtime APIs, payload schemas, permissions, and failure modes

## 1. Core Concepts

- A bot is a normal user record with `isBot: true`.
- Bot IDs are 7-digit numeric strings (same format as human user IDs).
- Room IDs are 4-digit numeric strings.
- Message IDs are 10-digit numeric strings.
- Bot auth token format is:
  - `achat_bot_<botUserId>.<secret>`
  - Example: `achat_bot_1234567.a1b2c3...`
- Bots can be in multiple rooms at once and be active in all joined WS room channels.

## 2. Authentication

## 2.1 HTTP Auth

Use bearer auth for bot runtime calls:

```http
Authorization: Bearer <bot_token>
```

Auth behavior:

- If a valid session cookie exists, it is used first.
- If no valid session is found, bearer token auth is attempted.
- Bot runtime should use bearer tokens directly and not rely on sessions.

## 2.2 WebSocket Auth (Socket.IO v2.3)

Bots can authenticate during handshake via any of:

1. Header: `Authorization: Bearer <bot_token>`
2. Query: `token=<bot_token>` or `botToken=<bot_token>`
3. Query bearer form: `authorization=Bearer <bot_token>`
4. Auth payload: `auth.token` or `auth.botToken` (when client supports it)

If auth fails, socket connect is rejected with `Unauthorized`.

## 3. Bot Lifecycle

1. Human developer enables Developer Mode.
2. Human creates bot app from Manage Apps (or HTTP API).
3. Bot receives plaintext token once (create/regenerate responses only).
4. Bot requests room join using `POST /api/rooms/:roomId/join`.
5. Room owner approves bot from waitlist.
6. Bot can then read/send room messages (HTTP and WS).
7. Bot can WS-join multiple approved rooms and process all in parallel.

Important membership rule:

- Bots always enter `pending` on join request, even for public rooms.

## 4. Data Schemas

## 4.1 Public User Object

Returned in many APIs as `user`, `bot`, `members[]`, etc.

```json
{
  "id": "1234567",
  "displayName": "Ops Bot",
  "developerMode": false,
  "avatarUrl": null,
  "oauthProvider": "bot",
  "email": null,
  "hasPasswordLogin": false,
  "passwordLoginEmail": null,
  "passwordUpdatedAt": null,
  "hasAccountHash": false,
  "accountHashUpdatedAt": null,
  "isBot": true,
  "botOwnerUserId": "7654321",
  "botTokenUpdatedAt": "2026-02-28T12:00:00.000Z",
  "createdAt": "2026-02-28T12:00:00.000Z",
  "lastLoginAt": "2026-02-28T12:00:00.000Z"
}
```

## 4.2 Room Summary Object

Used in `rooms:update`, `/api/rooms`, `/api/bot/me.rooms`, `/api/me.rooms`.

```json
{
  "id": "7463",
  "name": "project-room",
  "isPrivate": true,
  "isDiscoverable": true,
  "ownerUserId": "7654321",
  "ownerDisplayName": "axrxvm",
  "memberCount": 5,
  "pendingCount": 1,
  "accessStatus": "member",
  "canAccess": true,
  "createdAt": "2026-02-28T12:00:00.000Z",
  "updatedAt": "2026-02-28T12:00:00.000Z",
  "latestMessage": {
    "id": "1234567890",
    "username": "alice",
    "userIsBot": false,
    "text": "hello",
    "createdAt": "2026-02-28T12:10:00.000Z"
  },
  "isOwner": false
}
```

Notes:

- `isOwner` is added by realtime layer.
- `latestMessage` is `null` for pending access.

## 4.3 Message Object

```json
{
  "id": "1234567890",
  "roomId": "7463",
  "userId": "1234567",
  "username": "Ops Bot",
  "userIsBot": true,
  "avatarUrl": null,
  "text": "pong",
  "createdAt": "2026-02-28T12:11:00.000Z",
  "editedAt": "2026-02-28T12:12:30.000Z"
}
```

Notes:

- `editedAt` is `null` when a message has never been edited.

## 4.4 Presence Member Object

```json
{
  "id": "1234567",
  "displayName": "Ops Bot",
  "avatarUrl": null,
  "isBot": true,
  "online": true,
  "presenceStatus": "active"
}
```

`presenceStatus` values:

- `offline`: no connected sockets
- `idle`: connected but no focused/active room context
- `active`: active in this room
- `other`: focused/active elsewhere

## 5. Bot App Management APIs (Human Developer Only)

These endpoints require:

- session auth (human account)
- `developerMode: true`
- caller must not be a bot

## 5.1 List Bots

`GET /api/apps/bots`

Response:

```json
{
  "bots": [/* Public User Object[] where isBot=true */]
}
```

## 5.2 Create Bot

`POST /api/apps/bots`

Body:

```json
{
  "displayName": "Ops Bot"
}
```

Response `201`:

```json
{
  "bot": {/* Public User Object */},
  "authToken": "achat_bot_1234567.xxxxx",
  "tokenType": "Bearer"
}
```

## 5.3 Rename Bot

`PATCH /api/apps/bots/:botUserId`

Body:

```json
{
  "displayName": "Ops Bot v2"
}
```

Response:

```json
{
  "bot": {/* Public User Object */}
}
```

## 5.4 Regenerate Bot Token

`POST /api/apps/bots/:botUserId/token`

Response `201`:

```json
{
  "bot": {/* Public User Object */},
  "authToken": "achat_bot_1234567.newtoken",
  "tokenType": "Bearer"
}
```

Token rotation behavior:

- old token immediately becomes invalid

## 5.5 Delete Bot

`DELETE /api/apps/bots/:botUserId`

Response:

```json
{
  "ok": true,
  "botUserId": "1234567"
}
```

Delete effects:

- bot account removed
- bot memberships/waitlist entries removed
- related room/presence updates emitted

## 6. Bot-Only Runtime APIs

These endpoints require bot bearer auth (`isBot: true`).

## 6.1 Bot Identity + Visible Rooms

`GET /api/bot/me`

Response:

```json
{
  "user": {/* Public User Object */},
  "rooms": [/* Room Summary Object[] */]
}
```

## 6.2 Limited Room Info

`GET /api/bot/rooms/:roomId/info`

Rules:

- bot must be approved member of room

Response:

```json
{
  "room": {
    "id": "7463",
    "name": "project-room",
    "isPrivate": true,
    "isDiscoverable": true,
    "ownerUserId": "7654321",
    "ownerDisplayName": "axrxvm",
    "memberCount": 5,
    "pendingCount": 1,
    "createdAt": "2026-02-28T12:00:00.000Z",
    "updatedAt": "2026-02-28T12:12:00.000Z"
  }
}
```

Status behavior:

- `404`: room not found
- `403`: no approved access
- `400`: other validation failures

## 6.3 Limited User Info in Room Context

`GET /api/bot/users/:targetUserId/info?roomId=<roomId>`

Rules:

- `roomId` query is required
- requester bot must be approved member in that room
- target user must be `member` or `pending` in that room

Response:

```json
{
  "user": {
    "id": "7654321",
    "displayName": "aaravalt",
    "avatarUrl": null,
    "isBot": false,
    "createdAt": "2026-02-28T12:00:00.000Z",
    "lastLoginAt": "2026-02-28T12:12:00.000Z",
    "roomId": "7463",
    "roomStatus": "member"
  }
}
```

Status behavior:

- `400`: missing `roomId` or generic validation error
- `404`: room/user not found
- `403`: no approved access

## 7. General Runtime APIs Available to Bots

These endpoints are not bot-only, but bot bearer tokens are allowed.

## 7.1 Discovery and Membership

- `GET /api/me` (returns bot user + rooms)
- `GET /api/rooms`
- `GET /api/discovery/rooms`
- `POST /api/rooms/:roomId/join`
- `POST /api/rooms/:roomId/leave`

`POST /api/rooms/:roomId/join` status behavior:

- `200`: `{ "room": ..., "status": "member" }` (already approved/member)
- `202`: `{ "room": ..., "status": "pending", "message": "Bot join request sent..." }`
- `404`: room/user resolution errors

## 7.2 Room Snapshot

`GET /api/rooms/:roomId?includeMessages=1&messageLimit=80`

Response:

```json
{
  "room": {/* room object */},
  "canAccess": true,
  "accessStatus": "member",
  "isOwner": false,
  "members": [/* Presence Member Object[] */],
  "pendingUsers": [/* limited users, only populated for room owner */],
  "messages": [/* Message Object[] */],
  "messageHasMore": false
}
```

Notes:

- `includeMessages=1` enables initial messages in this response.
- `messageLimit` is clamped to `1..200`.
- If access is `pending`:
  - `canAccess` is `false`
  - `members` is `[]`
  - `messages` is `[]`
  - `pendingUsers` is only populated if requester is owner.

## 7.3 Members

`GET /api/rooms/:roomId/members`

Response:

```json
{
  "roomId": "7463",
  "members": [/* Presence Member Object[] */],
  "pendingUsers": [/* limited user objects */],
  "ownerUserId": "7654321"
}
```

Status behavior:

- `403` with `"Cannot view members until approved"` when pending

## 7.4 Messages

## 7.4.1 List

`GET /api/rooms/:roomId/messages?limit=80&beforeId=<messageId>`

Rules:

- requires approved membership
- `limit` clamped to `1..200`

Response:

```json
{
  "roomId": "7463",
  "messages": [/* Message Object[] */],
  "hasMore": true
}
```

## 7.4.2 Create

`POST /api/rooms/:roomId/messages`

Body:

```json
{
  "text": "hello"
}
```

Rules:

- approved membership required
- text is normalized:
  - CRLF -> LF
  - max length `2000`
  - trimmed
  - empty after trim is rejected

Response `201`:

```json
{
  "message": {/* Message Object */}
}
```

## 7.4.3 Edit

`PATCH /api/rooms/:roomId/messages/:messageId`

Body:

```json
{
  "text": "updated text"
}
```

Rules:

- approved membership required
- only the message author can edit
- text normalization matches create:
  - CRLF -> LF
  - max length `2000`
  - trimmed
  - empty after trim is rejected

Response:

```json
{
  "message": {/* Message Object */}
}
```

Status behavior:

- `403` for permission failures
- `404` for missing room/message

## 7.4.4 Delete

`DELETE /api/rooms/:roomId/messages/:messageId`

Allowed if requester is:

- message author, or
- room owner

Response:

```json
{
  "ok": true,
  "roomId": "7463",
  "messageId": "1234567890"
}
```

Status behavior:

- `403` for permission failures
- `404` for missing room/message

## 7.5 Uploads

`POST /api/uploads/catbox`

Bots are allowed to call this endpoint.

Body:

```json
{
  "files": [
    {
      "name": "image.png",
      "mimeType": "image/png",
      "dataBase64": "data:image/png;base64,...."
    }
  ]
}
```

Limits:

- max files: `CATBOX_MAX_FILES_PER_UPLOAD` (default `4`)
- max size each: `CATBOX_MAX_FILE_BYTES` (default `12MB`)

## 8. Endpoints Not Available to Bot Tokens

These return `403` with:

```json
{
  "error": "This endpoint is not available for bot tokens"
}
```

Restricted endpoints:

- `POST /api/me/account-hash`
- `DELETE /api/me/account-hash`
- `POST /api/me/password`
- `DELETE /api/me/password`
- `PATCH /api/me/developer-mode`
- `PATCH /api/me`
- `DELETE /api/me`
- `POST /api/rooms`
- `PATCH /api/rooms/:roomId/privacy`
- `PATCH /api/rooms/:roomId/discovery`
- `POST /api/rooms/:roomId/ownership/:targetUserId`
- `DELETE /api/rooms/:roomId`
- `POST /api/rooms/:roomId/members/:targetUserId/kick`
- `POST /api/rooms/:roomId/waitlist/:targetUserId/approve`
- `POST /api/rooms/:roomId/waitlist/:targetUserId/reject`
- all `/api/apps/bots*` management endpoints

## 9. WebSocket Realtime Contract

Server: same origin Socket.IO endpoint as web app.

## 9.1 Connection Behavior

On successful connect:

- bot socket is associated with user
- server emits `rooms:update` immediately
- presence updates for bot member rooms continue via `room:presence`

## 9.2 Client -> Server Events

## `room:join` (ack-based)

Payload:

```json
{
  "roomId": "7463"
}
```

Ack success:

```json
{
  "ok": true,
  "roomId": "7463"
}
```

Ack error examples:

```json
{
  "error": "Room not found"
}
```

```json
{
  "error": "You do not have chat access to this room"
}
```

Bot behavior:

- requires approved membership (`member`)
- on success:
  - bot is added to that socket room channel
  - room ID is added to bot active room set
  - bot remains active in previously joined rooms too
- no implicit room-leave when joining additional rooms

## `message:send` (ack-based)

Payload:

```json
{
  "roomId": "7463",
  "text": "pong"
}
```

Ack success:

```json
{
  "ok": true,
  "message": {/* Message Object */}
}
```

Ack error:

```json
{
  "error": "roomId is required"
}
```

Bot rule:

- `roomId` is required for bots (no fallback to active room)

## `message:edit` (ack-based)

Payload:

```json
{
  "roomId": "7463",
  "messageId": "1234567890",
  "text": "updated text"
}
```

Ack success:

```json
{
  "ok": true,
  "message": {/* Message Object */}
}
```

Ack error examples:

```json
{
  "error": "messageId is required"
}
```

```json
{
  "error": "You are not allowed to edit this message"
}
```

Bot rule:

- `roomId` is required for bots (no fallback to active room)
- bot may edit only its own authored messages

## `typing:update`

Payload:

```json
{
  "roomId": "7463",
  "isTyping": true
}
```

Bot rule:

- `roomId` is required

## `presence:update`

Payload:

```json
{
  "activeRoomId": "7463",
  "isFocused": true
}
```

Bot behavior:

- event is accepted but bot focus is derived from joined active room set
- bots are considered focused when at least one room has been WS-joined

## 9.3 Server -> Client Events

## `rooms:update`

Payload:

- `Room Summary Object[]`

## `room:history`

Sent after successful `room:join`.

```json
{
  "roomId": "7463",
  "messages": [/* Message Object[] */],
  "hasMore": false
}
```

## `message:new`

- payload: `Message Object`

## `message:delete`

```json
{
  "roomId": "7463",
  "messageId": "1234567890"
}
```

## `message:update`

```json
{
  "message": {/* Message Object */}
}
```

## `typing:update`

```json
{
  "roomId": "7463",
  "userId": "1234567",
  "displayName": "Ops Bot",
  "isTyping": true
}
```

## `room:presence`

```json
{
  "roomId": "7463",
  "ownerUserId": "7654321",
  "members": [/* Presence Member Object[] */],
  "pendingUsers": [/* limited user objects */]
}
```

## 10. Presence Semantics for Bots

For each room, bot status is computed from connected sockets:

- `active`: at least one bot socket has WS-joined that room
- `other`: bot has active joined rooms, but not this room
- `idle`: bot socket connected but no active joined rooms
- `offline`: no connected sockets

Practical implication:

- If bot shows as `other`, it is online and focused elsewhere.
- To appear `active` in room `X`, bot must successfully `room:join` `X`.

## 11. Standard Error Shape

Most failures return:

```json
{
  "error": "Readable error message"
}
```

Some calls also vary status by message mapping (notably bot info endpoints and edit/delete message).

## 12. Recommended Integration Flow (Production)

1. Create bot app via `/api/apps/bots`.
2. Store token securely (never log it).
3. Call `/api/rooms/:roomId/join` for each target room.
4. Wait for owner approval where needed.
5. Connect Socket.IO with bot token.
6. For each approved room, emit `room:join` and wait for ack or `room:history`.
7. Process `message:new` / `message:update`; send responses with `message:send`.
8. Keep HTTP fallback for send/list in case socket is down.

Reference implementation:

- `examples/ping-pong-bot.js`

## 13. Troubleshooting

## Bot stuck in pending

- Cause: owner has not approved waitlist request.
- Verify with `/api/rooms` or `/api/bot/me` (`accessStatus: "pending"`).

## `room:join` returns `"You do not have chat access to this room"`

- Cause: bot is not an approved member yet.
- Fix: call `POST /api/rooms/:roomId/join`, then owner approval.

## Bot appears `other` instead of `active`

- Cause: bot socket is online but did not `room:join` that specific room.
- Fix: emit `room:join` for each room you want active.

## Message send denied

- Cause: bot lacks approved membership for that room.
- Fix: confirm `accessStatus === "member"`.
