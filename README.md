# AChat

A minimal Discord-like real-time chat app built with Bun, Express, and Socket.IO.

## Features

- OAuth login flow using ALabs OAuth Worker API
- Optional account-hash login (generated as `word(optionalNumber)-word-word-word-number`)
- Optional email + password login (enabled per-user in settings; password hashes only)
- Optional Developer Mode with right-click copy tools for IDs/timestamps
- Developer Mode "Manage Apps" panel for creating and managing bot users
- Bot auth tokens (`Authorization: Bearer <token>`) for API-driven bot integrations
- MongoDB Atlas persistence with split clusters: main data and messages
- 7-digit user IDs and 4-digit room IDs
- Room ownership, creation, join/leave, and multi-room membership
- Real-time room history + presence updates
- Catbox-backed attachment uploads with inline media previews

## Run

```bash
bun run start
```

## Environment

- `MONGODB_MAIN_DB_URL` for users/rooms/sessions
- `MONGODB_MESSAGE_DB_URL` for chat messages
- `CATBOX_USER_HASH` (optional) if you want uploads tied to your Catbox account

## Bot API

- Enable **Developer Mode** in user settings.
- Use **Manage Apps** (left panel) to create a bot and generate a token.
- Call APIs with `Authorization: Bearer <bot_token>`.
- Bots can authenticate to Socket.IO realtime endpoints with the same token.
- Bot users can join rooms, but joins always enter pending state until owner approval.
- Full API docs: [docs/bots-api.md](./docs/bots-api.md)
- Sample bot: [examples/ping-pong-bot.js](./examples/ping-pong-bot.js)

## Sample Ping-Pong Bot

If needed, install client dependency once:

```bash
bun add socket.io-client@^2.3.0
```

```bash
ACHAT_API_BASE_URL=http://localhost:8070 \
ACHAT_BOT_TOKEN='achat_bot_1234567.yourtoken' \
ACHAT_ROOM_ID=7463 \
node examples/ping-pong-bot.js
```

Optional env vars:

- `ACHAT_JOIN_RETRY_MS` (default `2500`)
- `ACHAT_JOIN_ACK_TIMEOUT_MS` (default `9000`)
- `ACHAT_MESSAGE_ACK_TIMEOUT_MS` (default `4500`)
- `ACHAT_PING_COMMAND` (default `ping`, `!ping` is also accepted)
- `ACHAT_PONG_RESPONSE` (default `pong`)

Note:

- `ACHAT_ROOM_ID` accepts comma-separated IDs for multi-room mode.
- If `ACHAT_ROOM_ID` is empty, the sample bot auto-joins all approved rooms.
- Extra commands in sample bot:
  - `!userinfo <userid>`
  - `!roominfo <roomid>` (or `!roominfo` for current room)
