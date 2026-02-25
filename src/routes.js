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
  app.get("/auth/login", async (req, res) => {
    try {
      const signupUrl = await fetchSignupUrl();
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

  app.get("/api/rooms", requireAuth, (req, res) => {
    res.json({ rooms: realtime.getRoomsPayloadForUser(req.user.id) });
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
        isPrivate: Boolean(req.body?.isPrivate)
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
    const snapshot = realtime.getRoomSnapshotForUser(req.params.roomId, req.user.id);
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

    res.json({ roomId: snapshot.room.id, messages: snapshot.messages });
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
      realtime.sendRoomsUpdateForRoomUsers(snapshot.room.id);

      res.status(201).json({ message });
    } catch (error) {
      res.status(400).json({ error: error.message || "Unable to send message" });
    }
  });
};

module.exports = {
  registerRoutes
};
