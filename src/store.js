const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { MongoClient } = require("mongodb");

const config = require("./config");

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const MESSAGE_ID_REGEX = /^\d{10}$/;
const DEFAULT_MAIN_DB_NAME = "achat_main";
const DEFAULT_MESSAGE_DB_NAME = "achat_messages";
const DELETED_USER_OAUTH_KEY = "system:deleted-user";
const ACCOUNT_HASH_WORDS = [
  "amber",
  "anchor",
  "apple",
  "arcade",
  "aspen",
  "atlas",
  "autumn",
  "bamboo",
  "beacon",
  "berry",
  "blossom",
  "breeze",
  "brook",
  "cactus",
  "canyon",
  "cedar",
  "cinder",
  "citrus",
  "clover",
  "comet",
  "copper",
  "coral",
  "cosmos",
  "crimson",
  "crystal",
  "daisy",
  "dawn",
  "delta",
  "ember",
  "fable",
  "falcon",
  "fern",
  "fjord",
  "forest",
  "galaxy",
  "garden",
  "ginger",
  "glacier",
  "golden",
  "granite",
  "harbor",
  "hazel",
  "honey",
  "indigo",
  "island",
  "ivory",
  "jasmine",
  "jungle",
  "lagoon",
  "lantern",
  "lavender",
  "lemon",
  "lilac",
  "lotus",
  "lumen",
  "maple",
  "marble",
  "meadow",
  "meteor",
  "midnight",
  "mist",
  "monsoon",
  "moss",
  "nectar",
  "nova",
  "oak",
  "oasis",
  "olive",
  "onyx",
  "opal",
  "orchid",
  "otter",
  "pebble",
  "pepper",
  "phoenix",
  "pine",
  "pluto",
  "prairie",
  "puzzle",
  "quartz",
  "quill",
  "rainbow",
  "raven",
  "reef",
  "ripple",
  "river",
  "rocket",
  "saffron",
  "sakura",
  "sand",
  "sapphire",
  "scarlet",
  "shadow",
  "silver",
  "sky",
  "solstice",
  "sparrow",
  "spring",
  "spruce",
  "star",
  "storm",
  "summer",
  "sunset",
  "tango",
  "thunder",
  "timber",
  "topaz",
  "trident",
  "tulip",
  "twilight",
  "velvet",
  "violet",
  "voyage",
  "water",
  "whisper",
  "willow",
  "winter",
  "zephyr"
];
const ACCOUNT_HASH_WORD_REGEX = /^[a-z]+$/;
const ACCOUNT_HASH_FIRST_SEGMENT_REGEX = /^[a-z]+(?:\d{1,2})?$/;
const ACCOUNT_HASH_NUMBER_REGEX = /^\d{3,6}$/;
const ACCOUNT_HASH_DIGEST_REGEX = /^[a-f0-9]{64}$/;
const LEGACY_ACCOUNT_HASH_WORD_COUNT_MIN = 9;
const LEGACY_ACCOUNT_HASH_WORD_COUNT_MAX = 10;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_HASH_REGEX = /^[a-f0-9]{32}:[a-f0-9]{128}$/;

const EMPTY_STORE = {
  users: [],
  rooms: [],
  messages: [],
  sessions: []
};

let state = JSON.parse(JSON.stringify(EMPTY_STORE));
let persistQueue = Promise.resolve();
let mongoCollections = null;
let messageIdSet = new Set();
let latestMessageByRoomId = new Map();
let messagesByRoomId = new Map();

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

const normalizeEmail = value => String(value || "").trim().toLowerCase();

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

const getLegacyAccountHashTokens = value => String(value || "").toLowerCase().match(/[a-z0-9]+/g) || [];

const isValidLegacyAccountHashTokens = tokens => {
  const list = Array.isArray(tokens) ? tokens : [];
  if (list.length < LEGACY_ACCOUNT_HASH_WORD_COUNT_MIN + 1 || list.length > LEGACY_ACCOUNT_HASH_WORD_COUNT_MAX + 1) {
    return false;
  }

  const numberToken = list[list.length - 1] || "";
  if (!ACCOUNT_HASH_NUMBER_REGEX.test(numberToken)) {
    return false;
  }

  const wordTokens = list.slice(0, -1);
  return wordTokens.every(token => ACCOUNT_HASH_WORD_REGEX.test(token));
};

