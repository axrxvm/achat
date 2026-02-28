const setupRealtime = ({
  io,
  sessionCookie,
  parseCookies,
  getSessionUser,
  touchSession,
  authenticateBotToken,
  listRoomsForUser,
  getRoomUserIds,
  getRoomById,
  getRoomMembers,
  getRoomPendingUsers,
  getRoomAccessForUser,
  getMessagesPageForRoom,
  addMessage,
  editMessage
}) => {
  const ROOM_HISTORY_LIMIT = 80;
  const ROOMS_UPDATE_BATCH_DELAY_MS = 140;
  const socketsByUser = new Map();
  const pendingRoomUpdateTimers = new Map();
  const parseBearerToken = value => {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    const match = raw.match(/^Bearer\s+(.+)$/i);
    return match ? String(match[1] || "").trim() : "";
  };
  const getBotTokenFromSocketHandshake = socket => {
    const headerToken = parseBearerToken(socket?.handshake?.headers?.authorization);
    if (headerToken) {
      return headerToken;
    }

    const authToken = String(socket?.handshake?.auth?.token || socket?.handshake?.auth?.botToken || "").trim();
    if (authToken) {
      return authToken;
    }

    const queryToken = String(socket?.handshake?.query?.token || socket?.handshake?.query?.botToken || "").trim();
    if (queryToken) {
      return queryToken;
    }

    const queryBearerToken = parseBearerToken(socket?.handshake?.query?.authorization);
    if (queryBearerToken) {
      return queryBearerToken;
    }

    return "";
  };
  const getSocketById = socketId => {
    if (io?.sockets?.connected && io.sockets.connected[socketId]) {
      return io.sockets.connected[socketId];
    }

    if (io?.sockets?.sockets && io.sockets.sockets[socketId]) {
      return io.sockets.sockets[socketId];
    }

    return null;
  };

  const getRoomsPayloadForUser = userId =>
    listRoomsForUser(userId).map(room => ({
      ...room,
      isOwner: room.ownerUserId === String(userId)
    }));

  const getConnectedSocketsForUser = userId => {
    const normalizedUserId = String(userId || "");
    if (!normalizedUserId) {
      return [];
    }

    const socketIds = socketsByUser.get(normalizedUserId);
    if (!socketIds || socketIds.size === 0) {
      return [];
    }

    const connectedSockets = [];
    const staleIds = [];
    for (const socketId of socketIds) {
      const socket = getSocketById(socketId);
      if (socket && socket.connected) {
        connectedSockets.push(socket);
      } else {
        staleIds.push(socketId);
      }
    }

    if (staleIds.length > 0) {
      for (const socketId of staleIds) {
        socketIds.delete(socketId);
      }
      if (socketIds.size === 0) {
        socketsByUser.delete(normalizedUserId);
      }
    }

    return connectedSockets;
  };
  const isUserOnline = userId => getConnectedSocketsForUser(userId).length > 0;
  const getMemberRoomIdsForUser = userId =>
    listRoomsForUser(userId)
      .filter(room => room.accessStatus === "member")
      .map(room => room.id);
  const getPresenceStatusInRoom = (userId, roomId) => {
    const connectedSockets = getConnectedSocketsForUser(userId);
    if (connectedSockets.length === 0) {
      return "offline";
    }

    let hasFocusedChatSocket = false;
    for (const socket of connectedSockets) {
      if (socket.user?.isBot) {
        const botRoomIds = socket.botActiveRoomIds instanceof Set ? socket.botActiveRoomIds : new Set();
        if (botRoomIds.has(String(roomId))) {
          return "active";
        }

        if (botRoomIds.size > 0) {
          hasFocusedChatSocket = true;
        }
        continue;
      }

      const socketCountsAsFocused = Boolean(socket.isChatFocused);
      if (!socketCountsAsFocused) {
        continue;
      }

      hasFocusedChatSocket = true;
      if (String(socket.activeRoomId || "") === String(roomId)) {
        return "active";
      }
    }

    if (hasFocusedChatSocket) {
      return "other";
    }

    return isUserOnline(userId) ? "idle" : "offline";
  };

  const sendRoomsUpdateToUser = userId => {
    const socketIds = socketsByUser.get(String(userId));
    if (!socketIds || socketIds.size === 0) {
      return;
    }

    const rooms = getRoomsPayloadForUser(userId);
    for (const socketId of socketIds) {
      io.to(socketId).emit("rooms:update", rooms);
    }
  };

  const sendRoomsUpdateForRoomUsers = roomId => {
    for (const userId of getRoomUserIds(roomId)) {
      sendRoomsUpdateToUser(userId);
    }
  };

  const scheduleRoomsUpdateForRoomUsers = (roomId, delayMs = ROOMS_UPDATE_BATCH_DELAY_MS) => {
    const normalizedRoomId = String(roomId || "").trim();
    if (!normalizedRoomId) {
      return;
    }

    if (pendingRoomUpdateTimers.has(normalizedRoomId)) {
      return;
    }

    const timer = setTimeout(() => {
      pendingRoomUpdateTimers.delete(normalizedRoomId);
      sendRoomsUpdateForRoomUsers(normalizedRoomId);
    }, Math.max(0, Number(delayMs) || 0));

    pendingRoomUpdateTimers.set(normalizedRoomId, timer);
  };
  const emitPresenceForUserRooms = userId => {
    for (const roomId of getMemberRoomIdsForUser(userId)) {
      emitPresence(roomId);
    }
  };

  const emitToUserSockets = (userId, eventName, payload) => {
    const socketIds = socketsByUser.get(String(userId));
    if (!socketIds || socketIds.size === 0) {
      return;
    }

    for (const socketId of socketIds) {
      io.to(socketId).emit(eventName, payload);
    }
  };

  const emitPresence = roomId => {
    const room = getRoomById(roomId);
    if (!room) {
      return;
    }

    const members = getRoomMembers(room.id).map(member => ({
      ...member,
      online: isUserOnline(member.id),
      presenceStatus: getPresenceStatusInRoom(member.id, room.id)
    }));

    const pendingUsers = getRoomPendingUsers(room.id);

    const payload = {
      roomId: room.id,
      ownerUserId: room.ownerUserId,
      members,
      pendingUsers
    };

    // Presence must reach all room users even if their socket has not joined the
    // active room channel yet (e.g. after refresh or join flow timing).
    for (const userId of getRoomUserIds(room.id)) {
      emitToUserSockets(userId, "room:presence", payload);
    }
  };

  const emitTypingUpdate = ({ roomId, userId, displayName, isTyping }) => {
    const normalizedRoomId = String(roomId || "").trim();
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedRoomId || !normalizedUserId) {
      return;
    }

    io.to(`room:${normalizedRoomId}`).emit("typing:update", {
      roomId: normalizedRoomId,
      userId: normalizedUserId,
      displayName: String(displayName || "").trim() || "User",
      isTyping: Boolean(isTyping)
    });
  };

  const normalizeMessageLimit = value => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return ROOM_HISTORY_LIMIT;
    }

    return Math.max(1, Math.min(200, Math.floor(parsed)));
  };

  const getRoomSnapshotForUser = (roomId, userId, options = {}) => {
    const room = getRoomById(roomId);
    if (!room) {
      return { error: "Room not found", status: 404 };
    }

    const normalizedUserId = String(userId);
    const accessStatus = getRoomAccessForUser(room.id, normalizedUserId);
    if (accessStatus === "none") {
      return { error: "You do not have access to this room", status: 403 };
    }

    const isOwner = room.ownerUserId === normalizedUserId;
    const canAccess = accessStatus === "member";
    const includeMessages = Boolean(options.includeMessages);
    const messageLimit = normalizeMessageLimit(options.messageLimit);
    const messagePage =
      canAccess && includeMessages ? getMessagesPageForRoom({ roomId: room.id, limit: messageLimit }) : { messages: [], hasMore: false };

    return {
      room,
      canAccess,
      accessStatus,
      isOwner,
      members: canAccess
        ? getRoomMembers(room.id).map(member => ({
            ...member,
            online: isUserOnline(member.id),
            presenceStatus: getPresenceStatusInRoom(member.id, room.id)
          }))
        : [],
      pendingUsers: isOwner ? getRoomPendingUsers(room.id) : [],
      messages: messagePage.messages,
      messageHasMore: messagePage.hasMore
    };
  };

  io.use(async (socket, next) => {
    try {
      const sessionId = parseCookies(socket?.handshake?.headers?.cookie || "")[sessionCookie];
      if (sessionId) {
        const sessionUser = getSessionUser(sessionId);
        if (sessionUser) {
          await touchSession(sessionId);
          socket.sessionId = sessionId;
          socket.user = sessionUser.user;
          socket.authType = "session";
        }
      }

      if (!socket.user && typeof authenticateBotToken === "function") {
        const botToken = getBotTokenFromSocketHandshake(socket);
        if (botToken) {
          const botUser = await authenticateBotToken(botToken);
          if (botUser) {
            socket.sessionId = null;
            socket.user = botUser;
            socket.authType = "bot";
          }
        }
      }

      if (!socket.user) {
        console.warn("[WARN] Socket auth failed: unauthorized");
        return next(new Error("Unauthorized"));
      }

      socket.activeRoomId = socket.activeRoomId || null;
      socket.botActiveRoomIds = socket.botActiveRoomIds instanceof Set ? socket.botActiveRoomIds : new Set();
      socket.isChatFocused = Boolean(socket.user?.isBot ? socket.botActiveRoomIds.size > 0 : false);
      next();
    } catch (error) {
      console.warn("[WARN] Socket auth failed:", error.message);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", socket => {
    const user = socket.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    const userId = String(user.id);

    const existingSocketIds = socketsByUser.get(userId) || new Set();
    existingSocketIds.add(socket.id);
    socketsByUser.set(userId, existingSocketIds);

    const rooms = getRoomsPayloadForUser(userId);
    emitPresenceForUserRooms(userId);

    socket.emit("rooms:update", rooms);

    socket.on("room:join", (payload, callback = () => {}) => {
      const respond = typeof callback === "function" ? callback : () => {};

      try {
        const roomId = String(payload?.roomId || "").trim();
        const room = getRoomById(roomId);

        if (!room) {
          return respond({ error: "Room not found" });
        }

        if (getRoomAccessForUser(room.id, userId) !== "member") {
          return respond({ error: "You do not have chat access to this room" });
        }

        const isBotUser = Boolean(socket.user?.isBot);

        if (!isBotUser && socket.activeRoomId && socket.activeRoomId !== room.id) {
          emitTypingUpdate({
            roomId: socket.activeRoomId,
            userId,
            displayName: user.displayName,
            isTyping: false
          });
          socket.leave(`room:${socket.activeRoomId}`);
        }

        socket.activeRoomId = room.id;
        if (isBotUser) {
          socket.botActiveRoomIds.add(String(room.id));
          socket.isChatFocused = socket.botActiveRoomIds.size > 0;
        }
        socket.join(`room:${room.id}`);

        respond({ ok: true, roomId: room.id });

        // Ack first so clients do not timeout while history is prepared.
        try {
          const historyPage = getMessagesPageForRoom({ roomId: room.id, limit: ROOM_HISTORY_LIMIT });
          socket.emit("room:history", {
            roomId: room.id,
            messages: historyPage.messages,
            hasMore: historyPage.hasMore
          });
        } catch (error) {
          console.warn("[WARN] Failed to emit room history:", error.message);
        }

        emitPresenceForUserRooms(userId);
      } catch (error) {
        console.warn("[WARN] room:join handler failed:", error.message);
        respond({ error: "Unable to join room right now" });
      }
    });

    socket.on("presence:update", payload => {
      if (socket.user?.isBot) {
        const previousFocused = Boolean(socket.isChatFocused);
        socket.isChatFocused = socket.botActiveRoomIds.size > 0;
        if (previousFocused !== socket.isChatFocused) {
          emitPresenceForUserRooms(userId);
        }
        return;
      }

      const nextFocused = Boolean(payload?.isFocused);
      const requestedRoomId = String(payload?.activeRoomId || socket.activeRoomId || "").trim();
      const hasValidRequestedRoom =
        requestedRoomId && getRoomAccessForUser(requestedRoomId, userId) === "member";
      const nextRoomId = hasValidRequestedRoom ? requestedRoomId : null;

      const previousFocused = Boolean(socket.isChatFocused);
      const previousRoomId = String(socket.activeRoomId || "");

      socket.activeRoomId = nextRoomId;
      socket.isChatFocused = Boolean(nextFocused && nextRoomId);

      if (previousRoomId && (previousRoomId !== String(socket.activeRoomId || "") || !socket.isChatFocused)) {
        emitTypingUpdate({
          roomId: previousRoomId,
          userId,
          displayName: user.displayName,
          isTyping: false
        });
      }

      if (previousFocused !== socket.isChatFocused || previousRoomId !== String(socket.activeRoomId || "")) {
        emitPresenceForUserRooms(userId);
      }
    });

    socket.on("typing:update", payload => {
      const isBotUser = Boolean(socket.user?.isBot);
      const roomId = String(payload?.roomId || (isBotUser ? "" : socket.activeRoomId) || "").trim();
      if (!roomId) {
        return;
      }

      if (getRoomAccessForUser(roomId, userId) !== "member") {
        return;
      }

      emitTypingUpdate({
        roomId,
        userId,
        displayName: user.displayName,
        isTyping: Boolean(payload?.isTyping)
      });
    });

    socket.on("message:send", async (payload, callback = () => {}) => {
      const respond = typeof callback === "function" ? callback : () => {};
      const isBotUser = Boolean(socket.user?.isBot);
      const roomId = String(payload?.roomId || (isBotUser ? "" : socket.activeRoomId) || "").trim();
      const text = String(payload?.text || "");

      if (!roomId) {
        return respond({ error: "roomId is required" });
      }

      if (getRoomAccessForUser(roomId, userId) !== "member") {
        return respond({ error: "You do not have chat access to this room" });
      }

      try {
        const message = await addMessage({ roomId, userId, text });
        io.to(`room:${roomId}`).emit("message:new", message);
        respond({ ok: true, message });
        setImmediate(() => {
          scheduleRoomsUpdateForRoomUsers(roomId);
        });
      } catch (error) {
        respond({ error: error.message || "Unable to send message" });
      }
    });

    socket.on("message:edit", async (payload, callback = () => {}) => {
      const respond = typeof callback === "function" ? callback : () => {};
      const isBotUser = Boolean(socket.user?.isBot);
      const roomId = String(payload?.roomId || (isBotUser ? "" : socket.activeRoomId) || "").trim();
      const messageId = String(payload?.messageId || "").trim();
      const text = String(payload?.text || "");

      if (!roomId) {
        return respond({ error: "roomId is required" });
      }

      if (!messageId) {
        return respond({ error: "messageId is required" });
      }

      if (getRoomAccessForUser(roomId, userId) !== "member") {
        return respond({ error: "You do not have chat access to this room" });
      }

      try {
        const message = await editMessage({ roomId, messageId, requesterUserId: userId, text });
        io.to(`room:${roomId}`).emit("message:update", { message });
        respond({ ok: true, message });
        setImmediate(() => {
          scheduleRoomsUpdateForRoomUsers(roomId);
        });
      } catch (error) {
        respond({ error: error.message || "Unable to edit message" });
      }
    });

    socket.on("disconnect", () => {
      if (socket.activeRoomId) {
        emitTypingUpdate({
          roomId: socket.activeRoomId,
          userId,
          displayName: user.displayName,
          isTyping: false
        });
      }

      if (socket.user?.isBot && socket.botActiveRoomIds.size > 0) {
        for (const botRoomId of socket.botActiveRoomIds) {
          emitTypingUpdate({
            roomId: botRoomId,
            userId,
            displayName: user.displayName,
            isTyping: false
          });
        }
      }

      const socketIds = socketsByUser.get(userId);
      if (socketIds) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          socketsByUser.delete(userId);
        }
      }

      emitPresenceForUserRooms(userId);
    });
  });

  return {
    emitPresence,
    getRoomSnapshotForUser,
    getRoomsPayloadForUser,
    scheduleRoomsUpdateForRoomUsers,
    sendRoomsUpdateForRoomUsers,
    sendRoomsUpdateToUser
  };
};

module.exports = {
  setupRealtime
};
