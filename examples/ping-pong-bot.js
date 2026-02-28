#!/usr/bin/env node

"use strict";

let createSocketClient = null;
try {
  createSocketClient = require("socket.io-client");
} catch (error) {
  console.error(
    "[BOT] Missing dependency: socket.io-client. Install it with `bun add socket.io-client@2.3.0` (or npm/yarn equivalent)."
  );
  process.exit(1);
}

class HttpError extends Error {
  constructor(status, message, payload = null) {
    super(message);
    this.name = "HttpError";
    this.status = Number(status) || 500;
    this.payload = payload;
  }
}

const API_BASE_URL = String(process.env.ACHAT_API_BASE_URL || "http://localhost:8070")
  .trim()
  .replace(/\/+$/, "");
const BOT_TOKEN = String(process.env.ACHAT_BOT_TOKEN || "").trim();
const ROOM_ID_ENV = String(process.env.ACHAT_ROOM_ID || "").trim();
const JOIN_RETRY_MS = Math.max(1000, Number(process.env.ACHAT_JOIN_RETRY_MS || 2500) || 2500);
const JOIN_ACK_TIMEOUT_MS = Math.max(1500, Number(process.env.ACHAT_JOIN_ACK_TIMEOUT_MS || 9000) || 9000);
const MESSAGE_ACK_TIMEOUT_MS = Math.max(1000, Number(process.env.ACHAT_MESSAGE_ACK_TIMEOUT_MS || 4500) || 4500);
const PING_COMMAND = String(process.env.ACHAT_PING_COMMAND || "ping")
  .trim()
  .toLowerCase();
const PONG_RESPONSE = String(process.env.ACHAT_PONG_RESPONSE || "pong").trim();

const PING_ALIASES = new Set(["ping", "!ping"]);
if (PING_COMMAND) {
  PING_ALIASES.add(PING_COMMAND);
}