const normalizeAccountHash = value => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }

  const compact = raw.replace(/\s*-\s*/g, "-").replace(/\s+/g, "");
  const hyphenSegments = compact.split("-");
  if (hyphenSegments.length === 5) {
    const [segmentOne, segmentTwo, segmentThree, segmentFour, segmentFive] = hyphenSegments;
    const isValidHyphenated =
      ACCOUNT_HASH_FIRST_SEGMENT_REGEX.test(segmentOne || "") &&
      ACCOUNT_HASH_WORD_REGEX.test(segmentTwo || "") &&
      ACCOUNT_HASH_WORD_REGEX.test(segmentThree || "") &&
      ACCOUNT_HASH_WORD_REGEX.test(segmentFour || "") &&
      ACCOUNT_HASH_NUMBER_REGEX.test(segmentFive || "");
    if (isValidHyphenated) {
      return `${segmentOne}-${segmentTwo}-${segmentThree}-${segmentFour}-${segmentFive}`;
    }
  }

  const legacyTokens = getLegacyAccountHashTokens(raw);
  if (!isValidLegacyAccountHashTokens(legacyTokens)) {
    return "";
  }

  return legacyTokens.join(" ");
};

const hashNormalizedAccountHash = normalizedValue => {
  return crypto
    .createHash("sha256")
    .update(String(normalizedValue || ""))
    .digest("hex");
};

const isPasswordLengthValid = value => {
  const password = String(value || "");
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
};

const hashPassword = password => {
  const normalizedPassword = String(password || "");
  const saltHex = crypto.randomBytes(16).toString("hex");
  const derivedHex = crypto.scryptSync(normalizedPassword, saltHex, 64).toString("hex");
  return `${saltHex}:${derivedHex}`;
};

