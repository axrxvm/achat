# AChat

A real-time chat app built with Bun, Express, and Socket.IO, now centered around account-hex identity and client-side E2EE room keys.

## Features

- Account creation with username + one-time account hex
- Account-hex login only (`word(optionalNumber)-word-word-word-word-word-word-number-checkword`)
- Client-side room-key E2EE for message content (AES-GCM)
- Server-assisted multi-device sessions with per-account max-device controls
- Optional Developer Mode with right-click copy tools for IDs/timestamps
- Developer Mode "Manage Apps" panel for creating and managing bot users
- Bot auth tokens (`Authorization: Bearer <token>`) for API-driven bot integrations
- MongoDB Atlas persistence with split clusters: main data and messages
- 7-digit user IDs and 4-digit room IDs
- Room ownership, creation, join/leave, and multi-room membership
- Real-time room history + presence updates
- Message editing and deletion (users and bots)
- Catbox-backed attachment uploads with inline media previews

## Run

```bash
bun run start
```

## Environment

- `NODE_ENV` (`production` recommended in deploy)
- `TRUST_PROXY` (`true` behind reverse proxies/load balancers)
- `MONGODB_MAIN_DB_URL` for users/rooms/sessions
- `MONGODB_MESSAGE_DB_URL` for chat messages
- `CATBOX_USER_HASH` (optional) if you want uploads tied to your Catbox account

See `.env.example` for the full template.

## Production Runbook

1. Set environment:

```bash
cp .env.example .env
```

Fill all required DB values and set `NODE_ENV=production`.

1. Start service:

```bash
bun run start
```

1. Health checks:

- Liveness: `GET /healthz`
- Readiness: `GET /readyz`

1. Reverse proxy requirements:

- Terminate TLS at proxy/load balancer
- Forward `X-Forwarded-*` headers
- Keep WebSocket upgrades enabled for Socket.IO

1. Security baseline included in app:

- Security headers middleware (CSP, frame deny, nosniff, referrer policy)
- Auth endpoint rate limiting (`/auth/*`)
- Graceful shutdown on `SIGINT`/`SIGTERM`

1. Operational hygiene:

- Never commit `.env` secrets to git
- Rotate bot tokens and DB credentials if exposed
- Keep session cookie secure by running production over HTTPS

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
