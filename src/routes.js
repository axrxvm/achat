const path = require("path");

const config = require("./config");
const { uploadBufferToCatbox } = require("./lib/catbox");

const sanitizeUploadFilename = (value, fallback = "attachment.bin") => {
  const cleaned = String(value || fallback)
    .replace(/[/\\?%*:|"<>]/g, "_")
    .trim();
  return cleaned || fallback;
};

const parseBase64Payload = payload => {
  const raw = String(payload || "").trim();
  if (!raw) {
    return "";
  }

  const marker = "base64,";
  const markerIndex = raw.indexOf(marker);
  return markerIndex >= 0 ? raw.slice(markerIndex + marker.length).trim() : raw;
};

const registerRoutes = ({
  app,
  io,
  requireAuth,
  fetchSignupUrl,
  decodeJwtPayload,
  setSessionCookie,
  clearSessionCookie,
  realtime,
  store
}) => {
  const parseMessageLimit = (rawValue, fallback = 80) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(1, Math.min(200, Math.floor(parsed)));
  };

  app.get("/auth/login", async (req, res) => {
    try {
      const signupUrl = await fetchSignupUrl(req);
      res.redirect(signupUrl);
    } catch (error) {
      console.error("[ERROR] OAuth login redirect failed", error);
      res.status(502).send("Unable to start OAuth login flow");
    }
  });

  app.get("/auth/callback", async (req, res) => {
    const token = req.query.sso_token;
    if (!token) {
      return res.status(400).send("Missing sso_token in callback");
    }

    try {
      const payload = decodeJwtPayload(token);
      const user = await store.upsertOAuthUser(payload);
      const session = await store.createSession(user.id);
      setSessionCookie(res, session.id);
      res.redirect("/");
    } catch (error) {
      console.error("[ERROR] OAuth callback failed", error);
      res.status(401).send("OAuth callback processing failed");
    }
  });

  app.post("/auth/logout", requireAuth, async (req, res) => {
    await store.deleteSession(req.sessionId);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get("/api/me", requireAuth, (req, res) => {
    res.json({
      user: req.user,
      rooms: realtime.getRoomsPayloadForUser(req.user.id)
    });
  });

  app.patch("/api/me", requireAuth, async (req, res) => {
    const displayName = String(req.body?.displayName || "").trim();
    if (!displayName) {
      return res.status(400).json({ error: "Display name is required" });
    }

    try {
      const user = await store.updateUserDisplayName({ userId: req.user.id, displayName });

      for (const room of store.listRoomsForUser(req.user.id)) {
        realtime.sendRoomsUpdateForRoomUsers(room.id);
        if (room.accessStatus === "member") {
          realtime.emitPresence(room.id);
        }
      }

      res.json({ user });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to update display name" });
    }
  });

  app.delete("/api/me", requireAuth, async (req, res) => {
    try {
      const result = await store.deleteUserAccount({ userId: req.user.id });

      for (const roomId of result.affectedRoomIds || []) {
        realtime.sendRoomsUpdateForRoomUsers(roomId);
        realtime.emitPresence(roomId);
      }

      for (const userId of result.affectedUserIds || []) {
        realtime.sendRoomsUpdateToUser(userId);
      }

      clearSessionCookie(res);

      const disconnectIfOwnedByDeletedUser = socket => {
        if (String(socket?.user?.id || "") === String(req.user.id)) {
          socket.disconnect(true);
        }
      };

      if (io?.sockets?.connected) {
        for (const socket of Object.values(io.sockets.connected)) {
          disconnectIfOwnedByDeletedUser(socket);
        }
      }

      if (io?.sockets?.sockets) {
        const sockets = io.sockets.sockets;
        if (typeof sockets.values === "function") {
          for (const socket of sockets.values()) {
            disconnectIfOwnedByDeletedUser(socket);
          }
        } else {
          for (const socket of Object.values(sockets)) {
            disconnectIfOwnedByDeletedUser(socket);
          }
        }
      }

      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to delete account" });
    }
  });

  app.get("/api/rooms", requireAuth, (req, res) => {
    res.json({ rooms: realtime.getRoomsPayloadForUser(req.user.id) });
  });

  app.get("/api/discovery/rooms", requireAuth, (req, res) => {
    res.json({
      rooms: store.listDiscoverableRoomsForUser(req.user.id)
    });
  });

  app.post("/api/uploads/catbox", requireAuth, async (req, res) => {
    const rawFiles = Array.isArray(req.body?.files) ? req.body.files : [];
    if (rawFiles.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    if (rawFiles.length > config.CATBOX_MAX_FILES_PER_UPLOAD) {
      return res.status(400).json({ error: "Too many files in one upload request" });
    }

    try {
      const uploadedFiles = [];
      const maxFiles = Number(config.CATBOX_MAX_FILES_PER_UPLOAD) || 4;
      const maxFileBytes = Number(config.CATBOX_MAX_FILE_BYTES) || 12 * 1024 * 1024;
      const filesToUpload = rawFiles.slice(0, maxFiles);

      for (const [index, file] of filesToUpload.entries()) {
        const filename = sanitizeUploadFilename(file?.name, `attachment-${index + 1}.bin`);
        const base64Payload = parseBase64Payload(file?.dataBase64);
        if (!base64Payload) {
          throw new Error(`Attachment "${filename}" is empty`);
        }

        const buffer = Buffer.from(base64Payload, "base64");
        if (!buffer || buffer.length === 0) {
          throw new Error(`Attachment "${filename}" is invalid`);
        }

        if (buffer.length > maxFileBytes) {
          throw new Error(`Attachment "${filename}" exceeds ${Math.floor(maxFileBytes / (1024 * 1024))} MB`);
        }

        const url = await uploadBufferToCatbox({
          buffer,
          filename,
          userHash: config.CATBOX_USER_HASH || "",
          maxFileBytes
        });

        uploadedFiles.push({
          url,
          filename: path.basename(filename),
          sizeBytes: buffer.length,
          mimeType: String(file?.mimeType || "").trim() || "application/octet-stream"
        });
      }

      res.status(201).json({ files: uploadedFiles });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to upload attachments" });
    }
  });

  app.post("/api/rooms", requireAuth, async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Room name is required" });
    }

    try {
      const room = await store.createRoom({
        name,
        ownerUserId: req.user.id,
        isPrivate: Boolean(req.body?.isPrivate),
        isDiscoverable: req.body?.isDiscoverable !== false
      });

      realtime.sendRoomsUpdateForRoomUsers(room.id);
      realtime.emitPresence(room.id);

      res.status(201).json({
        room,
        isOwner: true
      });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to create room" });
    }
  });

  app.patch("/api/rooms/:roomId/privacy", requireAuth, async (req, res) => {
    try {
      const room = await store.setRoomPrivacy({
        roomId: req.params.roomId,
        ownerUserId: req.user.id,
        isPrivate: Boolean(req.body?.isPrivate)
      });

      realtime.sendRoomsUpdateForRoomUsers(room.id);
      realtime.emitPresence(room.id);

      res.json({ room });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to update room privacy" });
    }
  });

  app.patch("/api/rooms/:roomId/discovery", requireAuth, async (req, res) => {
    try {
      const room = await store.setRoomDiscoverability({
        roomId: req.params.roomId,
        ownerUserId: req.user.id,
        isDiscoverable: Boolean(req.body?.isDiscoverable)
      });

      realtime.sendRoomsUpdateForRoomUsers(room.id);
      realtime.emitPresence(room.id);

      res.json({ room });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to update room discoverability" });
    }
  });

  app.post("/api/rooms/:roomId/join", requireAuth, async (req, res) => {
    try {
      const result = await store.joinRoom({ roomId: req.params.roomId, userId: req.user.id });

      realtime.sendRoomsUpdateForRoomUsers(result.room.id);
      realtime.emitPresence(result.room.id);

      if (result.status === "pending") {
        return res.status(202).json({
          room: result.room,
          status: "pending",
          message: "Room is private. Join request sent to owner."
        });
      }

      res.json({ room: result.room, status: result.status });
    } catch (error) {
      res.status(404).json({ error: error.message || "Unable to join room" });
    }
  });

  app.post("/api/rooms/:roomId/leave", requireAuth, async (req, res) => {
    try {
      const room = await store.leaveRoom({ roomId: req.params.roomId, userId: req.user.id });

      realtime.sendRoomsUpdateToUser(req.user.id);
      realtime.sendRoomsUpdateForRoomUsers(room.id);
      realtime.emitPresence(room.id);

      res.json({ room });
    } catch (error) {
      res.status(404).json({ error: error.message || "Unable to leave room" });
    }
  });

  app.post("/api/rooms/:roomId/ownership/:targetUserId", requireAuth, async (req, res) => {
    try {
      const room = await store.transferRoomOwnership({
        roomId: req.params.roomId,
        ownerUserId: req.user.id,
        targetUserId: req.params.targetUserId
      });

      realtime.sendRoomsUpdateForRoomUsers(room.id);
      realtime.emitPresence(room.id);

      res.json({ room });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to transfer room ownership" });
    }
  });

  app.delete("/api/rooms/:roomId", requireAuth, async (req, res) => {
    try {
      const result = await store.deleteRoom({
        roomId: req.params.roomId,
        ownerUserId: req.user.id
      });

      for (const userId of result.impactedUserIds || []) {
        realtime.sendRoomsUpdateToUser(userId);
      }

      res.json({ ok: true, roomId: result.roomId });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to delete room" });
    }
  });

  app.post("/api/rooms/:roomId/members/:targetUserId/kick", requireAuth, async (req, res) => {
    try {
      const room = await store.kickMember({
        roomId: req.params.roomId,
        ownerUserId: req.user.id,
        targetUserId: req.params.targetUserId
      });

      realtime.sendRoomsUpdateToUser(req.params.targetUserId);
      realtime.sendRoomsUpdateForRoomUsers(room.id);
      realtime.emitPresence(room.id);

      res.json({ room });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to kick member" });
    }
  });

  app.post("/api/rooms/:roomId/waitlist/:targetUserId/approve", requireAuth, async (req, res) => {
    try {
      const room = await store.approvePendingUser({
        roomId: req.params.roomId,
        ownerUserId: req.user.id,
        targetUserId: req.params.targetUserId
      });

      realtime.sendRoomsUpdateForRoomUsers(room.id);
      realtime.sendRoomsUpdateToUser(req.params.targetUserId);
      realtime.emitPresence(room.id);

      res.json({ room });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to approve user" });
    }
  });

  app.post("/api/rooms/:roomId/waitlist/:targetUserId/reject", requireAuth, async (req, res) => {
    try {
      const room = await store.rejectPendingUser({
        roomId: req.params.roomId,
        ownerUserId: req.user.id,
        targetUserId: req.params.targetUserId
      });

      realtime.sendRoomsUpdateForRoomUsers(room.id);
      realtime.sendRoomsUpdateToUser(req.params.targetUserId);
      realtime.emitPresence(room.id);

      res.json({ room });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to reject user" });
    }
  });

  app.get("/api/rooms/:roomId", requireAuth, (req, res) => {
    const includeMessages = String(req.query?.includeMessages || "").trim() === "1";
    const messageLimit = parseMessageLimit(req.query?.messageLimit, 80);
    const snapshot = realtime.getRoomSnapshotForUser(req.params.roomId, req.user.id, {
      includeMessages,
      messageLimit
    });
    if (snapshot.error) {
      return res.status(snapshot.status).json({ error: snapshot.error });
    }

    res.json(snapshot);
  });

  app.get("/api/rooms/:roomId/members", requireAuth, (req, res) => {
    const snapshot = realtime.getRoomSnapshotForUser(req.params.roomId, req.user.id);
    if (snapshot.error) {
      return res.status(snapshot.status).json({ error: snapshot.error });
    }

    if (!snapshot.canAccess) {
      return res.status(403).json({ error: "Cannot view members until approved" });
    }

    res.json({
      roomId: snapshot.room.id,
      members: snapshot.members,
      pendingUsers: snapshot.pendingUsers,
      ownerUserId: snapshot.room.ownerUserId
    });
  });

  app.get("/api/rooms/:roomId/messages", requireAuth, (req, res) => {
    const snapshot = realtime.getRoomSnapshotForUser(req.params.roomId, req.user.id);
    if (snapshot.error) {
      return res.status(snapshot.status).json({ error: snapshot.error });
    }

    if (!snapshot.canAccess) {
      return res.status(403).json({ error: "Waiting for owner approval" });
    }

    const limit = parseMessageLimit(req.query?.limit, 80);
    const beforeId = String(req.query?.beforeId || "").trim();
    const page = store.getMessagesPageForRoom({
      roomId: snapshot.room.id,
      limit,
      beforeMessageId: beforeId
    });

    res.json({
      roomId: snapshot.room.id,
      messages: page.messages,
      hasMore: page.hasMore
    });
  });

  app.post("/api/rooms/:roomId/messages", requireAuth, async (req, res) => {
    const snapshot = realtime.getRoomSnapshotForUser(req.params.roomId, req.user.id);
    if (snapshot.error) {
      return res.status(snapshot.status).json({ error: snapshot.error });
    }

    if (!snapshot.canAccess) {
      return res.status(403).json({ error: "Waiting for owner approval" });
    }

    try {
      const message = await store.addMessage({
        roomId: snapshot.room.id,
        userId: req.user.id,
        text: String(req.body?.text || "")
      });

      io.to(`room:${snapshot.room.id}`).emit("message:new", message);
      res.status(201).json({ message });
      setImmediate(() => {
        realtime.sendRoomsUpdateForRoomUsers(snapshot.room.id);
      });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to send message" });
    }
  });

  app.delete("/api/rooms/:roomId/messages/:messageId", requireAuth, async (req, res) => {
    const snapshot = realtime.getRoomSnapshotForUser(req.params.roomId, req.user.id);
    if (snapshot.error) {
      return res.status(snapshot.status).json({ error: snapshot.error });
    }

    if (!snapshot.canAccess) {
      return res.status(403).json({ error: "Waiting for owner approval" });
    }

    try {
      const result = await store.deleteMessage({
        roomId: snapshot.room.id,
        messageId: req.params.messageId,
        requesterUserId: req.user.id
      });

      io.to(`room:${snapshot.room.id}`).emit("message:delete", result);
      res.json({
        ok: true,
        roomId: result.roomId,
        messageId: result.messageId
      });
      setImmediate(() => {
        realtime.sendRoomsUpdateForRoomUsers(snapshot.room.id);
      });
    } catch (error) {
      const message = error.message || "Unable to delete message";
      const normalized = String(message).toLowerCase();
      const status = normalized.includes("not allowed")
        ? 403
        : normalized.includes("not found")
          ? 404
          : 400;
      res.status(status).json({ error: message });
    }
  });
};

module.exports = {
  registerRoutes
};