const verifyPasswordHash = ({ password, passwordHash }) => {
  const normalizedHash = String(passwordHash || "").trim().toLowerCase();
  if (!PASSWORD_HASH_REGEX.test(normalizedHash)) {
    return false;
  }

  const [saltHex, expectedDerivedHex] = normalizedHash.split(":");
  if (!saltHex || !expectedDerivedHex) {
    return false;
  }

  let actualDerivedHex = "";
  try {
    actualDerivedHex = crypto.scryptSync(String(password || ""), saltHex, 64).toString("hex");
  } catch (error) {
    return false;
  }

  if (actualDerivedHex.length !== expectedDerivedHex.length) {
    return false;
  }

  const actualBuffer = Buffer.from(actualDerivedHex, "hex");
  const expectedBuffer = Buffer.from(expectedDerivedHex, "hex");
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const normalizeUserPasswordFields = user => {
  user.passwordHash = String(user.passwordHash || "")
    .trim()
    .toLowerCase();
  if (!PASSWORD_HASH_REGEX.test(user.passwordHash)) {
    user.passwordHash = "";
  }

  user.passwordLoginEmail = normalizeEmail(user.passwordLoginEmail || "");
  if (user.passwordHash && !user.passwordLoginEmail && user.oauthEmail) {
    user.passwordLoginEmail = normalizeEmail(user.oauthEmail);
  }

  if (!user.passwordHash) {
    user.passwordLoginEmail = "";
  }

  user.passwordUpdatedAt = user.passwordUpdatedAt ? String(user.passwordUpdatedAt) : null;
};

const createAccountHashCandidate = () => {
  const pickWord = () => ACCOUNT_HASH_WORDS[crypto.randomInt(0, ACCOUNT_HASH_WORDS.length)];
  const firstWordSuffix = crypto.randomInt(0, 2) === 1 ? String(crypto.randomInt(1, 100)) : "";
  const segmentOne = `${pickWord()}${firstWordSuffix}`;
  const segmentTwo = pickWord();
  const segmentThree = pickWord();
  const segmentFour = pickWord();
  const segmentFive = String(crypto.randomInt(1000, 10000));
  return `${segmentOne}-${segmentTwo}-${segmentThree}-${segmentFour}-${segmentFive}`;
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
    room.isDiscoverable = room.isDiscoverable !== false;
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
    user.oauthEmail = user.oauthEmail ? normalizeEmail(user.oauthEmail) : null;
    user.avatarUrl = user.avatarUrl || null;
    normalizeUserPasswordFields(user);
    user.accountHashDigest = String(user.accountHashDigest || "")
      .trim()
      .toLowerCase();
    if (!ACCOUNT_HASH_DIGEST_REGEX.test(user.accountHashDigest)) {
      user.accountHashDigest = "";
    }
    user.accountHashUpdatedAt = user.accountHashUpdatedAt ? String(user.accountHashUpdatedAt) : null;
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

const getDbNameFromUri = uri => {
  if (!uri) {
    return "";
  }

  try {
    const parsed = new URL(uri);
    return parsed.pathname.replace(/^\/+/, "").split("/")[0] || "";
  } catch (error) {
    return "";
  }
};

const toMongoDocument = value => {
  const normalizedId = String(value.id || "");
  return {
    ...clone(value),
    id: normalizedId,
    _id: normalizedId
  };
};

const fromMongoDocument = value => {
  if (!value) {
    return value;
  }

  const next = { ...value };
  delete next._id;
  return next;
};

const ensureMongoConnections = async () => {
  if (mongoCollections) {
    return mongoCollections;
  }

  if (!config.MONGODB_MAIN_DB_URL) {
    throw new Error("Missing MONGODB_MAIN_DB_URL");
  }

  if (!config.MONGODB_MESSAGE_DB_URL) {
    throw new Error("Missing MONGODB_MESSAGE_DB_URL");
  }

  const mainClient = new MongoClient(config.MONGODB_MAIN_DB_URL);
  const useSharedClient = config.MONGODB_MESSAGE_DB_URL === config.MONGODB_MAIN_DB_URL;
  const messageClient = useSharedClient ? mainClient : new MongoClient(config.MONGODB_MESSAGE_DB_URL);

  await Promise.all([mainClient.connect(), useSharedClient ? Promise.resolve() : messageClient.connect()]);

  const mainDbName = config.MONGODB_MAIN_DB_NAME || getDbNameFromUri(config.MONGODB_MAIN_DB_URL) || DEFAULT_MAIN_DB_NAME;
  const messageDbName =
    config.MONGODB_MESSAGE_DB_NAME || getDbNameFromUri(config.MONGODB_MESSAGE_DB_URL) || DEFAULT_MESSAGE_DB_NAME;

  const mainDb = mainClient.db(mainDbName);
  const messageDb = messageClient.db(messageDbName);

  mongoCollections = {
    users: mainDb.collection("users"),
    rooms: mainDb.collection("rooms"),
    sessions: mainDb.collection("sessions"),
    messages: messageDb.collection("messages")
  };

  await Promise.all([
    mongoCollections.users.createIndex({ oauthKey: 1 }),
    mongoCollections.users.createIndex({ accountHashDigest: 1 }),
    mongoCollections.users.createIndex({ passwordLoginEmail: 1 }),
    mongoCollections.rooms.createIndex({ ownerUserId: 1 }),
    mongoCollections.sessions.createIndex({ userId: 1 }),
    mongoCollections.messages.createIndex({ roomId: 1, createdAt: 1 }),
    mongoCollections.messages.createIndex({ userId: 1 })
  ]);

  return mongoCollections;
};

const queueWrite = async operation => {
  persistQueue = persistQueue.then(operation);
  return persistQueue;
};

const syncCollection = async (collection, entries) => {
  await collection.deleteMany({});
  if (entries.length > 0) {
    await collection.insertMany(entries.map(toMongoDocument));
  }
};

const syncStateToMongo = async () => {
  const snapshot = clone(state);
  await queueWrite(async () => {
    const collections = await ensureMongoConnections();
    await Promise.all([
      syncCollection(collections.users, snapshot.users),
      syncCollection(collections.rooms, snapshot.rooms),
      syncCollection(collections.sessions, snapshot.sessions),
      syncCollection(collections.messages, snapshot.messages)
    ]);
  });
};

const persistUser = async user => {
  await queueWrite(async () => {
    const collections = await ensureMongoConnections();
    await collections.users.replaceOne({ _id: String(user.id) }, toMongoDocument(user), { upsert: true });
  });
};

const persistRoom = async room => {
  await queueWrite(async () => {
    const collections = await ensureMongoConnections();
    await collections.rooms.replaceOne({ _id: String(room.id) }, toMongoDocument(room), { upsert: true });
  });
};

const persistSession = async session => {
  await queueWrite(async () => {
    const collections = await ensureMongoConnections();
    await collections.sessions.replaceOne({ _id: String(session.id) }, toMongoDocument(session), { upsert: true });
  });
};

const deletePersistedSession = async sessionId => {
  await queueWrite(async () => {
    const collections = await ensureMongoConnections();
    await collections.sessions.deleteOne({ _id: String(sessionId) });
  });
};

const persistMessageAndRoom = async ({ message, room }) => {
  await queueWrite(async () => {
    const collections = await ensureMongoConnections();
    await collections.messages.replaceOne({ _id: String(message.id) }, toMongoDocument(message), { upsert: true });
    await collections.rooms.replaceOne({ _id: String(room.id) }, toMongoDocument(room), { upsert: true });
  });
};

const deletePersistedMessageAndRoom = async ({ messageId, room }) => {
  await queueWrite(async () => {
    const collections = await ensureMongoConnections();
    await collections.messages.deleteOne({ _id: String(messageId) });
    await collections.rooms.replaceOne({ _id: String(room.id) }, toMongoDocument(room), { upsert: true });
  });
};

const loadLegacyStoreFile = async () => {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
};

const ensureStore = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const collections = await ensureMongoConnections();
  const [users, rooms, sessions, messages] = await Promise.all([
    collections.users.find({}).toArray(),
    collections.rooms.find({}).toArray(),
    collections.sessions.find({}).toArray(),
    collections.messages.find({}).toArray()
  ]);

  const hasMongoData = users.length > 0 || rooms.length > 0 || sessions.length > 0 || messages.length > 0;
  if (hasMongoData) {
    state = normalizeStore({
      users: users.map(fromMongoDocument),
      rooms: rooms.map(fromMongoDocument),
      sessions: sessions.map(fromMongoDocument),
      messages: messages.map(fromMongoDocument)
    });
    rebuildMessageIndexes();
    await syncStateToMongo();
    return;
  }

  const legacyState = await loadLegacyStoreFile();
  state = legacyState || clone(EMPTY_STORE);
  rebuildMessageIndexes();
  await syncStateToMongo();
};

const findUserById = userId => state.users.find(user => user.id === String(userId));
const findSessionById = sessionId => state.sessions.find(session => session.id === String(sessionId));
const findRoomById = roomId => state.rooms.find(room => room.id === String(roomId));
const findDeletedUser = () => state.users.find(user => user.oauthKey === DELETED_USER_OAUTH_KEY);
const toTimestamp = value => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const rebuildMessageIndexes = () => {
  messageIdSet = new Set();
  latestMessageByRoomId = new Map();
  messagesByRoomId = new Map();

  for (const message of state.messages) {
    const messageId = String(message?.id || "");
    if (messageId) {
      messageIdSet.add(messageId);
    }

    const roomId = String(message?.roomId || "");
    if (!roomId) {
      continue;
    }

    const roomMessages = messagesByRoomId.get(roomId) || [];
    roomMessages.push(message);
    messagesByRoomId.set(roomId, roomMessages);

    const existing = latestMessageByRoomId.get(roomId);
    if (!existing || toTimestamp(message.createdAt) >= toTimestamp(existing.createdAt)) {
      latestMessageByRoomId.set(roomId, message);
    }
  }
};

const getMessagesForRoomEntries = roomId => {
  const normalizedRoomId = String(roomId || "");
  if (!normalizedRoomId) {
    return [];
  }

  return messagesByRoomId.get(normalizedRoomId) || [];
};

const refreshLatestMessageForRoom = roomId => {
  const normalizedRoomId = String(roomId || "");
  if (!normalizedRoomId) {
    return;
  }

  const roomMessages = getMessagesForRoomEntries(normalizedRoomId);
  let latest = null;
  for (const message of roomMessages) {
    if (!latest || toTimestamp(message.createdAt) >= toTimestamp(latest.createdAt)) {
      latest = message;
    }
  }

  if (latest) {
    latestMessageByRoomId.set(normalizedRoomId, latest);
  } else {
    latestMessageByRoomId.delete(normalizedRoomId);
  }
};

const touchRoom = room => {
  room.updatedAt = nowIso();
};

const ensureDeletedUser = () => {
  let deletedUser = findDeletedUser();
  if (deletedUser) {
    return deletedUser;
  }

  const id = generateUniqueNumericId(7, new Set(state.users.map(user => user.id)));
  deletedUser = {
    id,
    oauthKey: DELETED_USER_OAUTH_KEY,
    oauthSub: "deleted-user",
    oauthProvider: "system",
    oauthProviderId: "",
    oauthEmail: null,
    displayName: "Deleted User",
    displayNameCustom: false,
    avatarUrl: null,
    passwordHash: "",
    passwordLoginEmail: "",
    passwordUpdatedAt: null,
    accountHashDigest: "",
    accountHashUpdatedAt: null,
    createdAt: nowIso(),
    lastLoginAt: nowIso()
  };

  state.users.push(deletedUser);
  return deletedUser;
};

const formatMessageForClient = message => {
  const author = findUserById(message.userId);
  return {
    id: message.id,
    roomId: message.roomId,
    userId: message.userId,
    username: author?.displayName || "Deleted User",
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
  const oauthEmail = profile?.email ? normalizeEmail(profile.email) : null;
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
      passwordHash: "",
      passwordLoginEmail: "",
      passwordUpdatedAt: null,
      accountHashDigest: "",
      accountHashUpdatedAt: null,
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
    normalizeUserPasswordFields(user);
    user.accountHashDigest = String(user.accountHashDigest || "")
      .trim()
      .toLowerCase();
    if (!ACCOUNT_HASH_DIGEST_REGEX.test(user.accountHashDigest)) {
      user.accountHashDigest = "";
    }
    user.accountHashUpdatedAt = user.accountHashUpdatedAt ? String(user.accountHashUpdatedAt) : null;
    user.lastLoginAt = nowIso();
  }

  await persistUser(user);
  return clone(user);
};

const setUserPasswordLogin = async ({ userId, password, currentPassword = "" }) => {
  const user = findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const normalizedPassword = String(password || "");
  if (!isPasswordLengthValid(normalizedPassword)) {
    throw new Error(`Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`);
  }

  const loginEmail = normalizeEmail(user.oauthEmail || "");
  if (!loginEmail) {
    throw new Error("No OAuth email found on this account. Password login cannot be enabled.");
  }

  const conflictingUser = state.users.find(entry => {
    return (
      String(entry.id) !== String(user.id) &&
      Boolean(String(entry.passwordHash || "")) &&
      normalizeEmail(entry.passwordLoginEmail || "") === loginEmail
    );
  });
  if (conflictingUser) {
    throw new Error("This email is already linked to another password-login account");
  }

  if (user.passwordHash) {
    const hasCurrentPassword = String(currentPassword || "").length > 0;
    if (!hasCurrentPassword) {
      throw new Error("Current password is required");
    }

    const isCurrentPasswordValid = verifyPasswordHash({
      password: currentPassword,
      passwordHash: user.passwordHash
    });
    if (!isCurrentPasswordValid) {
      throw new Error("Current password is incorrect");
    }
  }

  user.passwordHash = hashPassword(normalizedPassword);
  user.passwordLoginEmail = loginEmail;
  user.passwordUpdatedAt = nowIso();
  await persistUser(user);
  return getUserById(user.id);
};

const disableUserPasswordLogin = async ({ userId, currentPassword = "" }) => {
  const user = findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.passwordHash) {
    throw new Error("Password login is not enabled");
  }

  const hasCurrentPassword = String(currentPassword || "").length > 0;
  if (!hasCurrentPassword) {
    throw new Error("Current password is required");
  }

  const isCurrentPasswordValid = verifyPasswordHash({
    password: currentPassword,
    passwordHash: user.passwordHash
  });
  if (!isCurrentPasswordValid) {
    throw new Error("Current password is incorrect");
  }

  user.passwordHash = "";
  user.passwordLoginEmail = "";
  user.passwordUpdatedAt = null;
  await persistUser(user);
  return getUserById(user.id);
};

