# AChat

A minimal Discord-like real-time chat app built with Bun, Express, and Socket.IO.

## Features

- OAuth login flow using ALabs OAuth Worker API
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
