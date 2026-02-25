const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const MESSAGE_ID_REGEX = /^\d{10}$/;

const EMPTY_STORE = {
  users: [],
  rooms: [],
  messages: [],
  sessions: []
};

let state = JSON.parse(JSON.stringify(EMPTY_STORE));
let persistQueue = Promise.resolve();

const clone = value => JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();

const sanitizeDisplayName = value => {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
  return cleaned || "Anonymous";
};

const sanitizeRoomName = value => {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
  return cleaned;
};

const randomFixedDigits = digits => {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
};

const generateUniqueNumericId = (digits, existingValues) => {
  for (let index = 0; index < 100000; index += 1) {
    const candidate = randomFixedDigits(digits);
    if (!existingValues.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to generate unique ${digits}-digit id`);
};

const normalizeStore = value => {
  const next = {
    users: Array.isArray(value?.users) ? value.users : [],
    rooms: Array.isArray(value?.rooms) ? value.rooms : [],
    messages: Array.isArray(value?.messages) ? value.messages : [],
    sessions: Array.isArray(value?.sessions) ? value.sessions : []
  };

  for (const room of next.rooms) {
    room.id = String(room.id || "");
    room.name = sanitizeRoomName(room.name || "Untitled Room") || "Untitled Room";
    room.ownerUserId = room.ownerUserId ? String(room.ownerUserId) : null;

    room.memberUserIds = Array.isArray(room.memberUserIds)
      ? Array.from(new Set(room.memberUserIds.map(String)))
      : [];

    room.pendingUserIds = Array.isArray(room.pendingUserIds)
      ? Array.from(new Set(room.pendingUserIds.map(String)))
      : [];

    room.pendingUserIds = room.pendingUserIds.filter(userId => !room.memberUserIds.includes(userId));
    room.isPrivate = Boolean(room.isPrivate);
    room.createdAt = room.createdAt || nowIso();
    room.updatedAt = room.updatedAt || room.createdAt;

    if (room.ownerUserId && !room.memberUserIds.includes(room.ownerUserId)) {
      room.memberUserIds.push(room.ownerUserId);
    }
  }

  for (const user of next.users) {
    user.id = String(user.id || "");
    user.displayName = sanitizeDisplayName(user.displayName);
    user.displayNameCustom = Boolean(user.displayNameCustom);
    user.oauthKey = String(user.oauthKey || "");
    user.oauthSub = String(user.oauthSub || "");
    user.oauthProvider = String(user.oauthProvider || "oauth")
      .trim()
      .toLowerCase();
    user.oauthProviderId = String(user.oauthProviderId || "");
    user.oauthEmail = user.oauthEmail ? String(user.oauthEmail).trim().toLowerCase() : null;
    user.avatarUrl = user.avatarUrl || null;
    user.createdAt = user.createdAt || nowIso();
    user.lastLoginAt = user.lastLoginAt || user.createdAt;
  }

  const usedMessageIds = new Set();
  for (const msg of next.messages) {
    let messageId = String(msg.id || "");

    if (!MESSAGE_ID_REGEX.test(messageId) || usedMessageIds.has(messageId)) {
      messageId = generateUniqueNumericId(10, usedMessageIds);
    }

    usedMessageIds.add(messageId);

    msg.id = messageId;
    msg.roomId = String(msg.roomId || "");
    msg.userId = String(msg.userId || "");
    msg.text = String(msg.text || "").slice(0, 2000);
    msg.createdAt = msg.createdAt || nowIso();
  }

  for (const session of next.sessions) {
    session.id = String(session.id || crypto.randomUUID());
    session.userId = String(session.userId || "");
    session.createdAt = session.createdAt || nowIso();
    session.lastSeenAt = session.lastSeenAt || session.createdAt;
  }

  return next;
};

const persist = async () => {
  const payload = JSON.stringify(state, null, 2);
  const tempPath = `${DATA_FILE}.tmp`;

  persistQueue = persistQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(tempPath, payload, "utf8");
    await fs.rename(tempPath, DATA_FILE);
  });

  return persistQueue;
};

const ensureStore = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    state = normalizeStore(JSON.parse(raw));
    await persist();
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    state = clone(EMPTY_STORE);
    await persist();
  }
};

const findUserById = userId => state.users.find(user => user.id === String(userId));
const findSessionById = sessionId => state.sessions.find(session => session.id === String(sessionId));
const findRoomById = roomId => state.rooms.find(room => room.id === String(roomId));
const toTimestamp = value => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const touchRoom = room => {
  room.updatedAt = nowIso();
};

const formatMessageForClient = message => {
  const author = findUserById(message.userId);
  return {
    id: message.id,
    roomId: message.roomId,
    userId: message.userId,
    username: author?.displayName || "Unknown",
    avatarUrl: author?.avatarUrl || null,
    text: message.text,
    createdAt: message.createdAt
  };
};

const upsertOAuthUser = async profile => {
  const oauthProvider = String(profile?.provider || profile?.iss || "oauth")
    .trim()
    .toLowerCase();
  const oauthProviderId = String(
    profile?.provider_id || profile?.providerId || profile?.provider_user_id || profile?.providerUserId || ""
  ).trim();
  const workerSub = String(profile?.sub || profile?.user_id || profile?.id || profile?.uid || "").trim();
  const oauthEmail = profile?.email ? String(profile.email).trim().toLowerCase() : null;
  const displayName = sanitizeDisplayName(profile?.username || profile?.name || profile?.email || "");
  const avatarUrl = profile?.avatar || profile?.picture || profile?.avatar_url || null;

  // Prefer provider-scoped email when available, then provider_id, then sub.
  const stableIdentity = oauthEmail || oauthProviderId || workerSub;
  if (!stableIdentity) {
    throw new Error("OAuth token did not contain a stable user identity");
  }

  const oauthKey = `${oauthProvider}:${stableIdentity}`;

  let user = state.users.find(entry => entry.oauthKey === oauthKey);

  if (!user && oauthEmail) {
    user = state.users.find(entry => entry.oauthProvider === oauthProvider && entry.oauthEmail === oauthEmail);
  }

  if (!user && oauthProviderId) {
    user = state.users.find(entry => {
      return (
        entry.oauthProvider === oauthProvider &&
        (entry.oauthProviderId === oauthProviderId || entry.oauthSub === oauthProviderId)
      );
    });
  }

  if (!user && workerSub) {
    user = state.users.find(entry => entry.oauthProvider === oauthProvider && entry.oauthSub === workerSub);
  }

  // Legacy fallback: some older records were created without provider_id/email.
  // Reuse provider+displayName to migrate those records onto stable identities.
  if (!user && displayName) {
    const displayNameMatches = state.users
      .filter(entry => {
        return (
          entry.oauthProvider === oauthProvider &&
          entry.displayName === displayName &&
          !entry.oauthProviderId &&
          !entry.oauthEmail
        );
      })
      .sort((left, right) => toTimestamp(right.lastLoginAt) - toTimestamp(left.lastLoginAt));

    const canUseDisplayNameFallback =
      displayNameMatches.length === 1 ||
      (oauthEmail && displayNameMatches.length > 0) ||
      (!oauthProviderId && !oauthEmail && displayNameMatches.length > 0);

    if (canUseDisplayNameFallback) {
      user = displayNameMatches[0];
    }
  }

  if (!user) {
    const id = generateUniqueNumericId(7, new Set(state.users.map(entry => entry.id)));
    user = {
      id,
      oauthKey,
      oauthSub: stableIdentity,
      oauthProvider,
      oauthProviderId,
      oauthEmail,
      displayName,
      displayNameCustom: false,
      avatarUrl,
      createdAt: nowIso(),
      lastLoginAt: nowIso()
    };

    state.users.push(user);
  } else {
    // Migrate legacy records that were keyed by unstable token fields.
    user.oauthKey = oauthKey;
    user.oauthProvider = oauthProvider;
    user.oauthSub = stableIdentity;
    user.oauthProviderId = oauthProviderId || user.oauthProviderId || "";
    user.oauthEmail = oauthEmail || user.oauthEmail || null;
    const storedDisplayName = sanitizeDisplayName(user.displayName || "");
    const inferredCustomName = Boolean(storedDisplayName && displayName && storedDisplayName !== displayName);
    const displayNameIsCustom = Boolean(user.displayNameCustom || inferredCustomName);

    if (!displayNameIsCustom && displayName) {
      user.displayName = displayName;
    } else if (!user.displayNameCustom && inferredCustomName) {
      user.displayNameCustom = true;
    }

    user.avatarUrl = avatarUrl || user.avatarUrl || null;
    user.lastLoginAt = nowIso();
  }

  await persist();
  return clone(user);
};

const createSession = async userId => {
  const session = {
    id: crypto.randomUUID(),
    userId: String(userId),
    createdAt: nowIso(),
    lastSeenAt: nowIso()
  };

  state.sessions.push(session);
  await persist();
  return clone(session);
};

const touchSession = async sessionId => {
  const session = findSessionById(sessionId);
  if (!session) {
    return null;
  }

  session.lastSeenAt = nowIso();
  await persist();
  return clone(session);
};

const deleteSession = async sessionId => {
  const before = state.sessions.length;
  state.sessions = state.sessions.filter(session => session.id !== String(sessionId));

  if (state.sessions.length !== before) {
    await persist();
  }
};

const createRoom = async ({ name, ownerUserId, isPrivate = false }) => {
  const normalizedName = sanitizeRoomName(name);
  if (!normalizedName) {
    throw new Error("Room name is required");
  }

  const ownerId = String(ownerUserId);
  if (!findUserById(ownerId)) {
    throw new Error("Owner user does not exist");
  }

  const id = generateUniqueNumericId(4, new Set(state.rooms.map(room => room.id)));
  const room = {
    id,
    name: normalizedName,
    ownerUserId: ownerId,
    memberUserIds: [ownerId],
    pendingUserIds: [],
    isPrivate: Boolean(isPrivate),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  state.rooms.push(room);
  await persist();
  return clone(room);
};

const getRoomAccessForUser = (roomId, userId) => {
  const room = findRoomById(roomId);
  if (!room) {
    return "none";
  }

  const normalizedUserId = String(userId);
  if (room.memberUserIds.includes(normalizedUserId)) {
    return "member";
  }

  if (room.pendingUserIds.includes(normalizedUserId)) {
    return "pending";
  }

  return "none";
};

const joinRoom = async ({ roomId, userId }) => {
  const room = findRoomById(roomId);
  const normalizedUserId = String(userId);

  if (!room) {
    throw new Error("Room not found");
  }

  if (!findUserById(normalizedUserId)) {
    throw new Error("User not found");
  }

  if (room.memberUserIds.includes(normalizedUserId)) {
    return { room: clone(room), status: "member" };
  }

  if (room.isPrivate) {
    if (!room.pendingUserIds.includes(normalizedUserId)) {
      room.pendingUserIds.push(normalizedUserId);
      touchRoom(room);
      await persist();
    }

    return { room: clone(room), status: "pending" };
  }

  room.pendingUserIds = room.pendingUserIds.filter(entry => entry !== normalizedUserId);
  room.memberUserIds.push(normalizedUserId);
  touchRoom(room);
  await persist();

  return { room: clone(room), status: "member" };
};

const leaveRoom = async ({ roomId, userId }) => {
  const room = findRoomById(roomId);
  const normalizedUserId = String(userId);

  if (!room) {
    throw new Error("Room not found");
  }

  room.pendingUserIds = room.pendingUserIds.filter(entry => entry !== normalizedUserId);
  room.memberUserIds = room.memberUserIds.filter(entry => entry !== normalizedUserId);

  if (room.ownerUserId === normalizedUserId) {
    room.ownerUserId = room.memberUserIds[0] || null;

    if (!room.ownerUserId && room.pendingUserIds.length > 0) {
      const promotedUserId = room.pendingUserIds.shift();
      room.memberUserIds.push(promotedUserId);
      room.ownerUserId = promotedUserId;
    }
  }

  touchRoom(room);
  await persist();

  return clone(room);
};

const kickMember = async ({ roomId, ownerUserId, targetUserId }) => {
  const room = findRoomById(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  const normalizedOwnerId = String(ownerUserId);
  const normalizedTargetUserId = String(targetUserId);

  if (room.ownerUserId !== normalizedOwnerId) {
    throw new Error("Only room owner can kick members");
  }

  if (normalizedTargetUserId === room.ownerUserId) {
    throw new Error("Room owner cannot be kicked");
  }

  if (!room.memberUserIds.includes(normalizedTargetUserId)) {
    throw new Error("Target user is not a room member");
  }

  room.memberUserIds = room.memberUserIds.filter(entry => entry !== normalizedTargetUserId);
  room.pendingUserIds = room.pendingUserIds.filter(entry => entry !== normalizedTargetUserId);

  touchRoom(room);
  await persist();

  return clone(room);
};

const setRoomPrivacy = async ({ roomId, ownerUserId, isPrivate }) => {
  const room = findRoomById(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  const normalizedOwnerId = String(ownerUserId);
  if (room.ownerUserId !== normalizedOwnerId) {
    throw new Error("Only room owner can update privacy");
  }

  room.isPrivate = Boolean(isPrivate);
  touchRoom(room);
  await persist();

  return clone(room);
};

const approvePendingUser = async ({ roomId, ownerUserId, targetUserId }) => {
  const room = findRoomById(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  const normalizedOwnerId = String(ownerUserId);
  const normalizedTargetUserId = String(targetUserId);

  if (room.ownerUserId !== normalizedOwnerId) {
    throw new Error("Only room owner can approve waitlist users");
  }

  if (!room.pendingUserIds.includes(normalizedTargetUserId)) {
    throw new Error("User is not in waitlist");
  }

  room.pendingUserIds = room.pendingUserIds.filter(entry => entry !== normalizedTargetUserId);
  if (!room.memberUserIds.includes(normalizedTargetUserId)) {
    room.memberUserIds.push(normalizedTargetUserId);
  }

  touchRoom(room);
  await persist();

  return clone(room);
};

const rejectPendingUser = async ({ roomId, ownerUserId, targetUserId }) => {
  const room = findRoomById(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  const normalizedOwnerId = String(ownerUserId);
  const normalizedTargetUserId = String(targetUserId);

  if (room.ownerUserId !== normalizedOwnerId) {
    throw new Error("Only room owner can reject waitlist users");
  }

  if (!room.pendingUserIds.includes(normalizedTargetUserId)) {
    throw new Error("User is not in waitlist");
  }

  room.pendingUserIds = room.pendingUserIds.filter(entry => entry !== normalizedTargetUserId);
  touchRoom(room);
  await persist();

  return clone(room);
};

const addMessage = async ({ roomId, userId, text }) => {
  const room = findRoomById(roomId);
  const normalizedUserId = String(userId);
  const normalizedText = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

  if (!room) {
    throw new Error("Room not found");
  }

  if (!room.memberUserIds.includes(normalizedUserId)) {
    throw new Error("User is not a member of this room");
  }

  if (!normalizedText) {
    throw new Error("Message cannot be empty");
  }

  const message = {
    id: generateUniqueNumericId(10, new Set(state.messages.map(entry => entry.id))),
    roomId: String(roomId),
    userId: normalizedUserId,
    text: normalizedText,
    createdAt: nowIso()
  };

  state.messages.push(message);
  touchRoom(room);
  await persist();

  return formatMessageForClient(message);
};

const getMessagesForRoom = (roomId, limit = 200) => {
  const room = findRoomById(roomId);
  if (!room) {
    return [];
  }

  return state.messages
    .filter(message => message.roomId === String(roomId))
    .slice(-Math.max(1, Number(limit) || 200))
    .map(formatMessageForClient);
};

const getRoomMembers = roomId => {
  const room = findRoomById(roomId);
  if (!room) {
    return [];
  }

  return room.memberUserIds
    .map(memberId => findUserById(memberId))
    .filter(Boolean)
    .map(user => ({
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl
    }));
};

const getRoomPendingUsers = roomId => {
  const room = findRoomById(roomId);
  if (!room) {
    return [];
  }

  return room.pendingUserIds
    .map(userId => findUserById(userId))
    .filter(Boolean)
    .map(user => ({
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl
    }));
};

const getRoomUserIds = roomId => {
  const room = findRoomById(roomId);
  if (!room) {
    return [];
  }

  const values = new Set();
  for (const userId of room.memberUserIds) {
    values.add(String(userId));
  }
  for (const userId of room.pendingUserIds) {
    values.add(String(userId));
  }
  if (room.ownerUserId) {
    values.add(String(room.ownerUserId));
  }

  return [...values];
};

const listRoomsForUser = userId => {
  const normalizedUserId = String(userId);

  return state.rooms
    .filter(room => room.memberUserIds.includes(normalizedUserId) || room.pendingUserIds.includes(normalizedUserId))
    .map(room => {
      const owner = findUserById(room.ownerUserId);
      const accessStatus = room.memberUserIds.includes(normalizedUserId) ? "member" : "pending";
      const latestMessage =
        accessStatus === "member"
          ? [...state.messages]
              .reverse()
              .find(message => message.roomId === room.id)
          : null;
      const latestMessageAuthor = latestMessage ? findUserById(latestMessage.userId) : null;

      return {
        id: room.id,
        name: room.name,
        isPrivate: Boolean(room.isPrivate),
        ownerUserId: room.ownerUserId,
        ownerDisplayName: owner?.displayName || "None",
        memberCount: room.memberUserIds.length,
        pendingCount: room.pendingUserIds.length,
        accessStatus,
        canAccess: accessStatus === "member",
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        latestMessage: latestMessage
          ? {
              username: latestMessageAuthor?.displayName || "Unknown",
              text: latestMessage.text,
              createdAt: latestMessage.createdAt
            }
          : null
      };
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
};

const getUserById = userId => {
  const user = findUserById(userId);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    oauthProvider: user.oauthProvider,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
};

const updateUserDisplayName = async ({ userId, displayName }) => {
  const user = findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  user.displayName = sanitizeDisplayName(displayName);
  user.displayNameCustom = true;
  await persist();
  return getUserById(user.id);
};

const getSessionUser = sessionId => {
  const session = findSessionById(sessionId);
  if (!session) {
    return null;
  }

  const user = getUserById(session.userId);
  if (!user) {
    return null;
  }

  return {
    session: clone(session),
    user
  };
};

const getRoomById = roomId => {
  const room = findRoomById(roomId);
  return room ? clone(room) : null;
};

module.exports = {
  addMessage,
  approvePendingUser,
  createRoom,
  createSession,
  deleteSession,
  ensureStore,
  getMessagesForRoom,
  getRoomAccessForUser,
  getRoomById,
  getRoomMembers,
  getRoomPendingUsers,
  getRoomUserIds,
  getSessionUser,
  kickMember,
  joinRoom,
  leaveRoom,
  listRoomsForUser,
  rejectPendingUser,
  setRoomPrivacy,
  touchSession,
  updateUserDisplayName,
  upsertOAuthUser
};