const authenticateUserByPassword = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || "");
  if (!normalizedEmail || !normalizedPassword) {
    return null;
  }

  const user = state.users.find(entry => {
    return (
      Boolean(String(entry.passwordHash || "")) &&
      normalizeEmail(entry.passwordLoginEmail || "") === normalizedEmail
    );
  });
  if (!user) {
    return null;
  }

  const isValid = verifyPasswordHash({
    password: normalizedPassword,
    passwordHash: user.passwordHash
  });
  if (!isValid) {
    return null;
  }

  user.lastLoginAt = nowIso();
  await persistUser(user);
  return getUserById(user.id);
};

const generateAccountHashForUser = async ({ userId }) => {
  const user = findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const existingDigests = new Set(state.users.map(entry => String(entry.accountHashDigest || "")).filter(Boolean));
  existingDigests.delete(String(user.accountHashDigest || ""));

  for (let attempt = 0; attempt < 10000; attempt += 1) {
    const accountHash = createAccountHashCandidate();
    const normalized = normalizeAccountHash(accountHash);
    if (!normalized) {
      continue;
    }

    const digest = hashNormalizedAccountHash(normalized);
    if (existingDigests.has(digest)) {
      continue;
    }

    user.accountHashDigest = digest;
    user.accountHashUpdatedAt = nowIso();
    await persistUser(user);

    return {
      accountHash,
      user: getUserById(user.id)
    };
  }

  throw new Error("Unable to generate a unique account hash");
};