const sleep = ms =>
  new Promise(resolve => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BOT_TOKEN}`,
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      data = {};
    }
  }

  if (!response.ok) {
    throw new HttpError(response.status, data.error || `Request failed (${response.status})`, data);
  }

  return data;
};

const parseExplicitRoomIds = rawValue => {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return [];
  }

  const seen = new Set();
  const ids = [];
  for (const token of raw.split(",")) {
    const id = String(token || "").trim();
    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    ids.push(id);
  }

  return ids;
};

const pickTargetRoomIds = payload => {
  const explicitRoomIds = parseExplicitRoomIds(ROOM_ID_ENV);
  if (explicitRoomIds.length > 0) {
    return {
      roomIds: explicitRoomIds,
      reason: "env"
    };
  }

  const rooms = Array.isArray(payload?.rooms) ? payload.rooms : [];
  const memberRoomIds = rooms
    .filter(entry => String(entry?.accessStatus || "") === "member")
    .map(entry => String(entry?.id || ""))
    .filter(Boolean);

  if (memberRoomIds.length === 0) {
    return {
      roomIds: [],
      reason: "no-member-room"
    };
  }

  return {
    roomIds: memberRoomIds,
    reason: "all-member-rooms"
  };
};

const ensureJoinRequest = async roomId => {
  try {
    const data = await request(`/api/rooms/${roomId}/join`, { method: "POST" });
    return {
      status: String(data.status || "member"),
      message: String(data.message || "")
    };
  } catch (error) {
    if (error instanceof HttpError) {
      return {
        status: "error",
        message: error.message || `Join failed (${error.status})`
      };
    }

    return {
      status: "error",
      message: error.message || "Join failed"
    };
  }
};

const emitWithAck = (socket, eventName, payload, timeoutMs = 3500) => {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new Error("Socket is not connected"));
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error(`Socket timeout while waiting for ${eventName} ack`));
    }, Math.max(250, Number(timeoutMs) || 0));

    socket.emit(eventName, payload, ack => {
      clearTimeout(timer);
      if (ack?.error) {
        reject(new Error(String(ack.error)));
        return;
      }

      resolve(ack || { ok: true });
    });
  });
};

const removeSocketListener = (socket, eventName, handler) => {
  if (typeof socket?.off === "function") {
    socket.off(eventName, handler);
    return;
  }

  if (typeof socket?.removeListener === "function") {
    socket.removeListener(eventName, handler);
  }
};

const joinRoomViaSocket = ({ socket, roomId, timeoutMs }) => {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new Error("Socket is not connected"));
      return;
    }

    let settled = false;
    const finish = (error, result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      removeSocketListener(socket, "room:history", onRoomHistory);
      if (error) {
        reject(error);
      } else {
        resolve(result || { ok: true });
      }
    };

    const onRoomHistory = payload => {
      if (String(payload?.roomId || "") !== String(roomId || "")) {
        return;
      }

      finish(null, { ok: true, source: "history" });
    };

    const timer = setTimeout(() => {
      finish(new Error(`Socket timeout while waiting for room ${roomId} join ack or history`));
    }, Math.max(500, Number(timeoutMs) || 0));

    socket.on("room:history", onRoomHistory);
    socket.emit("room:join", { roomId }, ack => {
      if (ack?.error) {
        finish(new Error(String(ack.error)));
        return;
      }

      finish(null, { ok: true, source: "ack" });
    });
  });
};

const normalizeMessageText = value => String(value || "").trim().toLowerCase();
const isPingCommand = value => PING_ALIASES.has(normalizeMessageText(value));

const parseUserInfoCommand = value => {
  const text = String(value || "").trim();
  const match = text.match(/^!userinfo(?:\s+(\S+))?$/i);
  if (!match) {
    return null;
  }

  return {
    userId: String(match[1] || "").trim()
  };
};

const parseRoomInfoCommand = value => {
  const text = String(value || "").trim();
  const match = text.match(/^!roominfo(?:\s+(\S+))?$/i);
  if (!match) {
    return null;
  }

  return {
    roomId: String(match[1] || "").trim()
  };
};

const main = async () => {
  if (!BOT_TOKEN) {
    throw new Error("Missing ACHAT_BOT_TOKEN");
  }

  const botContext = await request("/api/bot/me");
  const botUser = botContext.user || null;
  if (!botUser?.id) {
    throw new Error("Invalid /api/bot/me response (missing user.id)");
  }

  const roomSelection = pickTargetRoomIds(botContext);
  if (!Array.isArray(roomSelection.roomIds) || roomSelection.roomIds.length === 0) {
    throw new Error("No target rooms found. Set ACHAT_ROOM_ID or approve bot in at least one room first.");
  }

  const targetRoomIds = new Set(roomSelection.roomIds);
  console.log(
    `[BOT] Logged in as ${botUser.displayName} (${botUser.id}). Rooms=${[...targetRoomIds].join(", ")} (${roomSelection.reason}). Command="${PING_COMMAND}" -> "${PONG_RESPONSE}".`
  );

  for (const roomId of targetRoomIds) {
    const joinAttempt = await ensureJoinRequest(roomId);
    if (joinAttempt.status === "pending") {
      console.log(`[BOT][${roomId}] ${joinAttempt.message || "Join request pending owner approval."}`);
    }
  }

  const socket = createSocketClient(API_BASE_URL, {
    transports: ["polling", "websocket"],
    reconnection: true,
    query: {
      token: BOT_TOKEN
    },
    transportOptions: {
      polling: {
        extraHeaders: {
          Authorization: `Bearer ${BOT_TOKEN}`
        }
      },
      websocket: {
        extraHeaders: {
          Authorization: `Bearer ${BOT_TOKEN}`
        }
      }
    }
  });

  const joinedRoomIds = new Set();
  const historyReadyRoomIds = new Set();
  const joinInFlightRoomIds = new Set();
  const waitingNoticeRoomIds = new Set();
  const lastJoinRequestAtByRoomId = new Map();
  const lastJoinErrorLogAtByRoomId = new Map();
  const lastPresenceStateByRoomId = new Map();
  const seenMessageIds = new Set();

  const trimSeenMessageIds = () => {
    if (seenMessageIds.size <= 8000) {
      return;
    }

    const recentIds = [...seenMessageIds].slice(-4000);
    seenMessageIds.clear();
    for (const id of recentIds) {
      seenMessageIds.add(id);
    }
  };

  const markSeen = messages => {
    for (const message of Array.isArray(messages) ? messages : []) {
      const id = String(message?.id || "");
      if (id) {
        seenMessageIds.add(id);
      }
    }
    trimSeenMessageIds();
  };

  const sendMessage = async ({ roomId, text }) => {
    if (socket.connected) {
      try {
        await emitWithAck(
          socket,
          "message:send",
          {
            roomId,
            text
          },
          MESSAGE_ACK_TIMEOUT_MS
        );
        return { transport: "socket" };
      } catch (error) {
        console.log(`[BOT][${roomId}] Socket send failed, falling back to HTTP: ${error.message || String(error)}`);
      }
    }

    await request(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      body: { text }
    });
    return { transport: "http" };
  };

  const handleUserInfoCommand = async ({ roomId, userId }) => {
    if (!userId) {
      await sendMessage({ roomId, text: "Usage: !userinfo <userid>" });
      return;
    }

    try {
      const data = await request(`/api/bot/users/${encodeURIComponent(userId)}/info?roomId=${encodeURIComponent(roomId)}`);
      const user = data.user || {};
      const summary = [
        `User: ${user.displayName || "Unknown"}`,
        `ID: ${user.id || userId}`,
        `Type: ${user.isBot ? "BOT" : "Human"}`,
        `Room Status: ${user.roomStatus || "unknown"}`
      ].join(" | ");
      await sendMessage({ roomId, text: summary });
    } catch (error) {
      await sendMessage({ roomId, text: `userinfo error: ${error.message || String(error)}` });
    }
  };

  const handleRoomInfoCommand = async ({ roomId, targetRoomId }) => {
    const normalizedTargetRoomId = targetRoomId || roomId;
    if (!normalizedTargetRoomId) {
      await sendMessage({ roomId, text: "Usage: !roominfo <roomid>" });
      return;
    }

    try {
      const data = await request(`/api/bot/rooms/${encodeURIComponent(normalizedTargetRoomId)}/info`);
      const room = data.room || {};
      const summary = [
        `Room: #${room.name || "Unknown"}`,
        `ID: ${room.id || normalizedTargetRoomId}`,
        `Owner: ${room.ownerDisplayName || "Unknown"} (${room.ownerUserId || "?"})`,
        `Members: ${Number(room.memberCount) || 0}`,
        `Private: ${room.isPrivate ? "yes" : "no"}`
      ].join(" | ");
      await sendMessage({ roomId, text: summary });
    } catch (error) {
      await sendMessage({ roomId, text: `roominfo error: ${error.message || String(error)}` });
    }
  };

  const attemptRealtimeJoinForRoom = async roomId => {
    const normalizedRoomId = String(roomId || "").trim();
    if (!normalizedRoomId || !socket.connected || joinInFlightRoomIds.has(normalizedRoomId)) {
      return;
    }

    joinInFlightRoomIds.add(normalizedRoomId);
    try {
      const joinResult = await joinRoomViaSocket({
        socket,
        roomId: normalizedRoomId,
        timeoutMs: JOIN_ACK_TIMEOUT_MS
      });

      if (!joinedRoomIds.has(normalizedRoomId)) {
        joinedRoomIds.add(normalizedRoomId);
        waitingNoticeRoomIds.delete(normalizedRoomId);
        console.log(`[BOT][${normalizedRoomId}] Realtime room join successful (${joinResult.source || "unknown"}).`);
      }

      socket.emit("presence:update", {
        activeRoomId: normalizedRoomId,
        isFocused: true
      });
    } catch (error) {
      joinedRoomIds.delete(normalizedRoomId);

      const message = String(error.message || "").toLowerCase();
      const needsApproval = message.includes("do not have chat access");
      if (needsApproval && !waitingNoticeRoomIds.has(normalizedRoomId)) {
        waitingNoticeRoomIds.add(normalizedRoomId);
        console.log(`[BOT][${normalizedRoomId}] Waiting for owner approval before realtime chat access.`);
      }

      if (!needsApproval) {
        const now = Date.now();
        const lastLogAt = Number(lastJoinErrorLogAtByRoomId.get(normalizedRoomId) || 0);
        if (now - lastLogAt >= 5000) {
          lastJoinErrorLogAtByRoomId.set(normalizedRoomId, now);
          console.log(`[BOT][${normalizedRoomId}] Realtime join failed: ${error.message || String(error)}`);
        }
      }

      const now = Date.now();
      const lastRequestAt = Number(lastJoinRequestAtByRoomId.get(normalizedRoomId) || 0);
      if (now - lastRequestAt >= 15000) {
        lastJoinRequestAtByRoomId.set(normalizedRoomId, now);
        const result = await ensureJoinRequest(normalizedRoomId);
        if (result.status === "pending") {
          waitingNoticeRoomIds.add(normalizedRoomId);
          console.log(`[BOT][${normalizedRoomId}] ${result.message || "Join request pending owner approval."}`);
        } else if (result.status === "member") {
          console.log(`[BOT][${normalizedRoomId}] HTTP join confirms bot is already a member. Retrying realtime join...`);
        } else if (result.status === "error") {
          console.log(`[BOT][${normalizedRoomId}] Join request retry failed: ${result.message}`);
        }
      }
    } finally {
      joinInFlightRoomIds.delete(normalizedRoomId);
    }
  };

  const attemptRealtimeJoinForAllRooms = async () => {
    for (const roomId of targetRoomIds) {
      if (!joinedRoomIds.has(roomId)) {
        // Intentionally sequential to keep logs/readability stable.
        await attemptRealtimeJoinForRoom(roomId);
      }
    }
  };

  const handleIncomingMessage = async message => {
    const messageId = String(message?.id || "");
    if (!messageId || seenMessageIds.has(messageId)) {
      return;
    }

    seenMessageIds.add(messageId);
    trimSeenMessageIds();

    const roomId = String(message?.roomId || "").trim();
    if (!roomId || !targetRoomIds.has(roomId)) {
      return;
    }

    if (String(message?.userId || "") === String(botUser.id)) {
      return;
    }

    const text = String(message?.text || "").trim();
    if (!text) {
      return;
    }

    if (isPingCommand(text)) {
      try {
        const result = await sendMessage({ roomId, text: PONG_RESPONSE });
        console.log(`[BOT][${roomId}] Replied to ${message.username || message.userId} with "${PONG_RESPONSE}" (${result.transport})`);
      } catch (error) {
        console.log(`[BOT][${roomId}] Failed to send ping response: ${error.message || String(error)}`);
      }
      return;
    }

    const userInfoCommand = parseUserInfoCommand(text);
    if (userInfoCommand) {
      await handleUserInfoCommand({
        roomId,
        userId: userInfoCommand.userId
      });
      return;
    }

    const roomInfoCommand = parseRoomInfoCommand(text);
    if (roomInfoCommand) {
      await handleRoomInfoCommand({
        roomId,
        targetRoomId: roomInfoCommand.roomId
      });
    }
  };

  socket.on("connect", () => {
    console.log("[BOT] Socket connected.");
    void attemptRealtimeJoinForAllRooms();
  });

  socket.on("disconnect", reason => {
    joinedRoomIds.clear();
    historyReadyRoomIds.clear();
    joinInFlightRoomIds.clear();
    console.log(`[BOT] Socket disconnected: ${reason}`);
  });

  socket.on("connect_error", error => {
    console.log(`[BOT] Socket connect error: ${error.message || String(error)}`);
  });

  socket.on("room:history", payload => {
    const roomId = String(payload?.roomId || "").trim();
    if (!roomId || !targetRoomIds.has(roomId)) {
      return;
    }

    joinedRoomIds.add(roomId);
    markSeen(payload?.messages);
    if (!historyReadyRoomIds.has(roomId)) {
      historyReadyRoomIds.add(roomId);
      console.log(`[BOT][${roomId}] History synced. Listening for new messages.`);
    }
  });

  socket.on("message:new", message => {
    void handleIncomingMessage(message);
  });

  socket.on("room:presence", payload => {
    const roomId = String(payload?.roomId || "").trim();
    if (!roomId || !targetRoomIds.has(roomId)) {
      return;
    }

    const members = Array.isArray(payload?.members) ? payload.members : [];
    const self = members.find(member => String(member?.id || "") === String(botUser.id));
    if (!self) {
      return;
    }

    const nextState = String(self?.presenceStatus || "offline");
    const previousState = String(lastPresenceStateByRoomId.get(roomId) || "");
    if (nextState !== previousState) {
      lastPresenceStateByRoomId.set(roomId, nextState);
      console.log(`[BOT][${roomId}] Presence state: ${nextState}`);
    }
  });

  for (;;) {
    await attemptRealtimeJoinForAllRooms();

    if (joinedRoomIds.size > 0) {
      socket.emit("presence:update", {
        isFocused: true
      });
    }

    await sleep(JOIN_RETRY_MS);
  }
};

main().catch(error => {
  console.error(`[BOT] Fatal error: ${error.message || String(error)}`);
  process.exit(1);
});
