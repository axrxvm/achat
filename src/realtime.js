const setupRealtime = ({
  io,
  sessionCookie,
  parseCookies,
  getSessionUser,
  touchSession,
  listRoomsForUser,
  getRoomUserIds,
  getRoomById,
  getRoomMembers,
  getRoomPendingUsers,
  getRoomAccessForUser,
  getMessagesForRoom,
  addMessage
}) => {
  const onlineCounts = new Map();
  const socketsByUser = new Map();
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

  const isUserOnline = userId => (onlineCounts.get(String(userId)) || 0) > 0;
  const getMemberRoomIdsForUser = userId =>
    listRoomsForUser(userId)
      .filter(room => room.accessStatus === "member")
      .map(room => room.id);
  const getPresenceStatusInRoom = (userId, roomId) => {
    const socketIds = socketsByUser.get(String(userId));
    if (!socketIds || socketIds.size === 0) {
      return "offline";
    }

    let hasFocusedChatSocket = false;
    for (const socketId of socketIds) {
      const socket = getSocketById(socketId);
      if (!socket || !socket.connected) {
        continue;
      }

      if (!socket.isChatFocused) {
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

  const getRoomSnapshotForUser = (roomId, userId) => {
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
      messages: canAccess ? getMessagesForRoom(room.id, 200) : []
    };
  };

  io.use(async (socket, next) => {
    try {
      const sessionId = parseCookies(socket.handshake.headers.cookie)[sessionCookie];
      if (!sessionId) {
        console.warn("[WARN] Socket auth failed: no session cookie");
        return next(new Error("Unauthorized"));
      }

      const sessionUser = getSessionUser(sessionId);
      if (!sessionUser) {
        console.warn("[WARN] Socket auth failed: invalid session");
        return next(new Error("Unauthorized"));
      }

      await touchSession(sessionId);
      socket.sessionId = sessionId;
      socket.user = sessionUser.user;
      socket.activeRoomId = socket.activeRoomId || null;
      socket.isChatFocused = false;
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

    onlineCounts.set(userId, (onlineCounts.get(userId) || 0) + 1);

    const rooms = getRoomsPayloadForUser(userId);
    emitPresenceForUserRooms(userId);

    socket.emit("rooms:update", rooms);

    socket.on("room:join", (payload, callback = () => {}) => {
      const roomId = String(payload?.roomId || "").trim();
      const room = getRoomById(roomId);

      if (!room) {
        return callback({ error: "Room not found" });
      }

      if (getRoomAccessForUser(room.id, userId) !== "member") {
        return callback({ error: "You do not have chat access to this room" });
      }

      if (socket.activeRoomId && socket.activeRoomId !== room.id) {
        socket.leave(`room:${socket.activeRoomId}`);
      }

      socket.activeRoomId = room.id;
      socket.join(`room:${room.id}`);

      socket.emit("room:history", {
        roomId: room.id,
        messages: getMessagesForRoom(room.id, 200)
      });

      emitPresenceForUserRooms(userId);
      callback({ ok: true, roomId: room.id });
    });

    socket.on("presence:update", payload => {
      const nextFocused = Boolean(payload?.isFocused);
      const requestedRoomId = String(payload?.activeRoomId || socket.activeRoomId || "").trim();
      const hasValidRequestedRoom =
        requestedRoomId && getRoomAccessForUser(requestedRoomId, userId) === "member";
      const nextRoomId = hasValidRequestedRoom ? requestedRoomId : null;

      const previousFocused = Boolean(socket.isChatFocused);
      const previousRoomId = String(socket.activeRoomId || "");

      socket.activeRoomId = nextRoomId;
      socket.isChatFocused = Boolean(nextFocused && nextRoomId);

      if (previousFocused !== socket.isChatFocused || previousRoomId !== String(socket.activeRoomId || "")) {
        emitPresenceForUserRooms(userId);
      }
    });

    socket.on("message:send", async (payload, callback = () => {}) => {
      const roomId = String(payload?.roomId || socket.activeRoomId || "").trim();
      const text = String(payload?.text || "");

      if (!roomId) {
        return callback({ error: "roomId is required" });
      }

      if (getRoomAccessForUser(roomId, userId) !== "member") {
        return callback({ error: "You do not have chat access to this room" });
      }

      try {
        const message = await addMessage({ roomId, userId, text });
        io.to(`room:${roomId}`).emit("message:new", message);
        sendRoomsUpdateForRoomUsers(roomId);
        callback({ ok: true, message });
      } catch (error) {
        callback({ error: error.message || "Unable to send message" });
      }
    });

    socket.on("disconnect", () => {
      const socketIds = socketsByUser.get(userId);
      if (socketIds) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          socketsByUser.delete(userId);
        }
      }

      const nextCount = Math.max(0, (onlineCounts.get(userId) || 1) - 1);
      if (nextCount === 0) {
        onlineCounts.delete(userId);
      } else {
        onlineCounts.set(userId, nextCount);
      }

      emitPresenceForUserRooms(userId);
    });
  });

  return {
    emitPresence,
    getRoomSnapshotForUser,
    getRoomsPayloadForUser,
    sendRoomsUpdateForRoomUsers,
    sendRoomsUpdateToUser
  };
};

module.exports = {
  setupRealtime
};