const authenticateUserByAccountHash = async accountHash => {
  const normalized = normalizeAccountHash(accountHash);
  if (!normalized) {
    return null;
  }

  const digest = hashNormalizedAccountHash(normalized);
  const user = state.users.find(entry => String(entry.accountHashDigest || "") === digest);
  if (!user) {
    return null;
  }

  user.lastLoginAt = nowIso();
  await persistUser(user);
  return getUserById(user.id);
};

const disableUserAccountHashLogin = async ({ userId }) => {
  const user = findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  user.accountHashDigest = "";
  user.accountHashUpdatedAt = null;
  await persistUser(user);
  return getUserById(user.id);
};

const createSession = async userId => {
  const session = {
    id: crypto.randomUUID(),
    userId: String(userId),
    createdAt: nowIso(),
    lastSeenAt: nowIso()
  };

  state.sessions.push(session);
  await persistSession(session);
  return clone(session);
};

const touchSession = async sessionId => {
  const session = findSessionById(sessionId);
  if (!session) {
    return null;
  }

  session.lastSeenAt = nowIso();
  await persistSession(session);
  return clone(session);
};

const deleteSession = async sessionId => {
  const before = state.sessions.length;
  state.sessions = state.sessions.filter(session => session.id !== String(sessionId));

  if (state.sessions.length !== before) {
    await deletePersistedSession(sessionId);
  }
};

const createRoom = async ({ name, ownerUserId, isPrivate = false, isDiscoverable = true }) => {
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
    isDiscoverable: Boolean(isDiscoverable),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  state.rooms.push(room);
  await persistRoom(room);
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
      await persistRoom(room);
    }

    return { room: clone(room), status: "pending" };
  }

  room.pendingUserIds = room.pendingUserIds.filter(entry => entry !== normalizedUserId);
  room.memberUserIds.push(normalizedUserId);
  touchRoom(room);
  await persistRoom(room);

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
  await persistRoom(room);

  return clone(room);
};

const transferRoomOwnership = async ({ roomId, ownerUserId, targetUserId }) => {
  const room = findRoomById(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  const normalizedOwnerId = String(ownerUserId);
  const normalizedTargetId = String(targetUserId);

  if (room.ownerUserId !== normalizedOwnerId) {
    throw new Error("Only room owner can transfer ownership");
  }

  if (normalizedTargetId === room.ownerUserId) {
    throw new Error("Target user is already the room owner");
  }

  if (!room.memberUserIds.includes(normalizedTargetId)) {
    throw new Error("Target user must be an approved room member");
  }

  room.ownerUserId = normalizedTargetId;
  touchRoom(room);
  await persistRoom(room);

  return clone(room);
};

const deleteRoom = async ({ roomId, ownerUserId }) => {
  const room = findRoomById(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  const normalizedOwnerId = String(ownerUserId);
  if (room.ownerUserId !== normalizedOwnerId) {
    throw new Error("Only room owner can delete room");
  }

  const impactedUserIds = new Set(getRoomUserIds(room.id));
  state.rooms = state.rooms.filter(entry => entry.id !== room.id);
  state.messages = state.messages.filter(message => message.roomId !== room.id);
  rebuildMessageIndexes();
  await syncStateToMongo();

  return {
    roomId: room.id,
    impactedUserIds: [...impactedUserIds]
  };
};

const deleteUserAccount = async ({ userId }) => {
  const normalizedUserId = String(userId);
  const user = findUserById(normalizedUserId);
  if (!user) {
    throw new Error("User not found");
  }

  const ownedRooms = state.rooms.filter(room => room.ownerUserId === normalizedUserId);
  if (ownedRooms.length > 0) {
    throw new Error("Transfer ownership or delete your owned rooms before deleting your account");
  }

  const hasAuthoredMessages = state.messages.some(message => message.userId === normalizedUserId);
  const deletedUser = hasAuthoredMessages ? ensureDeletedUser() : null;
  if (deletedUser && deletedUser.id === normalizedUserId) {
    throw new Error("Cannot delete placeholder user");
  }

  const affectedRoomIds = new Set();
  const affectedUserIds = new Set();

  for (const room of state.rooms) {
    const wasInRoom =
      room.ownerUserId === normalizedUserId ||
      room.memberUserIds.includes(normalizedUserId) ||
      room.pendingUserIds.includes(normalizedUserId);
    if (!wasInRoom) {
      continue;
    }

    const previousParticipants = new Set([...room.memberUserIds, ...room.pendingUserIds, room.ownerUserId].filter(Boolean));
    for (const participantId of previousParticipants) {
      if (participantId !== normalizedUserId) {
        affectedUserIds.add(String(participantId));
      }
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

    if (!room.ownerUserId && room.memberUserIds.length > 0) {
      room.ownerUserId = room.memberUserIds[0];
    }

    if (room.memberUserIds.length === 0 && room.pendingUserIds.length === 0) {
      state.messages = state.messages.filter(message => message.roomId !== room.id);
      continue;
    }

    touchRoom(room);
    affectedRoomIds.add(String(room.id));
    for (const participantId of getRoomUserIds(room.id)) {
      if (participantId !== normalizedUserId) {
        affectedUserIds.add(String(participantId));
      }
    }
  }

  state.rooms = state.rooms.filter(room => room.memberUserIds.length > 0 || room.pendingUserIds.length > 0);
  state.sessions = state.sessions.filter(session => session.userId !== normalizedUserId);

  if (deletedUser) {
    for (const message of state.messages) {
      if (message.userId === normalizedUserId) {
        message.userId = deletedUser.id;
      }
    }
  }

  state.users = state.users.filter(entry => entry.id !== normalizedUserId);
  rebuildMessageIndexes();
  await syncStateToMongo();

  return {
    affectedRoomIds: [...affectedRoomIds],
    affectedUserIds: [...affectedUserIds]
  };
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
  await persistRoom(room);

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
  await persistRoom(room);

  return clone(room);
};

const setRoomDiscoverability = async ({ roomId, ownerUserId, isDiscoverable }) => {
  const room = findRoomById(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  const normalizedOwnerId = String(ownerUserId);
  if (room.ownerUserId !== normalizedOwnerId) {
    throw new Error("Only room owner can update discoverability");
  }

  room.isDiscoverable = Boolean(isDiscoverable);
  touchRoom(room);
  await persistRoom(room);

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
  await persistRoom(room);

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
  await persistRoom(room);

  return clone(room);
};

const addMessage = async ({ roomId, userId, text }) => {
  const room = findRoomById(roomId);
  const normalizedUserId = String(userId);
  const normalizedText = String(text || "").replace(/\r\n/g, "\n").slice(0, 2000).trim();

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
    id: generateUniqueNumericId(10, messageIdSet),
    roomId: String(roomId),
    userId: normalizedUserId,
    text: normalizedText,
    createdAt: nowIso()
  };

  state.messages.push(message);
  messageIdSet.add(message.id);
  const roomMessages = messagesByRoomId.get(message.roomId) || [];
  roomMessages.push(message);
  messagesByRoomId.set(message.roomId, roomMessages);
  refreshLatestMessageForRoom(message.roomId);
  touchRoom(room);
  await persistMessageAndRoom({ message, room });

  return formatMessageForClient(message);
};

const deleteMessage = async ({ roomId, messageId, requesterUserId }) => {
  const room = findRoomById(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  const normalizedRequesterId = String(requesterUserId);
  const normalizedMessageId = String(messageId);
  const message = state.messages.find(entry => entry.id === normalizedMessageId);
  if (!message || String(message.roomId) !== String(room.id)) {
    throw new Error("Message not found");
  }

  const canDelete =
    String(message.userId) === normalizedRequesterId || String(room.ownerUserId || "") === normalizedRequesterId;
  if (!canDelete) {
    throw new Error("You are not allowed to delete this message");
  }

  state.messages = state.messages.filter(entry => entry.id !== normalizedMessageId);
  messageIdSet.delete(normalizedMessageId);
  const roomMessages = getMessagesForRoomEntries(room.id).filter(entry => String(entry.id) !== normalizedMessageId);
  if (roomMessages.length > 0) {
    messagesByRoomId.set(String(room.id), roomMessages);
  } else {
    messagesByRoomId.delete(String(room.id));
  }
  refreshLatestMessageForRoom(room.id);
  touchRoom(room);
  await deletePersistedMessageAndRoom({ messageId: normalizedMessageId, room });

  return {
    roomId: String(room.id),
    messageId: normalizedMessageId
  };
};

const normalizeMessagePageLimit = limit => Math.max(1, Math.min(200, Number(limit) || 80));

const getMessagesPageForRoom = ({ roomId, limit = 80, beforeMessageId = "" } = {}) => {
  const room = findRoomById(roomId);
  if (!room) {
    return {
      messages: [],
      hasMore: false
    };
  }

  const normalizedRoomId = String(roomId);
  const normalizedBeforeMessageId = String(beforeMessageId || "").trim();
  const roomMessages = getMessagesForRoomEntries(normalizedRoomId);
  const normalizedLimit = normalizeMessagePageLimit(limit);

  let endExclusive = roomMessages.length;
  if (normalizedBeforeMessageId) {
    const beforeIndex = roomMessages.findIndex(message => String(message.id) === normalizedBeforeMessageId);
    if (beforeIndex >= 0) {
      endExclusive = beforeIndex;
    }
  }

  const startInclusive = Math.max(0, endExclusive - normalizedLimit);
  return {
    messages: roomMessages.slice(startInclusive, endExclusive).map(formatMessageForClient),
    hasMore: startInclusive > 0
  };
};

const getMessagesForRoom = (roomId, limit = 200) => {
  const page = getMessagesPageForRoom({ roomId, limit, beforeMessageId: "" });
  return page.messages;
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

const getLatestMessageByRoomId = () => {
  return latestMessageByRoomId;
};

const listRoomsForUser = userId => {
  const normalizedUserId = String(userId);
  const latestMessageByRoomId = getLatestMessageByRoomId();

  return state.rooms
    .filter(room => room.memberUserIds.includes(normalizedUserId) || room.pendingUserIds.includes(normalizedUserId))
    .map(room => {
      const owner = findUserById(room.ownerUserId);
      const accessStatus = room.memberUserIds.includes(normalizedUserId) ? "member" : "pending";
      const latestMessage = accessStatus === "member" ? latestMessageByRoomId.get(String(room.id)) || null : null;
      const latestMessageAuthor = latestMessage ? findUserById(latestMessage.userId) : null;

      return {
        id: room.id,
        name: room.name,
        isPrivate: Boolean(room.isPrivate),
        isDiscoverable: room.isDiscoverable !== false,
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

const listDiscoverableRoomsForUser = userId => {
  const normalizedUserId = String(userId);

  return state.rooms
    .filter(room => {
      if (room.memberUserIds.includes(normalizedUserId) || room.pendingUserIds.includes(normalizedUserId)) {
        return true;
      }

      return room.isDiscoverable !== false;
    })
    .map(room => {
      const owner = findUserById(room.ownerUserId);
      const accessStatus = getRoomAccessForUser(room.id, normalizedUserId);
      return {
        id: room.id,
        name: room.name,
        isPrivate: Boolean(room.isPrivate),
        isDiscoverable: room.isDiscoverable !== false,
        ownerUserId: room.ownerUserId,
        ownerDisplayName: owner?.displayName || "Unknown",
        memberCount: room.memberUserIds.length,
        pendingCount: room.pendingUserIds.length,
        accessStatus,
        canJoin: accessStatus === "none",
        createdAt: room.createdAt,
        updatedAt: room.updatedAt
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
    email: user.oauthEmail || null,
    hasPasswordLogin: Boolean(user.passwordHash),
    passwordLoginEmail: user.passwordLoginEmail || null,
    passwordUpdatedAt: user.passwordUpdatedAt || null,
    hasAccountHash: Boolean(user.accountHashDigest),
    accountHashUpdatedAt: user.accountHashUpdatedAt || null,
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
  await persistUser(user);
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
  authenticateUserByAccountHash,
  authenticateUserByPassword,
  approvePendingUser,
  createRoom,
  createSession,
  deleteMessage,
  deleteRoom,
  deleteSession,
  disableUserAccountHashLogin,
  disableUserPasswordLogin,
  deleteUserAccount,
  ensureStore,
  generateAccountHashForUser,
  getMessagesPageForRoom,
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
  listDiscoverableRoomsForUser,
  listRoomsForUser,
  rejectPendingUser,
  transferRoomOwnership,
  setRoomDiscoverability,
  setRoomPrivacy,
  setUserPasswordLogin,
  touchSession,
  updateUserDisplayName,
  upsertOAuthUser
};
