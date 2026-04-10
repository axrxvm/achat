const state = {
  user: null,
  devices: [],
  rooms: [],
  discoverableRooms: [],
  botApps: [],
  botTokensById: new Map(),
  activeRoomId: null,
  membersByRoom: new Map(),
  pendingByRoom: new Map(),
  messagesByRoom: new Map(),
  messageHasMoreByRoom: new Map(),
  messageLoadingOlderByRoom: new Set(),
  typingByRoom: new Map(),
  activeRoomCanAccess: false,
  activeRoomAccessStatus: "none"
};

const socket = io({
  autoConnect: false,
  withCredentials: true
});

const SOCKET_ACK_TIMEOUT_MS = 3500;
const ROOM_POLL_INTERVAL_MS = 8000;
const ROOM_ORDER_COOKIE_PREFIX = "achat_room_order_";
const ROOM_ORDER_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 365;
const NOTIFICATION_PREFS_STORAGE_PREFIX = "achat_notification_prefs_";
const ROOM_KEYS_STORAGE_PREFIX = "achat_room_keys_";
const BOT_SYSTEM_ENABLED = false;

const authView = document.getElementById("auth-view");
const bootView = document.getElementById("boot-view");
const appView = document.getElementById("app-view");
const authChoicePanel = document.getElementById("auth-choice-panel");
const authLoginPanel = document.getElementById("auth-login-panel");
const authRegisterPanel = document.getElementById("auth-register-panel");
const authOpenLoginButton = document.getElementById("auth-open-login");
const authOpenRegisterButton = document.getElementById("auth-open-register");
const authBackFromLoginButton = document.getElementById("auth-back-from-login");
const authBackFromRegisterButton = document.getElementById("auth-back-from-register");
const accountCreateForm = document.getElementById("account-create-form");
const accountCreateUsernameInput = document.getElementById("account-create-username-input");
const accountCreateDeviceLabelInput = document.getElementById("account-create-device-label-input");
const accountCreateButton = document.getElementById("account-create-button");
const accountHashLoginForm = document.getElementById("account-hash-login-form");
const accountHashLoginInput = document.getElementById("account-hash-login-input");
const accountHashDeviceLabelInput = document.getElementById("account-hash-device-label-input");
const accountHashLoginButton = document.getElementById("account-hash-login-button");
const passwordLoginForm = document.getElementById("password-login-form");
const passwordLoginEmailInput = document.getElementById("password-login-email-input");
const passwordLoginPasswordInput = document.getElementById("password-login-password-input");
const passwordLoginButton = document.getElementById("password-login-button");
const logoutButton = document.getElementById("logout");

const roomPanel = document.getElementById("room-panel");
const memberPanel = document.getElementById("member-panel");
const mobileRoomsToggleButton = document.getElementById("mobile-rooms-toggle");
const mobileMembersToggleButton = document.getElementById("mobile-members-toggle");
const mobileDrawerBackdrop = document.getElementById("mobile-drawer-backdrop");

const userChip = document.getElementById("user-chip");
const roomList = document.getElementById("room-list");

const activeRoomName = document.getElementById("active-room-name");
const activeRoomMeta = document.getElementById("active-room-meta");
const e2eeStatus = document.getElementById("e2ee-status");
const leaveRoomButton = document.getElementById("leave-room");
const deleteRoomButton = document.getElementById("delete-room");
const connectionChip = document.getElementById("connection-chip");
const roomKeyButton = document.getElementById("room-key-button");
const chatActionsToggleButton = document.getElementById("chat-actions-toggle");
const chatActionsMenu = document.getElementById("chat-actions-menu");
const chatMenuSettingsButton = document.getElementById("chat-menu-settings");

const privacyToggleWrap = document.getElementById("privacy-toggle-wrap");
const privacyToggle = document.getElementById("privacy-toggle");
const discoverToggleWrap = document.getElementById("discover-toggle-wrap");
const discoverToggle = document.getElementById("discover-toggle");

const memberList = document.getElementById("member-list");
const memberMeta = document.getElementById("member-meta");
const messageList = document.getElementById("message-list");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const sendMessageButton = document.getElementById("send-message");
const attachFilesButton = document.getElementById("attach-files");
const attachmentInput = document.getElementById("attachment-input");
const composerAttachmentList = document.getElementById("composer-attachment-list");

const displayNameForm = document.getElementById("display-name-form");
const displayNameInput = document.getElementById("display-name-input");
const developerModeToggle = document.getElementById("developer-mode-toggle");
const notificationEnabledToggle = document.getElementById("notification-enabled-toggle");
const notificationUnfocusedOnlyToggle = document.getElementById("notification-unfocused-only-toggle");
const notificationSettingsStatus = document.getElementById("notification-settings-status");
const notificationTestButton = document.getElementById("notification-test-button");
const openSettingsButton = document.getElementById("open-settings");
const deleteAccountButton = document.getElementById("delete-account");
const settingsRoomList = document.getElementById("settings-room-list");
const accountHashStatus = document.getElementById("account-hash-status");
const generateAccountHashButton = document.getElementById("generate-account-hash");
const copyAccountHashButton = document.getElementById("copy-account-hash");
const disableAccountHashButton = document.getElementById("disable-account-hash");
const accountHashDisplay = document.getElementById("account-hash-display");
const deviceSettingsForm = document.getElementById("device-settings-form");
const maxDevicesInput = document.getElementById("max-devices-input");
const saveMaxDevicesButton = document.getElementById("save-max-devices");
const deviceList = document.getElementById("device-list");
const openRoomKeySettingsButton = document.getElementById("open-room-key-settings");
const passwordLoginStatus = document.getElementById("password-login-status");
const passwordLoginEmail = document.getElementById("password-login-email");
const settingsPasswordForm = document.getElementById("settings-password-form");
const settingsCurrentPasswordInput = document.getElementById("settings-current-password-input");
const settingsPasswordInput = document.getElementById("settings-password-input");
const settingsPasswordSubmit = document.getElementById("settings-password-submit");
const disablePasswordLoginButton = document.getElementById("disable-password-login");

const createRoomForm = document.getElementById("create-room-form");
const joinRoomForm = document.getElementById("join-room-form");
const openRoomModalButton = document.getElementById("open-room-modal");
const openAppsModalButton = document.getElementById("open-apps-modal");

const roomModal = document.getElementById("room-modal");
const roomModalBackdrop = document.getElementById("room-modal-backdrop");
const roomModalCloseButton = document.getElementById("room-modal-close");
const accountHexModal = document.getElementById("account-hex-modal");
const accountHexModalBackdrop = document.getElementById("account-hex-modal-backdrop");
const accountHexModalCloseButton = document.getElementById("account-hex-modal-close");
const accountHexModalValue = document.getElementById("account-hex-modal-value");
const accountHexModalCopyButton = document.getElementById("account-hex-modal-copy");
const accountHexModalDownloadButton = document.getElementById("account-hex-modal-download");
const discoveryRoomList = document.getElementById("discovery-room-list");
const refreshDiscoveryButton = document.getElementById("refresh-discovery");
const settingsModal = document.getElementById("settings-modal");
const settingsModalBackdrop = document.getElementById("settings-modal-backdrop");
const settingsModalCloseButton = document.getElementById("settings-modal-close");
const appsModal = document.getElementById("apps-modal");
const appsModalBackdrop = document.getElementById("apps-modal-backdrop");
const appsModalCloseButton = document.getElementById("apps-modal-close");
const createBotAppForm = document.getElementById("create-bot-app-form");
const createBotAppNameInput = document.getElementById("create-bot-app-name");
const botAppList = document.getElementById("bot-app-list");

const toast = document.getElementById("toast");
const memberContextMenu = document.getElementById("member-context-menu");
const memberContextCopyIdButton = document.getElementById("member-context-copy-id");
const memberContextKickButton = document.getElementById("member-context-kick");
const memberContextTransferButton = document.getElementById("member-context-transfer");
const messageContextMenu = document.getElementById("message-context-menu");
const messageContextCopyIdButton = document.getElementById("message-context-copy-id");
const messageContextCopyTimestampButton = document.getElementById("message-context-copy-timestamp");
const messageContextEditButton = document.getElementById("message-context-edit");
const messageContextDeleteButton = document.getElementById("message-context-delete");
const roomContextMenu = document.getElementById("room-context-menu");
const roomContextToggleMuteButton = document.getElementById("room-context-toggle-mute");
const roomContextCopyIdButton = document.getElementById("room-context-copy-id");

let toastTimer = null;
let roomPollTimer = null;
let roomPollBusy = false;
let roomModalLocked = false;
let mobileDrawer = null;
let memberContextTargetUserId = null;
let messageContextTargetMessageId = null;
let messageContextTargetTimestamp = "";
let roomContextTargetRoomId = null;
let forceNextMessageStickToBottom = false;
let lastRenderedMessageKey = "";
let lastRenderedMessageRoomId = null;
let lastRenderedMessageCount = 0;
let lastRenderedLastMessageId = "";
let draggingRoomId = null;
let dragTargetRoomId = null;
let dragTargetPosition = "before";
let suppressRoomClickUntil = 0;
const messageSendQueue = [];
let messageSendBusy = false;
let messageEditBusy = false;
let chatActionsMenuOpen = false;
let composerAttachments = [];
let composerEditTarget = null;
let localTypingRoomId = null;
let localTypingLastSentAt = 0;
let generatedAccountHashValue = "";
let latestCreatedAccountHexValue = "";
let notificationPreferences = {
  enabled: false,
  onlyWhenUnfocused: true,
  mutedRoomIds: []
};

const roomKeysByRoomId = new Map();

const setAuthMode = mode => {
  const normalizedMode = String(mode || "choice").trim();
  if (authChoicePanel) {
    authChoicePanel.classList.toggle("hidden", normalizedMode !== "choice");
  }
  if (authLoginPanel) {
    authLoginPanel.classList.toggle("hidden", normalizedMode !== "login");
  }
  if (authRegisterPanel) {
    authRegisterPanel.classList.toggle("hidden", normalizedMode !== "register");
  }
};

if (authOpenLoginButton) {
  authOpenLoginButton.addEventListener("click", () => {
    setAuthMode("login");
    window.setTimeout(() => {
      accountHashLoginInput?.focus();
    }, 0);
  });
}

if (authOpenRegisterButton) {
  authOpenRegisterButton.addEventListener("click", () => {
    setAuthMode("register");
    window.setTimeout(() => {
      accountCreateUsernameInput?.focus();
    }, 0);
  });
}

if (authBackFromLoginButton) {
  authBackFromLoginButton.addEventListener("click", () => {
    setAuthMode("choice");
  });
}

if (authBackFromRegisterButton) {
  authBackFromRegisterButton.addEventListener("click", () => {
    setAuthMode("choice");
  });
}

const MAX_COMPOSER_ATTACHMENTS = 4;
const MAX_COMPOSER_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MESSAGE_TEXT_MAX_LENGTH = 8192;
const MESSAGE_FETCH_LIMIT = 80;
const MAX_MESSAGES_PER_ROOM = 2000;
const DEFAULT_MESSAGE_PLACEHOLDER = "Message the room (Enter to send, Ctrl+Enter for newline)";
const EDIT_MESSAGE_PLACEHOLDER = "Edit message (Enter to save, Esc to cancel)";
const NOTIFICATION_BODY_MAX = 180;
const TYPING_EVENT_THROTTLE_MS = 1200;
const TYPING_EVENT_TTL_MS = 3200;
const HEAD_SCRAPER_ENDPOINT = "https://head-scraper.aaravm.workers.dev/";
const LINK_PREVIEW_DESCRIPTION_MAX = 220;
const linkPreviewCache = new Map();
const E2EE_MESSAGE_PREFIX = "enc:v1:";
const E2EE_ROOM_KEY_ENVELOPE_PREFIX = "e2ee:key:v1:";
const DEVICE_E2EE_KEYPAIR_STORAGE_PREFIX = "achat_device_e2ee_keypair_";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let deviceE2EEKeyPair = null;
let deviceE2EEPublicKeyBase64 = "";
const pairwiseAesKeyCache = new Map();
const roomKeyResyncStateByRoomId = new Map();
const ROOM_KEY_RESYNC_MIN_INTERVAL_MS = 12000;

const bytesToBase64 = bytes => {
  const list = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let binary = "";
  for (const byte of list) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const base64ToBytes = value => {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const getRoomKeysStorageKey = () => `${ROOM_KEYS_STORAGE_PREFIX}${state.user?.id || "guest"}`;
const getDeviceE2EEKeyStorageKey = () => `${DEVICE_E2EE_KEYPAIR_STORAGE_PREFIX}${state.user?.id || "guest"}`;

const loadRoomKeysForUser = () => {
  roomKeysByRoomId.clear();
  if (!state.user || typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const raw = window.localStorage.getItem(getRoomKeysStorageKey()) || "{}";
    const parsed = JSON.parse(raw);
    for (const [roomId, passphrase] of Object.entries(parsed || {})) {
      const normalizedRoomId = String(roomId || "").trim();
      const normalizedPassphrase = String(passphrase || "").trim();
      if (normalizedRoomId && normalizedPassphrase) {
        roomKeysByRoomId.set(normalizedRoomId, normalizedPassphrase);
      }
    }
  } catch (error) {
    roomKeysByRoomId.clear();
  }
};

const persistRoomKeysForUser = () => {
  if (!state.user || typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const payload = {};
  for (const [roomId, passphrase] of roomKeysByRoomId.entries()) {
    payload[roomId] = passphrase;
  }
  window.localStorage.setItem(getRoomKeysStorageKey(), JSON.stringify(payload));
};

const getRoomPassphrase = roomId => {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) {
    return "";
  }

  return String(roomKeysByRoomId.get(normalizedRoomId) || "").trim();
};

const setRoomPassphrase = ({ roomId, passphrase }) => {
  const normalizedRoomId = String(roomId || "").trim();
  const normalizedPassphrase = String(passphrase || "").trim();
  if (!normalizedRoomId) {
    return;
  }

  if (!normalizedPassphrase) {
    roomKeysByRoomId.delete(normalizedRoomId);
  } else {
    roomKeysByRoomId.set(normalizedRoomId, normalizedPassphrase);
  }
  persistRoomKeysForUser();
};

const isEncryptedMessageText = value => String(value || "").startsWith(E2EE_MESSAGE_PREFIX);
const isRoomKeyEnvelopeText = value => String(value || "").startsWith(E2EE_ROOM_KEY_ENVELOPE_PREFIX);

const ensureCryptoSupport = () => {
  if (!window.crypto?.subtle) {
    throw new Error("Secure crypto is not available in this browser");
  }
};

const importAesKeyFromBase64 = async keyBase64 => {
  ensureCryptoSupport();
  const keyBytes = base64ToBytes(String(keyBase64 || ""));
  return window.crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
};

const getLocalDeviceE2EEKeyPair = async () => {
  ensureCryptoSupport();
  if (deviceE2EEKeyPair && deviceE2EEPublicKeyBase64) {
    return {
      keyPair: deviceE2EEKeyPair,
      publicKeyBase64: deviceE2EEPublicKeyBase64
    };
  }

  if (!state.user || typeof window === "undefined" || !window.localStorage) {
    throw new Error("User is not ready for E2EE key setup");
  }

  const storageKey = getDeviceE2EEKeyStorageKey();
  const storedRaw = window.localStorage.getItem(storageKey);

  let keyPair = null;
  let publicKeyBase64 = "";

  if (storedRaw) {
    try {
      const parsed = JSON.parse(storedRaw);
      const privateKeyBytes = base64ToBytes(parsed?.privateKey || "");
      const publicKeyBytes = base64ToBytes(parsed?.publicKey || "");
      if (privateKeyBytes.length > 0 && publicKeyBytes.length > 0) {
        const privateKey = await window.crypto.subtle.importKey(
          "pkcs8",
          privateKeyBytes,
          { name: "ECDH", namedCurve: "P-256" },
          true,
          ["deriveBits"]
        );
        const publicKey = await window.crypto.subtle.importKey(
          "raw",
          publicKeyBytes,
          { name: "ECDH", namedCurve: "P-256" },
          true,
          []
        );

        keyPair = { privateKey, publicKey };
        publicKeyBase64 = String(parsed.publicKey || "");
      }
    } catch (error) {
      keyPair = null;
      publicKeyBase64 = "";
    }
  }

  if (!keyPair || !publicKeyBase64) {
    keyPair = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );
    const exportedPrivateKey = new Uint8Array(await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
    const exportedPublicKey = new Uint8Array(await window.crypto.subtle.exportKey("raw", keyPair.publicKey));
    publicKeyBase64 = bytesToBase64(exportedPublicKey);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        privateKey: bytesToBase64(exportedPrivateKey),
        publicKey: publicKeyBase64
      })
    );
  }

  deviceE2EEKeyPair = keyPair;
  deviceE2EEPublicKeyBase64 = publicKeyBase64;

  return {
    keyPair,
    publicKeyBase64
  };
};

const ensureE2EEIdentityRegistration = async () => {
  if (!state.user || state.user.isBot) {
    return;
  }

  const { publicKeyBase64 } = await getLocalDeviceE2EEKeyPair();
  if (state.user.hasE2EEPublicKey && publicKeyBase64) {
    return;
  }

  const data = await request("/api/me/e2ee/public-key", {
    method: "PUT",
    body: JSON.stringify({ publicKey: publicKeyBase64 })
  });

  if (data?.user) {
    state.user = data.user;
  }
};

const derivePairwiseAesKey = async ({ remotePublicKeyBase64 }) => {
  const normalizedRemotePublicKeyBase64 = String(remotePublicKeyBase64 || "").trim();
  if (!normalizedRemotePublicKeyBase64) {
    throw new Error("Missing recipient public key");
  }

  const cacheKey = `${String(state.user?.id || "guest")}:${normalizedRemotePublicKeyBase64}`;
  const cachedPairwiseKey = pairwiseAesKeyCache.get(cacheKey);
  if (cachedPairwiseKey) {
    return cachedPairwiseKey;
  }

  const { keyPair } = await getLocalDeviceE2EEKeyPair();
  const remotePublicKey = await window.crypto.subtle.importKey(
    "raw",
    base64ToBytes(normalizedRemotePublicKeyBase64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const sharedBits = await window.crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: remotePublicKey
    },
    keyPair.privateKey,
    256
  );

  const pairwiseKey = await window.crypto.subtle.importKey("raw", sharedBits, "AES-GCM", false, ["encrypt", "decrypt"]);
  pairwiseAesKeyCache.set(cacheKey, pairwiseKey);
  return pairwiseKey;
};

const encryptRoomMessageText = async ({ plaintext, roomKeyBase64 }) => {
  const key = await importAesKeyFromBase64(roomKeyBase64);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    textEncoder.encode(String(plaintext || ""))
  );

  return `${E2EE_MESSAGE_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertextBuffer))}`;
};

const decryptRoomMessageText = async ({ ciphertext, roomKeyBase64 }) => {
  const raw = String(ciphertext || "");
  if (!isEncryptedMessageText(raw)) {
    return raw;
  }

  const encoded = raw.slice(E2EE_MESSAGE_PREFIX.length);
  const separator = encoded.indexOf(":");
  if (separator <= 0) {
    throw new Error("Invalid encrypted payload");
  }

  const iv = base64ToBytes(encoded.slice(0, separator));
  const cipherBytes = base64ToBytes(encoded.slice(separator + 1));
  const key = await importAesKeyFromBase64(roomKeyBase64);
  const plainBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    cipherBytes
  );

  return textDecoder.decode(plainBuffer);
};

const buildRoomKeyEnvelopePayload = async ({ roomId, roomKeyBase64, recipientUserId, recipientPublicKey }) => {
  const pairwiseKey = await derivePairwiseAesKey({ remotePublicKeyBase64: recipientPublicKey });
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    pairwiseKey,
    textEncoder.encode(String(roomKeyBase64 || ""))
  );

  const payload = {
    v: 1,
    t: String(recipientUserId || ""),
    f: String(state.user?.id || ""),
    p: String(deviceE2EEPublicKeyBase64 || ""),
    i: bytesToBase64(iv),
    c: bytesToBase64(new Uint8Array(ciphertext))
  };

  return `${E2EE_ROOM_KEY_ENVELOPE_PREFIX}${JSON.stringify(payload)}`;
};

const retryDecryptCachedMessagesForRoom = async roomId => {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) {
    return;
  }

  const roomKeyBase64 = getRoomPassphrase(normalizedRoomId);
  if (!roomKeyBase64) {
    return;
  }

  const cachedMessages = state.messagesByRoom.get(normalizedRoomId) || [];
  if (cachedMessages.length === 0) {
    return;
  }

  let changed = false;
  for (const entry of cachedMessages) {
    const deferredCiphertext = String(entry?.encryptedRawText || "").trim();
    const ciphertext = deferredCiphertext || (isEncryptedMessageText(entry?.text) ? String(entry.text || "") : "");
    if (!ciphertext || !isEncryptedMessageText(ciphertext)) {
      continue;
    }

    try {
      const plaintext = await decryptRoomMessageText({
        ciphertext,
        roomKeyBase64
      });
      if (entry.text !== plaintext) {
        entry.text = plaintext;
        changed = true;
      }
      if (entry.encryptedRawText) {
        delete entry.encryptedRawText;
        changed = true;
      }
    } catch (error) {
      // Keep placeholder until a valid key for this ciphertext is available.
    }
  }

  if (!changed) {
    return;
  }

  refreshRoomPreviewFromCachedMessages(normalizedRoomId);
  if (normalizedRoomId === String(state.activeRoomId || "")) {
    renderMessages();
  }
};

const tryConsumeRoomKeyEnvelope = async ({ roomId, rawText }) => {
  if (!isRoomKeyEnvelopeText(rawText)) {
    return false;
  }

  const payloadRaw = String(rawText).slice(E2EE_ROOM_KEY_ENVELOPE_PREFIX.length);
  let payload = null;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (error) {
    return true;
  }

  if (String(payload?.t || "") !== String(state.user?.id || "")) {
    return true;
  }

  const senderPublicKey = String(payload?.p || "").trim();
  const ivBase64 = String(payload?.i || "").trim();
  const cipherBase64 = String(payload?.c || "").trim();
  if (!senderPublicKey || !ivBase64 || !cipherBase64) {
    return true;
  }

  try {
    const pairwiseKey = await derivePairwiseAesKey({ remotePublicKeyBase64: senderPublicKey });
    const plaintext = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(ivBase64)
      },
      pairwiseKey,
      base64ToBytes(cipherBase64)
    );

    const roomKeyBase64 = textDecoder.decode(plaintext);
    if (roomKeyBase64) {
      setRoomPassphrase({ roomId, passphrase: roomKeyBase64 });
      await retryDecryptCachedMessagesForRoom(roomId);
    }
  } catch (error) {
    // Ignore malformed or undecryptable key envelopes.
  }

  return true;
};

const prepareMessageForDisplay = async message => {
  const next = { ...(message || {}) };
  const roomId = String(next.roomId || "").trim();
  const rawText = String(next.text || "");
  if (!roomId) {
    return next;
  }

  if (isRoomKeyEnvelopeText(rawText)) {
    await tryConsumeRoomKeyEnvelope({ roomId, rawText });
    return null;
  }

  if (!isEncryptedMessageText(rawText)) {
    return next;
  }

  const roomKeyBase64 = getRoomPassphrase(roomId);
  if (!roomKeyBase64) {
    next.text = "[Secure message loading...]";
    next.encryptedRawText = rawText;
    return next;
  }

  try {
    next.text = await decryptRoomMessageText({
      ciphertext: rawText,
      roomKeyBase64
    });
  } catch (error) {
    next.text = "[Secure message unavailable on this device]";
    next.encryptedRawText = rawText;
  }

  return next;
};

const prepareMessagesForDisplay = async messages => {
  const list = Array.isArray(messages) ? messages : [];
  const result = [];
  for (const entry of list) {
    const prepared = await prepareMessageForDisplay(entry);
    if (prepared) {
      result.push(prepared);
    }
  }

  // If key envelopes arrived in the same batch, retry decrypting deferred ciphertext rows.
  for (const entry of result) {
    const roomId = String(entry?.roomId || "").trim();
    const deferredCiphertext = String(entry?.encryptedRawText || "").trim();
    if (!roomId || !deferredCiphertext || !isEncryptedMessageText(deferredCiphertext)) {
      continue;
    }

    const roomKeyBase64 = getRoomPassphrase(roomId);
    if (!roomKeyBase64) {
      continue;
    }

    try {
      entry.text = await decryptRoomMessageText({
        ciphertext: deferredCiphertext,
        roomKeyBase64
      });
      delete entry.encryptedRawText;
    } catch (error) {
      // Keep user-facing unavailable placeholder if deferred decrypt still fails.
    }
  }

  return result;
};

const prepareRoomsForDisplay = async rooms => {
  const list = Array.isArray(rooms) ? rooms : [];
  return Promise.all(
    list.map(async room => {
      const next = { ...(room || {}) };
      if (next.latestMessage) {
        next.latestMessage = await prepareMessageForDisplay({
          ...next.latestMessage,
          roomId: String(next.latestMessage?.roomId || next.id || "")
        });
      }
      return next;
    })
  );
};

const formatTime = isoDate => {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

const escapeHtml = value =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
const TRAILING_PUNCTUATION_REGEX = /[),.!?;:]+$/;
const IMAGE_EMBED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"]);
const VIDEO_EMBED_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv"]);
const AUDIO_EMBED_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "flac"]);
const TEXT_FRAME_EXTENSIONS = new Set(["txt", "md", "json", "js", "ts", "css", "html", "log", "git"]);
const CATBOX_FILE_HOSTNAMES = new Set(["files.catbox.moe", "litter.catbox.moe", "catbox.moe"]);

const splitUrlAndTrailing = rawUrl => {
  let url = String(rawUrl || "");
  let trailing = "";
  while (TRAILING_PUNCTUATION_REGEX.test(url)) {
    trailing = `${url.slice(-1)}${trailing}`;
    url = url.slice(0, -1);
  }
  return { url, trailing };
};

const normalizeUrlCandidate = candidate => {
  const { url } = splitUrlAndTrailing(candidate);
  if (!url) {
    return "";
  }
  return url.startsWith("www.") ? `https://${url}` : url;
};

const getUrlExtension = urlValue => {
  try {
    const pathname = new URL(urlValue).pathname || "";
    const filename = pathname.split("/").pop() || "";
    const ext = filename.includes(".") ? filename.split(".").pop() : "";
    return String(ext || "").toLowerCase();
  } catch (error) {
    return "";
  }
};

const extractUrlsFromText = value => {
  const raw = String(value || "");
  const matches = raw.match(URL_REGEX) || [];
  const seen = new Set();
  const urls = [];

  for (const token of matches) {
    const normalized = normalizeUrlCandidate(token);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    urls.push(normalized);
  }

  return urls;
};

const linkifyMessageText = value => {
  const escaped = escapeHtml(value);
  return escaped.replace(URL_REGEX, rawUrl => {
    const { url, trailing } = splitUrlAndTrailing(rawUrl);
    if (!url) {
      return rawUrl;
    }

    const href = normalizeUrlCandidate(url);
    const safeHref = escapeHtml(href);
    const safeLabel = escapeHtml(url);
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer nofollow">${safeLabel}</a>${escapeHtml(trailing)}`;
  });
};

const truncateText = (value, maxLength = LINK_PREVIEW_DESCRIPTION_MAX) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const getUrlHostname = urlValue => {
  try {
    const parsed = new URL(urlValue);
    return parsed.hostname.replace(/^www\./i, "") || parsed.hostname;
  } catch (error) {
    return String(urlValue || "");
  }
};

const toAbsoluteUrl = (value, baseUrl) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const normalizedRaw = raw.startsWith("//") ? `https:${raw}` : raw;
  try {
    return new URL(normalizedRaw, baseUrl).toString();
  } catch (error) {
    return "";
  }
};

const isUrlHostedOn = (urlValue, hostnames) => {
  const hostname = getUrlHostname(urlValue).toLowerCase();
  return hostnames.has(hostname);
};

const parseStandaloneUrlLine = line => {
  const trimmed = String(line || "").trim();
  if (!trimmed) {
    return "";
  }

  const matches = trimmed.match(URL_REGEX) || [];
  if (matches.length !== 1 || matches[0] !== trimmed) {
    return "";
  }

  const normalized = normalizeUrlCandidate(trimmed);
  return normalized || "";
};

const partitionMessageText = value => {
  const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  const bodyLines = [];
  const attachmentUrls = [];
  const seenAttachmentUrls = new Set();

  for (const line of lines) {
    const maybeUrl = parseStandaloneUrlLine(line);
    if (maybeUrl && isUrlHostedOn(maybeUrl, CATBOX_FILE_HOSTNAMES)) {
      if (!seenAttachmentUrls.has(maybeUrl)) {
        seenAttachmentUrls.add(maybeUrl);
        attachmentUrls.push(maybeUrl);
      }
      continue;
    }

    bodyLines.push(line);
  }

  const bodyText = bodyLines.join("\n").trim();
  const embedUrls = [];
  const seenEmbedUrls = new Set();
  const pushEmbedUrl = url => {
    const normalized = String(url || "").trim();
    if (!normalized || seenEmbedUrls.has(normalized)) {
      return;
    }

    seenEmbedUrls.add(normalized);
    embedUrls.push(normalized);
  };

  for (const url of extractUrlsFromText(bodyText)) {
    pushEmbedUrl(url);
  }

  for (const url of attachmentUrls) {
    pushEmbedUrl(url);
  }

  return {
    bodyText,
    embedUrls
  };
};

const toObject = value => (value && typeof value === "object" ? value : {});

const pluckPath = (source, path) => {
  const keys = String(path || "").split(".");
  let current = source;
  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[key];
  }
  return current;
};

const normalizeStringValue = value => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeStringValue(entry);
      if (normalized) {
        return normalized;
      }
    }
    return "";
  }

  if (value && typeof value === "object") {
    const objectCandidate = value;
    const directKeys = ["content", "text", "value", "url", "secure_url", "href"];
    for (const key of directKeys) {
      const normalized = normalizeStringValue(objectCandidate[key]);
      if (normalized) {
        return normalized;
      }
    }
  }

  return "";
};

const readPreviewString = (roots, paths) => {
  for (const root of roots) {
    for (const path of paths) {
      const normalized = normalizeStringValue(pluckPath(root, path));
      if (normalized) {
        return normalized;
      }
    }
  }
  return "";
};

const readMetaString = (metaRoots, keys) => {
  for (const metaRoot of metaRoots) {
    const entries = Object.entries(metaRoot);
    for (const key of keys) {
      const normalizedKey = String(key || "").toLowerCase();
      for (const [metaKey, metaValue] of entries) {
        if (String(metaKey || "").toLowerCase() !== normalizedKey) {
          continue;
        }
        const normalized = normalizeStringValue(metaValue);
        if (normalized) {
          return normalized;
        }
      }
    }
  }
  return "";
};

const normalizeWebsitePreview = (payload, sourceUrl) => {
  const root = toObject(payload);
  const roots = [root, toObject(root.data), toObject(root.result)];
  const metaRoots = roots.map(entry => toObject(entry.meta));
  const fallbackHost = getUrlHostname(sourceUrl);

  const title =
    readPreviewString(roots, ["summary.title", "title", "og.title", "twitter.title"]) ||
    readMetaString(metaRoots, ["og:title", "twitter:title", "title"]) ||
    fallbackHost;
  const description =
    readPreviewString(roots, ["summary.description", "description", "og.description", "twitter.description"]) ||
    readMetaString(metaRoots, ["description", "og:description", "twitter:description"]);
  const siteName =
    readPreviewString(roots, ["og.site_name", "twitter.site", "site_name"]) ||
    readMetaString(metaRoots, ["og:site_name", "twitter:site"]) ||
    fallbackHost;
  const imageRaw =
    readPreviewString(roots, ["og.image", "twitter.image", "image"]) ||
    readMetaString(metaRoots, ["og:image", "twitter:image", "twitter:image:src"]);
  const faviconRaw =
    readPreviewString(roots, ["favicon", "favicon.url"]) ||
    readMetaString(metaRoots, ["icon", "shortcut icon", "apple-touch-icon"]);

  return {
    title: truncateText(title, 140),
    description: truncateText(description, LINK_PREVIEW_DESCRIPTION_MAX),
    siteName: truncateText(siteName, 80),
    imageUrl: toAbsoluteUrl(imageRaw, sourceUrl),
    faviconUrl: toAbsoluteUrl(faviconRaw, sourceUrl)
  };
};

const renderWebsiteEmbedCard = url => {
  const cached = linkPreviewCache.get(url);
  const safeUrl = escapeHtml(url);
  const hostRaw = getUrlHostname(url);
  const host = escapeHtml(hostRaw);

  if (!cached || cached.status === "loading") {
    return `
      <a class="message-embed message-embed--website is-loading" href="${safeUrl}" target="_blank" rel="noopener noreferrer nofollow" data-link-preview-url="${safeUrl}">
        <span class="message-embed__site">${host}</span>
        <strong class="message-embed__title">Loading preview…</strong>
        <p class="message-embed__description">${safeUrl}</p>
      </a>
    `;
  }

  if (cached.status !== "ready" || !cached.data) {
    return `
      <a class="message-embed message-embed--website is-fallback" href="${safeUrl}" target="_blank" rel="noopener noreferrer nofollow" data-link-preview-url="${safeUrl}">
        <span class="message-embed__site">${host}</span>
        <strong class="message-embed__title">${host}</strong>
        <p class="message-embed__description">${safeUrl}</p>
      </a>
    `;
  }

  const preview = cached.data;
  const safeSite = escapeHtml(preview.siteName || hostRaw);
  const safeTitle = escapeHtml(preview.title || hostRaw);
  const safeDescription = escapeHtml(preview.description || "");
  const safeFavicon = escapeHtml(preview.faviconUrl || "");
  const safeImage = escapeHtml(preview.imageUrl || "");

  return `
    <a class="message-embed message-embed--website" href="${safeUrl}" target="_blank" rel="noopener noreferrer nofollow" data-link-preview-url="${safeUrl}">
      <span class="message-embed__site-row">
        ${safeFavicon ? `<img class="message-embed__favicon" src="${safeFavicon}" alt="" loading="lazy" />` : ""}
        <span class="message-embed__site">${safeSite}</span>
      </span>
      <strong class="message-embed__title">${safeTitle}</strong>
      ${safeDescription ? `<p class="message-embed__description">${safeDescription}</p>` : ""}
      ${safeImage ? `<img class="message-embed__image" src="${safeImage}" alt="" loading="lazy" />` : ""}
    </a>
  `;
};

const updateRenderedWebsiteEmbeds = url => {
  if (!messageList) {
    return;
  }

  const websiteEmbeds = messageList.querySelectorAll(".message-embed--website[data-link-preview-url]");
  for (const element of websiteEmbeds) {
    const elementUrl = String(element.getAttribute("data-link-preview-url") || "").trim();
    if (elementUrl !== url) {
      continue;
    }

    element.outerHTML = renderWebsiteEmbedCard(url);
  }
};

const fetchWebsitePreview = async url => {
  try {
    const endpoint = new URL(HEAD_SCRAPER_ENDPOINT);
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("json", "true");
    endpoint.searchParams.set("summary", "true");
    endpoint.searchParams.set("meta", "true");
    endpoint.searchParams.set("og", "true");
    endpoint.searchParams.set("twitter", "true");
    endpoint.searchParams.set("links", "true");
    endpoint.searchParams.set("favicon", "true");

    const response = await fetch(endpoint.toString(), { method: "GET" });
    if (!response.ok) {
      throw new Error(`Preview request failed (${response.status})`);
    }

    const payload = await response.json();
    linkPreviewCache.set(url, {
      status: "ready",
      data: normalizeWebsitePreview(payload, url)
    });
  } catch (error) {
    linkPreviewCache.set(url, { status: "error" });
  } finally {
    updateRenderedWebsiteEmbeds(url);
  }
};

const queueWebsitePreviewFetch = url => {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    return;
  }

  const cached = linkPreviewCache.get(normalizedUrl);
  if (cached?.status === "loading" || cached?.status === "ready" || cached?.status === "error") {
    return;
  }

  linkPreviewCache.set(normalizedUrl, { status: "loading" });
  void fetchWebsitePreview(normalizedUrl);
};

const renderMessageEmbeds = urls => {
  const urlList = Array.isArray(urls) ? urls : [];
  if (urlList.length === 0) {
    return "";
  }

  const uniqueUrls = [];
  const seenUrls = new Set();
  for (const url of urlList) {
    const normalizedUrl = String(url || "").trim();
    if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
      continue;
    }

    seenUrls.add(normalizedUrl);
    uniqueUrls.push(normalizedUrl);
  }

  const urlsToRender = uniqueUrls;
  if (urlsToRender.length === 0) {
    return "";
  }

  const embeds = urlsToRender
    .map(url => {
      const extension = getUrlExtension(url);
      const safeUrl = escapeHtml(url);
      const label = escapeHtml(url.split("/").pop() || url);
      const hostedOnCatbox = isUrlHostedOn(url, CATBOX_FILE_HOSTNAMES);

      if (IMAGE_EMBED_EXTENSIONS.has(extension)) {
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer nofollow"><img class="message-embed message-embed--image" src="${safeUrl}" alt="${label}" loading="lazy" /></a>`;
      }

      if (VIDEO_EMBED_EXTENSIONS.has(extension)) {
        return `<video class="message-embed message-embed--video" controls preload="metadata" src="${safeUrl}"></video>`;
      }

      if (AUDIO_EMBED_EXTENSIONS.has(extension)) {
        return `<audio class="message-embed message-embed--audio" controls preload="metadata" src="${safeUrl}"></audio>`;
      }

      if (TEXT_FRAME_EXTENSIONS.has(extension)) {
        return `<iframe class="message-embed message-embed--frame" src="${safeUrl}" loading="lazy" sandbox=""></iframe>`;
      }

      if (!extension && !hostedOnCatbox) {
        queueWebsitePreviewFetch(url);
        return renderWebsiteEmbedCard(url);
      }

      return `<a class="message-embed message-embed--file" href="${safeUrl}" target="_blank" rel="noopener noreferrer nofollow">Download ${label}</a>`;
    })
    .join("");

  return embeds ? `<div class="message-embeds">${embeds}</div>` : "";
};

const toHumanSize = bytes => {
  const value = Number(bytes) || 0;
  if (value < 1024) {
    return `${value} B`;
  }
  const kb = value / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
};

const normalizeMessageText = value => String(value || "").replace(/\r\n/g, "\n").slice(0, MESSAGE_TEXT_MAX_LENGTH).trim();
const canDeleteMessage = message => {
  const room = getActiveRoom();
  if (!room || !state.user || !message) {
    return false;
  }

  const isMessageAuthor = String(message.userId) === String(state.user.id);
  const isRoomOwner = String(room.ownerUserId || "") === String(state.user.id);
  return isMessageAuthor || isRoomOwner;
};

const canEditMessage = message => {
  if (!state.user || !message || message.optimistic) {
    return false;
  }

  return String(message.userId) === String(state.user.id);
};

const isComposerEditingMessage = message => {
  if (!message || !composerEditTarget) {
    return false;
  }

  return (
    String(message.roomId || "") === String(composerEditTarget.roomId || "") &&
    String(message.id || "") === String(composerEditTarget.messageId || "")
  );
};

const renderMessageTile = message => {
  const isSelf = message.userId === state.user?.id;
  const isOptimistic = Boolean(message.optimistic);
  const isBot = Boolean(message.userIsBot);
  const isEditing = isComposerEditingMessage(message);
  const isEdited = Boolean(String(message?.editedAt || "").trim());
  const { bodyText, embedUrls } = partitionMessageText(message.text);
  const embeds = renderMessageEmbeds(embedUrls);
  const messageId = escapeHtml(String(message.id || ""));
  return `
    <article class="message ${isSelf ? "self" : ""} ${isOptimistic ? "sending" : ""} ${isEditing ? "editing" : ""}" data-message-id="${messageId}">
      <header>
        <span class="author">${escapeHtml(message.username)}${isBot ? ' <span class="bot-tag bot-tag--inline">BOT</span>' : ""}</span>
        <span class="message-meta">
          <time>${formatTime(message.createdAt)}</time>
          ${isEdited ? '<span class="message-edited-state">(edited)</span>' : ""}
          ${isOptimistic ? '<span class="message-send-state">Sending...</span>' : ""}
        </span>
      </header>
      ${bodyText ? `<p>${linkifyMessageText(bodyText)}</p>` : ""}
      ${embeds}
    </article>
  `;
};

const syncMessageInputHeight = () => {
  if (!messageInput) {
    return;
  }

  messageInput.style.height = "auto";
  const maxHeight = 180;
  const nextHeight = Math.min(maxHeight, Math.max(42, messageInput.scrollHeight));
  messageInput.style.height = `${nextHeight}px`;
};

const insertNewlineAtCursor = input => {
  const start = Number(input.selectionStart || 0);
  const end = Number(input.selectionEnd || 0);
  const value = String(input.value || "");
  const next = `${value.slice(0, start)}\n${value.slice(end)}`;
  input.value = next.slice(0, MESSAGE_TEXT_MAX_LENGTH);
  const cursor = Math.min(start + 1, input.value.length);
  input.selectionStart = cursor;
  input.selectionEnd = cursor;
  syncMessageInputHeight();
  syncLocalTypingFromInput();
  updateComposerPlaceholder();
};

const renderComposerAttachments = () => {
  if (!composerAttachmentList) {
    return;
  }

  if (!Array.isArray(composerAttachments) || composerAttachments.length === 0) {
    composerAttachmentList.classList.add("hidden");
    composerAttachmentList.innerHTML = "";
    return;
  }

  composerAttachmentList.classList.remove("hidden");
  composerAttachmentList.innerHTML = composerAttachments
    .map(
      (file, index) => `
        <span class="composer-attachment-chip">
          <span>${escapeHtml(file.name)} (${toHumanSize(file.size)})</span>
          <button type="button" data-remove-attachment="${index}" aria-label="Remove attachment">×</button>
        </span>
      `
    )
    .join("");
};

const clearComposerAttachments = () => {
  composerAttachments = [];
  if (attachmentInput) {
    attachmentInput.value = "";
  }
  renderComposerAttachments();
};

const addComposerFiles = files => {
  const nextFiles = Array.from(files || []);
  if (nextFiles.length === 0) {
    return;
  }

  for (const file of nextFiles) {
    if (!(file instanceof File)) {
      continue;
    }

    if (composerAttachments.length >= MAX_COMPOSER_ATTACHMENTS) {
      notify(`Max ${MAX_COMPOSER_ATTACHMENTS} attachments per message`);
      break;
    }

    if (file.size > MAX_COMPOSER_ATTACHMENT_BYTES) {
      notify(`${file.name} is too large. Max ${toHumanSize(MAX_COMPOSER_ATTACHMENT_BYTES)}.`);
      continue;
    }

    const duplicate = composerAttachments.some(
      item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified
    );
    if (duplicate) {
      continue;
    }

    composerAttachments.push(file);
  }

  renderComposerAttachments();
};

const fileToBase64 = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const commaIndex = value.indexOf(",");
      resolve(commaIndex >= 0 ? value.slice(commaIndex + 1) : value);
    };
    reader.onerror = () => reject(new Error(`Unable to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });

const uploadComposerFiles = async files => {
  const normalizedFiles = Array.isArray(files) ? files : [];
  if (normalizedFiles.length === 0) {
    return [];
  }

  const payloadFiles = await Promise.all(
    normalizedFiles.map(async file => ({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      dataBase64: await fileToBase64(file)
    }))
  );

  const result = await request("/api/uploads/catbox", {
    method: "POST",
    body: JSON.stringify({ files: payloadFiles })
  });

  return Array.isArray(result.files) ? result.files : [];
};

const addMessageToState = message => {
  if (!message?.roomId || !message?.id) {
    return false;
  }

  const roomId = String(message.roomId);
  const existing = state.messagesByRoom.get(roomId) || [];
  if (existing.some(entry => String(entry.id) === String(message.id))) {
    return false;
  }

  existing.push(message);
  state.messagesByRoom.set(roomId, existing.slice(-MAX_MESSAGES_PER_ROOM));
  return true;
};

const removeMessageFromState = ({ roomId, messageId }) => {
  const normalizedRoomId = String(roomId || "");
  const normalizedMessageId = String(messageId || "");
  if (!normalizedRoomId || !normalizedMessageId) {
    return false;
  }

  const existing = state.messagesByRoom.get(normalizedRoomId) || [];
  if (existing.length === 0) {
    return false;
  }

  const nextMessages = existing.filter(entry => String(entry.id) !== normalizedMessageId);
  if (nextMessages.length === existing.length) {
    return false;
  }

  state.messagesByRoom.set(normalizedRoomId, nextMessages);
  return true;
};

const replaceMessageInState = ({ roomId, targetMessageId, nextMessage }) => {
  const normalizedRoomId = String(roomId || "");
  const normalizedTargetId = String(targetMessageId || "");
  if (!normalizedRoomId || !normalizedTargetId || !nextMessage?.id) {
    return false;
  }

  const existing = state.messagesByRoom.get(normalizedRoomId) || [];
  const index = existing.findIndex(entry => String(entry.id) === normalizedTargetId);
  if (index < 0) {
    return false;
  }

  const normalizedNextId = String(nextMessage.id);
  const duplicateIndex = existing.findIndex((entry, entryIndex) => {
    return entryIndex !== index && String(entry.id) === normalizedNextId;
  });

  const nextEntries = [...existing];
  if (duplicateIndex >= 0) {
    nextEntries.splice(index, 1);
  } else {
    nextEntries[index] = nextMessage;
  }

  state.messagesByRoom.set(normalizedRoomId, nextEntries.slice(-MAX_MESSAGES_PER_ROOM));
  return true;
};

const prependOlderMessagesToState = ({ roomId, messages }) => {
  const normalizedRoomId = String(roomId || "");
  const olderMessages = Array.isArray(messages) ? messages : [];
  if (!normalizedRoomId || olderMessages.length === 0) {
    return false;
  }

  const existing = state.messagesByRoom.get(normalizedRoomId) || [];
  const existingIds = new Set(existing.map(entry => String(entry.id)));
  const filteredOlder = olderMessages.filter(entry => {
    const id = String(entry?.id || "");
    return id && !existingIds.has(id);
  });

  if (filteredOlder.length === 0) {
    return false;
  }

  const merged = [...filteredOlder, ...existing];
  state.messagesByRoom.set(normalizedRoomId, merged.slice(-MAX_MESSAGES_PER_ROOM));
  return true;
};

const reconcileOwnOptimisticMessage = confirmedMessage => {
  const roomId = String(confirmedMessage?.roomId || "").trim();
  if (!roomId || !confirmedMessage?.id || String(confirmedMessage.userId || "") !== String(state.user?.id || "")) {
    return "";
  }

  const roomMessages = state.messagesByRoom.get(roomId) || [];
  const optimisticMessage = roomMessages.find(
    entry => entry?.optimistic && String(entry.userId || "") === String(state.user?.id || "") && entry.text === confirmedMessage.text
  );

  if (!optimisticMessage) {
    return "";
  }

  const replaced = replaceMessageInState({
    roomId,
    targetMessageId: optimisticMessage.id,
    nextMessage: confirmedMessage
  });
  return replaced ? String(optimisticMessage.id || "") : "";
};

const isMobileLayout = () => window.matchMedia("(max-width: 860px)").matches;

const syncMobileDrawerUi = () => {
  const mobile = isMobileLayout();
  const roomsOpen = mobileDrawer === "rooms" && mobile;
  const membersOpen = mobileDrawer === "members" && mobile;

  appView.classList.toggle("mobile-rooms-open", roomsOpen);
  appView.classList.toggle("mobile-members-open", membersOpen);
  roomPanel.setAttribute("aria-hidden", String(mobile ? !roomsOpen : false));
  memberPanel.setAttribute("aria-hidden", String(mobile ? !membersOpen : false));
  mobileDrawerBackdrop.classList.toggle("hidden", !roomsOpen && !membersOpen);
  mobileRoomsToggleButton.classList.toggle("active", roomsOpen);
  mobileMembersToggleButton.classList.toggle("active", membersOpen);
};

const closeMobileDrawer = () => {
  mobileDrawer = null;
  syncMobileDrawerUi();
};

const openMobileDrawer = type => {
  if (!isMobileLayout()) {
    return;
  }

  mobileDrawer = mobileDrawer === type ? null : type;
  syncMobileDrawerUi();
};

const notify = message => {
  if (!message) {
    return;
  }

  toast.textContent = message;
  toast.classList.remove("hidden");

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 3200);
};

const hideMemberContextMenu = () => {
  memberContextTargetUserId = null;
  memberContextMenu.classList.add("hidden");
  memberContextMenu.setAttribute("aria-hidden", "true");
};

const hideMessageContextMenu = () => {
  messageContextTargetMessageId = null;
  messageContextTargetTimestamp = "";
  messageContextMenu.classList.add("hidden");
  messageContextMenu.setAttribute("aria-hidden", "true");
};

const hideRoomContextMenu = () => {
  roomContextTargetRoomId = null;
  roomContextMenu.classList.add("hidden");
  roomContextMenu.setAttribute("aria-hidden", "true");
};

const positionContextMenu = ({ menu, x, y }) => {
  menu.style.left = "0px";
  menu.style.top = "0px";

  const rect = menu.getBoundingClientRect();
  const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
  const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
  const nextLeft = Math.min(Math.max(8, x), maxLeft);
  const nextTop = Math.min(Math.max(8, y), maxTop);

  menu.style.left = `${nextLeft}px`;
  menu.style.top = `${nextTop}px`;
};

const showMemberContextMenu = ({ x, y, userId }) => {
  memberContextTargetUserId = String(userId || "");
  if (!memberContextTargetUserId) {
    hideMemberContextMenu();
    return;
  }

  memberContextMenu.classList.remove("hidden");
  memberContextMenu.setAttribute("aria-hidden", "false");
  positionContextMenu({ menu: memberContextMenu, x, y });
};

const showMessageContextMenu = ({ x, y, messageId }) => {
  messageContextTargetMessageId = String(messageId || "");
  if (!messageContextTargetMessageId) {
    hideMessageContextMenu();
    return;
  }

  messageContextMenu.classList.remove("hidden");
  messageContextMenu.setAttribute("aria-hidden", "false");
  positionContextMenu({ menu: messageContextMenu, x, y });
};

const showRoomContextMenu = ({ x, y, roomId }) => {
  roomContextTargetRoomId = String(roomId || "");
  if (!roomContextTargetRoomId) {
    hideRoomContextMenu();
    return;
  }

  roomContextMenu.classList.remove("hidden");
  roomContextMenu.setAttribute("aria-hidden", "false");
  positionContextMenu({ menu: roomContextMenu, x, y });
};

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
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
    const errorMessage = data.error || `Request failed (${response.status})`;
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  return data;
};

const getRoomOrderCookieName = () => `${ROOM_ORDER_COOKIE_PREFIX}${state.user?.id || "guest"}`;

const readCookie = name => {
  const target = `${name}=`;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    if (part.startsWith(target)) {
      return decodeURIComponent(part.slice(target.length));
    }
  }

  return "";
};

const writeCookie = ({ name, value, maxAgeSeconds = ROOM_ORDER_COOKIE_TTL_SECONDS }) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
};

const getStoredRoomOrder = () =>
  readCookie(getRoomOrderCookieName())
    .split(".")
    .map(item => String(item || "").trim())
    .filter(Boolean);

const setStoredRoomOrder = roomIds => {
  if (!state.user) {
    return;
  }

  const seen = new Set();
  const normalized = roomIds
    .map(roomId => String(roomId || "").trim())
    .filter(roomId => {
      if (!roomId || seen.has(roomId)) {
        return false;
      }

      seen.add(roomId);
      return true;
    });

  if (normalized.length === 0) {
    return;
  }

  writeCookie({
    name: getRoomOrderCookieName(),
    value: normalized.join(".")
  });
};

const applyStoredRoomOrder = rooms => {
  if (!Array.isArray(rooms) || rooms.length === 0 || !state.user) {
    return Array.isArray(rooms) ? rooms : [];
  }

  const roomIds = rooms.map(room => String(room.id));
  const validIds = new Set(roomIds);
  const storedOrder = getStoredRoomOrder().filter(roomId => validIds.has(roomId));
  const seen = new Set(storedOrder);
  const mergedOrder = [...storedOrder];

  for (const roomId of roomIds) {
    if (seen.has(roomId)) {
      continue;
    }

    seen.add(roomId);
    mergedOrder.push(roomId);
  }

  const orderIndex = new Map(mergedOrder.map((roomId, index) => [roomId, index]));
  const sortedRooms = [...rooms].sort((left, right) => orderIndex.get(String(left.id)) - orderIndex.get(String(right.id)));

  const needsPersist =
    mergedOrder.length !== storedOrder.length || mergedOrder.some((roomId, index) => roomId !== storedOrder[index]);
  if (needsPersist) {
    setStoredRoomOrder(mergedOrder);
  }

  return sortedRooms;
};

const getNotificationPrefsStorageKey = () => `${NOTIFICATION_PREFS_STORAGE_PREFIX}${state.user?.id || "guest"}`;

const normalizeNotificationPreferences = value => {
  const mutedRoomIds = Array.isArray(value?.mutedRoomIds)
    ? [...new Set(value.mutedRoomIds.map(roomId => String(roomId || "").trim()).filter(Boolean))]
    : [];

  return {
    enabled: Boolean(value?.enabled),
    onlyWhenUnfocused: value?.onlyWhenUnfocused !== false,
    mutedRoomIds
  };
};

const getMutedNotificationRoomIdsSet = () => new Set(notificationPreferences.mutedRoomIds || []);

const isRoomMutedForNotifications = roomId => {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) {
    return false;
  }

  return getMutedNotificationRoomIdsSet().has(normalizedRoomId);
};

const setRoomNotificationMuted = (roomId, muted) => {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) {
    return;
  }

  const mutedRoomIds = getMutedNotificationRoomIdsSet();
  if (muted) {
    mutedRoomIds.add(normalizedRoomId);
  } else {
    mutedRoomIds.delete(normalizedRoomId);
  }

  notificationPreferences = normalizeNotificationPreferences({
    ...notificationPreferences,
    mutedRoomIds: [...mutedRoomIds]
  });
  persistNotificationPreferences();
};

const isDesktopNotificationSupported = () => typeof window !== "undefined" && "Notification" in window;

const getDesktopNotificationPermission = () => {
  if (!isDesktopNotificationSupported()) {
    return "unsupported";
  }

  return String(Notification.permission || "default");
};

const requestDesktopNotificationPermission = async () => {
  if (!isDesktopNotificationSupported()) {
    return "unsupported";
  }

  try {
    const result = Notification.requestPermission();
    if (result && typeof result.then === "function") {
      return String((await result) || Notification.permission || "default");
    }
  } catch (error) {
    // Older browsers may require callback style requestPermission.
  }

  return new Promise(resolve => {
    try {
      Notification.requestPermission(permission => {
        resolve(String(permission || Notification.permission || "default"));
      });
    } catch (error) {
      resolve(String(Notification.permission || "default"));
    }
  });
};

const loadNotificationPreferences = () => {
  notificationPreferences = normalizeNotificationPreferences({
    enabled: false,
    onlyWhenUnfocused: true,
    mutedRoomIds: []
  });

  if (!state.user) {
    return notificationPreferences;
  }

  try {
    const raw = window.localStorage.getItem(getNotificationPrefsStorageKey());
    if (!raw) {
      return notificationPreferences;
    }

    const parsed = JSON.parse(raw);
    notificationPreferences = normalizeNotificationPreferences(parsed);
  } catch (error) {
    notificationPreferences = normalizeNotificationPreferences(notificationPreferences);
  }

  return notificationPreferences;
};

const persistNotificationPreferences = () => {
  if (!state.user) {
    return;
  }

  try {
    window.localStorage.setItem(getNotificationPrefsStorageKey(), JSON.stringify(notificationPreferences));
  } catch (error) {
    // Ignore storage failures (private mode, quota, etc).
  }
};

const renderNotificationSettings = () => {
  if (!notificationEnabledToggle || !notificationUnfocusedOnlyToggle || !notificationSettingsStatus || !notificationTestButton) {
    return;
  }

  const hasUser = Boolean(state.user);
  const supported = isDesktopNotificationSupported();
  const permission = getDesktopNotificationPermission();

  if (!hasUser) {
    notificationEnabledToggle.checked = false;
    notificationEnabledToggle.disabled = true;
    notificationUnfocusedOnlyToggle.checked = true;
    notificationUnfocusedOnlyToggle.disabled = true;
    notificationTestButton.disabled = true;
    notificationSettingsStatus.textContent = "Login required.";
    return;
  }

  if (!supported) {
    notificationEnabledToggle.checked = false;
    notificationEnabledToggle.disabled = true;
    notificationUnfocusedOnlyToggle.checked = true;
    notificationUnfocusedOnlyToggle.disabled = true;
    notificationTestButton.disabled = true;
    notificationSettingsStatus.textContent = "This browser does not support desktop notifications.";
    return;
  }

  if (permission !== "granted" && notificationPreferences.enabled) {
    notificationPreferences.enabled = false;
    persistNotificationPreferences();
  }

  notificationEnabledToggle.disabled = permission === "denied";
  notificationEnabledToggle.checked = permission === "granted" && notificationPreferences.enabled;
  notificationUnfocusedOnlyToggle.checked = notificationPreferences.onlyWhenUnfocused;
  notificationUnfocusedOnlyToggle.disabled = !(permission === "granted" && notificationPreferences.enabled);
  notificationTestButton.disabled = !(permission === "granted" && notificationPreferences.enabled);

  if (permission === "denied") {
    notificationSettingsStatus.textContent = "Notifications are blocked in browser settings for this site.";
    return;
  }

  if (permission === "granted") {
    const mutedCount = getMutedNotificationRoomIdsSet().size;
    notificationSettingsStatus.textContent = notificationPreferences.enabled
      ? mutedCount > 0
        ? `Desktop notifications are enabled. ${mutedCount} room${mutedCount === 1 ? "" : "s"} muted.`
        : "Desktop notifications are enabled."
      : "Permission is granted. Enable notifications to receive alerts.";
    return;
  }

  notificationSettingsStatus.textContent = "Enable notifications to request browser permission.";
};

const clearRoomDropIndicators = () => {
  for (const element of roomList.querySelectorAll(".room-item.drop-before, .room-item.drop-after")) {
    element.classList.remove("drop-before", "drop-after");
  }
};

const clearRoomDragState = () => {
  draggingRoomId = null;
  dragTargetRoomId = null;
  dragTargetPosition = "before";
  clearRoomDropIndicators();

  for (const element of roomList.querySelectorAll(".room-item.dragging")) {
    element.classList.remove("dragging");
  }
};

const reorderRooms = ({ sourceRoomId, targetRoomId, position = "before" }) => {
  const sourceId = String(sourceRoomId || "");
  const targetId = String(targetRoomId || "");
  if (!sourceId || !targetId || sourceId === targetId) {
    return;
  }

  const nextRooms = [...state.rooms];
  const sourceIndex = nextRooms.findIndex(room => String(room.id) === sourceId);
  if (sourceIndex < 0) {
    return;
  }

  const [movedRoom] = nextRooms.splice(sourceIndex, 1);
  const targetIndex = nextRooms.findIndex(room => String(room.id) === targetId);
  if (targetIndex < 0) {
    return;
  }

  const insertAt = position === "after" ? targetIndex + 1 : targetIndex;
  nextRooms.splice(insertAt, 0, movedRoom);

  state.rooms = nextRooms;
  setStoredRoomOrder(nextRooms.map(room => room.id));
  renderRooms();
};

const getActiveRoom = () => state.rooms.find(room => room.id === state.activeRoomId) || null;
const roomCanChat = room => room && room.accessStatus === "member";
const activeRoomIsOwner = () => {
  const room = getActiveRoom();
  return Boolean(room && state.user && room.ownerUserId === state.user.id);
};
const getPresencePayload = () => {
  const room = getActiveRoom();
  const canSignalRoom = Boolean(room && roomCanChat(room) && state.activeRoomCanAccess);
  const activeRoomId = canSignalRoom ? room.id : null;
  const isFocused = Boolean(activeRoomId && document.visibilityState === "visible" && document.hasFocus());

  return {
    activeRoomId,
    isFocused
  };
};
const emitPresenceState = () => {
  if (!socket.connected) {
    return;
  }

  socket.emit("presence:update", getPresencePayload());
};
const normalizePresenceStatus = member => {
  const value = String(member?.presenceStatus || "").trim().toLowerCase();
  if (value === "active" || value === "other" || value === "idle" || value === "offline") {
    return value;
  }

  return member?.online ? "active" : "offline";
};

const purgeExpiredTypingEntriesForRoom = roomId => {
  const normalizedRoomId = String(roomId || "");
  if (!normalizedRoomId) {
    return [];
  }

  const roomTyping = state.typingByRoom.get(normalizedRoomId);
  if (!roomTyping) {
    return [];
  }

  const now = Date.now();
  for (const [userId, entry] of roomTyping.entries()) {
    if (!entry || Number(entry.expiresAt || 0) <= now) {
      roomTyping.delete(userId);
    }
  }

  if (roomTyping.size === 0) {
    state.typingByRoom.delete(normalizedRoomId);
    return [];
  }

  return [...roomTyping.values()];
};

const formatTypingPlaceholder = users => {
  const entries = Array.isArray(users) ? users : [];
  if (entries.length === 0) {
    return DEFAULT_MESSAGE_PLACEHOLDER;
  }

  const names = entries
    .map(entry => String(entry?.displayName || "Someone").trim() || "Someone")
    .filter(Boolean);

  if (names.length === 1) {
    return `${names[0]} is typing...`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing...`;
  }

  return `${names[0]} and ${names.length - 1} others are typing...`;
};

const isComposerEditing = () => Boolean(composerEditTarget?.roomId && composerEditTarget?.messageId);

const syncComposerActionState = () => {
  const isEditing = isComposerEditing();
  const canCompose = !messageInput.disabled;
  sendMessageButton.textContent = isEditing ? "Save" : "Send";
  sendMessageButton.disabled = !canCompose || messageEditBusy;
  attachFilesButton.disabled = !canCompose || isEditing;
};

const clearComposerEditTarget = ({ clearInput = false } = {}) => {
  const previousTarget = composerEditTarget;
  composerEditTarget = null;
  messageEditBusy = false;
  if (clearInput) {
    messageInput.value = "";
    syncMessageInputHeight();
  }
  syncComposerActionState();
  if (previousTarget && String(previousTarget.roomId || "") === String(state.activeRoomId || "")) {
    const roomMessages = state.messagesByRoom.get(String(previousTarget.roomId || "")) || [];
    const targetMessage = roomMessages.find(entry => String(entry.id || "") === String(previousTarget.messageId || ""));
    if (targetMessage) {
      const patched = replaceRenderedMessageTile({
        roomId: previousTarget.roomId,
        targetMessageId: previousTarget.messageId,
        nextMessage: targetMessage
      });
      if (!patched) {
        renderMessages();
      }
    }
  }
};

const beginComposerEdit = message => {
  const room = getActiveRoom();
  if (!room || !roomCanChat(room) || !state.activeRoomCanAccess || !canEditMessage(message)) {
    return false;
  }

  composerEditTarget = {
    roomId: String(message.roomId || ""),
    messageId: String(message.id || "")
  };
  messageEditBusy = false;
  clearComposerAttachments();
  messageInput.value = String(message.text || "");
  syncMessageInputHeight();
  syncComposerActionState();
  updateComposerPlaceholder();
  const patched = replaceRenderedMessageTile({
    roomId: message.roomId,
    targetMessageId: message.id,
    nextMessage: message
  });
  if (!patched) {
    renderMessages();
  }
  messageInput.focus();
  messageInput.selectionStart = messageInput.value.length;
  messageInput.selectionEnd = messageInput.value.length;
  return true;
};

const updateComposerPlaceholder = () => {
  const room = getActiveRoom();
  if (!room || !roomCanChat(room) || !state.activeRoomCanAccess) {
    messageInput.placeholder = DEFAULT_MESSAGE_PLACEHOLDER;
    return;
  }

  if (isComposerEditing()) {
    messageInput.placeholder = EDIT_MESSAGE_PLACEHOLDER;
    return;
  }

  const typingEntries = purgeExpiredTypingEntriesForRoom(room.id).filter(
    entry => String(entry.userId || "") !== String(state.user?.id || "")
  );
  messageInput.placeholder = formatTypingPlaceholder(typingEntries);
};

const emitTypingState = ({ roomId, isTyping }) => {
  if (!socket.connected) {
    return;
  }

  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) {
    return;
  }

  socket.emit("typing:update", {
    roomId: normalizedRoomId,
    isTyping: Boolean(isTyping)
  });
};

const stopLocalTyping = ({ emit = true } = {}) => {
  if (emit && localTypingRoomId) {
    emitTypingState({
      roomId: localTypingRoomId,
      isTyping: false
    });
  }

  localTypingRoomId = null;
  localTypingLastSentAt = 0;
};

const syncLocalTypingFromInput = () => {
  const room = getActiveRoom();
  const canEmitTyping = Boolean(room && roomCanChat(room) && state.activeRoomCanAccess);
  const hasText = Boolean(String(messageInput.value || "").trim());

  if (!canEmitTyping || !hasText) {
    stopLocalTyping({ emit: true });
    return;
  }

  const roomId = String(room.id);
  const now = Date.now();
  const roomChanged = localTypingRoomId !== roomId;
  const shouldEmit = roomChanged || now - localTypingLastSentAt >= TYPING_EVENT_THROTTLE_MS;
  if (!shouldEmit) {
    return;
  }

  emitTypingState({
    roomId,
    isTyping: true
  });
  localTypingRoomId = roomId;
  localTypingLastSentAt = now;
};

const setConnectionStatus = status => {
  if (!connectionChip) {
    return;
  }

  const normalized = status === "online" || status === "syncing" || status === "offline" ? status : "offline";
  const label = normalized === "online" ? "Live" : normalized === "syncing" ? "Connecting" : "Reconnecting";
  connectionChip.className = `connection-chip ${normalized}`;
  connectionChip.textContent = label;
};

const setComposerState = enabled => {
  messageInput.disabled = !enabled;
  if (!enabled) {
    clearComposerEditTarget();
    stopLocalTyping({ emit: true });
    messageInput.value = "";
    clearComposerAttachments();
  }
  syncMessageInputHeight();
  syncComposerActionState();
  updateComposerPlaceholder();
};

const closeChatActionsMenu = () => {
  chatActionsMenuOpen = false;
  chatActionsMenu.classList.add("hidden");
  chatActionsMenu.setAttribute("aria-hidden", "true");
  chatActionsToggleButton.setAttribute("aria-expanded", "false");
};

const toggleChatActionsMenu = () => {
  if (chatActionsMenuOpen) {
    closeChatActionsMenu();
    return;
  }

  chatActionsMenuOpen = true;
  chatActionsMenu.classList.remove("hidden");
  chatActionsMenu.setAttribute("aria-hidden", "false");
  chatActionsToggleButton.setAttribute("aria-expanded", "true");
};

const setGeneratedAccountHash = value => {
  generatedAccountHashValue = String(value || "").trim();
  accountHashDisplay.textContent = generatedAccountHashValue;
  accountHashDisplay.classList.toggle("hidden", !generatedAccountHashValue);
  copyAccountHashButton.classList.toggle("hidden", !generatedAccountHashValue);
  copyAccountHashButton.disabled = !generatedAccountHashValue;
};

const closeAccountHexModal = () => {
  if (!accountHexModal) {
    return;
  }

  accountHexModal.classList.add("hidden");
  accountHexModal.setAttribute("aria-hidden", "true");
};

const buildAccountHexDownloadText = ({ accountHash, user }) => {
  const safeAccountHash = String(accountHash || "").trim();
  const userId = String(user?.id || state.user?.id || "").trim() || "unknown";
  const username = String(user?.displayName || state.user?.displayName || "").trim() || "unknown";
  const createdAt = String(user?.createdAt || state.user?.createdAt || "").trim() || "unknown";
  const generatedAt = new Date().toISOString();

  return [
    "AChat Account Recovery Note",
    "================================",
    "",
    `Account Hex: ${safeAccountHash}`,
    `Username: ${username}`,
    `User ID: ${userId}`,
    `Account Created At: ${createdAt}`,
    `Hex Exported At: ${generatedAt}`,
    `App URL: ${window.location.origin}`,
    "",
    "IMPORTANT:",
    "- Keep this file private.",
    "- If you lose your account hex, account recovery may not be possible.",
    "- Never share this file publicly."
  ].join("\n");
};

const downloadAccountHexTextFile = ({ accountHash, user }) => {
  const safeAccountHash = String(accountHash || "").trim();
  if (!safeAccountHash) {
    return false;
  }

  const usernameRaw = String(user?.displayName || state.user?.displayName || "user")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "user";
  const filename = `achat-${usernameRaw}-account-hex.txt`;
  const textPayload = buildAccountHexDownloadText({ accountHash: safeAccountHash, user });
  const blob = new Blob([textPayload], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
};

const openAccountHexModal = ({ accountHash, user }) => {
  const safeAccountHash = String(accountHash || "").trim();
  if (!safeAccountHash || !accountHexModal || !accountHexModalValue) {
    return;
  }

  latestCreatedAccountHexValue = safeAccountHash;
  accountHexModalValue.textContent = safeAccountHash;
  accountHexModal.classList.remove("hidden");
  accountHexModal.setAttribute("aria-hidden", "false");
  accountHexModal.setAttribute("data-user-id", String(user?.id || state.user?.id || ""));
};

const renderAccountHashSettings = () => {
  const hasAccountHash = Boolean(state.user?.hasAccountHash);
  generateAccountHashButton.textContent = hasAccountHash ? "Regenerate Account Hash" : "Generate Account Hash";
  generateAccountHashButton.disabled = !state.user;
  disableAccountHashButton.classList.toggle("hidden", !hasAccountHash);
  disableAccountHashButton.disabled = !hasAccountHash;

  if (!state.user) {
    accountHashStatus.textContent = "Login required.";
    disableAccountHashButton.classList.add("hidden");
    disableAccountHashButton.disabled = true;
    return;
  }

  accountHashStatus.textContent = hasAccountHash
    ? "Hash login is active. Format: word(optionalNumber)-word-word-word-word-word-word-number-checkword. Regenerating replaces your current hash."
    : "Generate an account hash with format word(optionalNumber)-word-word-word-word-word-word-number-checkword, and keep it private.";
};

const renderPasswordLoginSettings = () => {
  if (
    !settingsPasswordSubmit ||
    !settingsCurrentPasswordInput ||
    !settingsPasswordInput ||
    !disablePasswordLoginButton ||
    !passwordLoginStatus ||
    !passwordLoginEmail
  ) {
    return;
  }

  const hasUser = Boolean(state.user);
  const hasPasswordLogin = Boolean(state.user?.hasPasswordLogin);
  const oauthEmail = String(state.user?.email || "").trim().toLowerCase();
  const loginEmail = String(state.user?.passwordLoginEmail || oauthEmail || "").trim().toLowerCase();

  if (!hasUser) {
    settingsPasswordSubmit.disabled = true;
    settingsPasswordSubmit.textContent = "Enable";
    settingsCurrentPasswordInput.value = "";
    settingsCurrentPasswordInput.disabled = true;
    settingsPasswordInput.value = "";
    settingsPasswordInput.disabled = true;
    disablePasswordLoginButton.classList.add("hidden");
    passwordLoginStatus.textContent = "Login required.";
    passwordLoginEmail.textContent = "";
    return;
  }

  const canEnable = Boolean(oauthEmail);
  const requiresCurrentPassword = hasPasswordLogin;
  settingsCurrentPasswordInput.disabled = !requiresCurrentPassword;
  settingsCurrentPasswordInput.required = requiresCurrentPassword;
  if (!requiresCurrentPassword) {
    settingsCurrentPasswordInput.value = "";
  }
  settingsPasswordInput.disabled = !canEnable;
  settingsPasswordSubmit.disabled = !canEnable;
  settingsPasswordSubmit.textContent = hasPasswordLogin ? "Update" : "Enable";
  disablePasswordLoginButton.classList.toggle("hidden", !hasPasswordLogin);
  disablePasswordLoginButton.disabled = !hasPasswordLogin;

  if (hasPasswordLogin) {
    passwordLoginStatus.textContent = "Password login is enabled. Current password is required to update or disable it.";
  } else if (!canEnable) {
    passwordLoginStatus.textContent = "Your OAuth provider did not supply an email, so password login cannot be enabled.";
  } else {
    passwordLoginStatus.textContent = "Enable login with email + password. Passwords are stored as secure hashes.";
  }

  passwordLoginEmail.textContent = loginEmail ? `Login email: ${loginEmail}` : "";
};

const renderDeveloperModeSettings = () => {
  const enabled = Boolean(state.user?.developerMode);
  developerModeToggle.disabled = !state.user;
  developerModeToggle.checked = enabled;
  renderManageAppsButton();

  if (!isBotAppManagerEnabled() && appsModal && !appsModal.classList.contains("hidden")) {
    closeAppsModal();
  }
};

const isBotAppManagerEnabled = () => Boolean(BOT_SYSTEM_ENABLED && state.user && !state.user.isBot && state.user.developerMode);

const renderManageAppsButton = () => {
  if (!openAppsModalButton) {
    return;
  }

  const enabled = isBotAppManagerEnabled();
  openAppsModalButton.classList.toggle("hidden", !enabled);
  openAppsModalButton.disabled = !enabled;
};

const formatDateTime = isoDate => {
  const value = String(isoDate || "").trim();
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

const maskTokenPreview = token => {
  const value = String(token || "").trim();
  if (!value) {
    return "";
  }

  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 12)}...${value.slice(-6)}`;
};

const renderBotApps = () => {
  if (!botAppList) {
    return;
  }

  if (!isBotAppManagerEnabled()) {
    botAppList.innerHTML = '<p class="empty">Enable Developer Mode to manage bot apps.</p>';
    return;
  }

  if (!Array.isArray(state.botApps) || state.botApps.length === 0) {
    botAppList.innerHTML = '<p class="empty">No bot apps yet. Create your first bot.</p>';
    return;
  }

  botAppList.innerHTML = state.botApps
    .map(bot => {
      const botId = String(bot?.id || "");
      const hasToken = state.botTokensById.has(botId);
      const token = hasToken ? String(state.botTokensById.get(botId) || "") : "";
      const maskedToken = hasToken ? maskTokenPreview(token) : "";
      return `
        <article class="bot-app-card" data-bot-user-id="${escapeHtml(botId)}">
          <div class="bot-app-card__header">
            <div>
              <p class="bot-app-card__name">${escapeHtml(bot?.displayName || "Bot")}</p>
              <p class="bot-app-card__meta">User ID ${escapeHtml(botId)} · Created ${escapeHtml(formatDateTime(bot?.createdAt))}</p>
            </div>
            <span class="bot-tag">BOT</span>
          </div>
          <form class="bot-app-rename-form" data-bot-action="rename" data-bot-user-id="${escapeHtml(botId)}" autocomplete="off">
            <div class="inline-field">
              <input
                name="displayName"
                value="${escapeHtml(bot?.displayName || "")}"
                maxlength="32"
                placeholder="Bot display name"
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                required
              />
              <button class="secondary-button" type="submit">Rename</button>
            </div>
          </form>
          <div class="bot-app-card__token">
            <p class="bot-app-card__token-label">Auth Token</p>
            ${
              hasToken
                ? `<code class="bot-app-card__token-value" title="${escapeHtml(token)}">${escapeHtml(maskedToken)}</code>`
                : '<p class="bot-app-card__token-hidden">Hidden for safety. Regenerate to reveal a new token.</p>'
            }
          </div>
          <div class="bot-app-card__actions">
            <button class="secondary-button" type="button" data-bot-action="copy-id" data-bot-user-id="${escapeHtml(botId)}">Copy ID</button>
            <button class="secondary-button" type="button" data-bot-action="rotate-token" data-bot-user-id="${escapeHtml(botId)}">Regenerate Token</button>
            <button class="secondary-button danger" type="button" data-bot-action="delete" data-bot-user-id="${escapeHtml(botId)}">Delete</button>
            ${
              hasToken
                ? `<button class="secondary-button" type="button" data-bot-action="copy-token" data-bot-user-id="${escapeHtml(botId)}">Copy Token</button>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
};

const loadBotApps = async ({ showErrors = true } = {}) => {
  if (!isBotAppManagerEnabled()) {
    state.botApps = [];
    state.botTokensById = new Map();
    renderBotApps();
    return;
  }

  try {
    const data = await request("/api/apps/bots");
    state.botApps = Array.isArray(data.bots) ? data.bots : [];
    renderBotApps();
  } catch (error) {
    if (showErrors) {
      notify(error.message || "Unable to load bot apps");
    }
  }
};

const copyText = async value => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(normalized);
    return true;
  }

  const temp = document.createElement("textarea");
  temp.value = normalized;
  temp.setAttribute("readonly", "true");
  temp.style.position = "fixed";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  temp.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(temp);
  return copied;
};

const renderSettingsRooms = () => {
  if (!settingsRoomList) {
    return;
  }

  const ownsAnyRoom = state.rooms.some(room => String(room.ownerUserId) === String(state.user?.id));
  deleteAccountButton.disabled = ownsAnyRoom;
  deleteAccountButton.title = ownsAnyRoom ? "Transfer ownership or delete owned rooms first" : "";

  if (!state.user || state.rooms.length === 0) {
    settingsRoomList.innerHTML = '<p class="empty">No joined rooms yet.</p>';
    return;
  }

  settingsRoomList.innerHTML = state.rooms
    .map(room => {
      const isOwner = String(room.ownerUserId) === String(state.user.id);
      const status = room.accessStatus === "pending" ? "pending" : "member";
      return `
        <article class="settings-room-item">
          <div>
            <p class="settings-room-item__name"># ${escapeHtml(room.name)}</p>
            <p class="settings-room-item__meta">ID ${room.id} · ${room.isPrivate ? "private" : "public"} · ${status}</p>
          </div>
          <div class="settings-room-item__actions">
            <button class="secondary-button" type="button" data-settings-action="leave" data-room-id="${room.id}">Leave</button>
            ${isOwner ? `<button class="secondary-button danger" type="button" data-settings-action="delete-room" data-room-id="${room.id}">Delete</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
};

const loadDeviceSettings = async ({ showErrors = false } = {}) => {
  if (!state.user || state.user.isBot) {
    state.devices = [];
    return;
  }

  try {
    const data = await request("/api/me/devices");
    state.devices = Array.isArray(data.devices) ? data.devices : [];
    if (state.user) {
      state.user.maxDevices = Number(data.maxDevices) || state.user.maxDevices || 3;
    }
  } catch (error) {
    if (showErrors) {
      notify(error.message || "Unable to load device settings");
    }
  }
};

const renderDeviceSettings = () => {
  if (!deviceList || !maxDevicesInput || !saveMaxDevicesButton || !deviceSettingsForm) {
    return;
  }

  const hasUser = Boolean(state.user && !state.user.isBot);
  maxDevicesInput.disabled = !hasUser;
  saveMaxDevicesButton.disabled = !hasUser;

  if (!hasUser) {
    maxDevicesInput.value = "3";
    deviceList.innerHTML = '<p class="empty">Login required.</p>';
    return;
  }

  const maxDevices = Number(state.user?.maxDevices) || 3;
  maxDevicesInput.value = String(maxDevices);

  if (!Array.isArray(state.devices) || state.devices.length === 0) {
    deviceList.innerHTML = '<p class="empty">No active devices found.</p>';
    return;
  }

  deviceList.innerHTML = state.devices
    .map(device => {
      const lastSeen = formatDateTime(device.lastSeenAt);
      const created = formatDateTime(device.createdAt);
      return `
        <article class="settings-room-item" data-device-id="${escapeHtml(device.id)}">
          <div>
            <p class="settings-room-item__name">${escapeHtml(device.deviceLabel || "Unnamed device")}${
              device.isCurrent ? ' <strong>(Current)</strong>' : ""
            }</p>
            <p class="settings-room-item__meta">Created ${escapeHtml(created)} · Last seen ${escapeHtml(lastSeen)}</p>
          </div>
          <div class="settings-room-item__actions">
            <button class="secondary-button danger" type="button" data-device-action="revoke" data-device-id="${escapeHtml(device.id)}">Revoke</button>
          </div>
        </article>
      `;
    })
    .join("");
};

const openAppsModal = () => {
  if (!isBotAppManagerEnabled()) {
    notify("Enable Developer Mode to manage bot apps.");
    return;
  }

  closeMobileDrawer();
  stopLocalTyping({ emit: true });
  hideMemberContextMenu();
  hideMessageContextMenu();
  hideRoomContextMenu();
  closeChatActionsMenu();
  closeRoomModal({ force: true });
  closeSettingsModal();

  appsModal.classList.remove("hidden");
  appsModal.setAttribute("aria-hidden", "false");
  void loadBotApps({ showErrors: true });

  window.setTimeout(() => {
    if (createBotAppNameInput) {
      createBotAppNameInput.focus();
    }
  }, 0);
};

const closeAppsModal = () => {
  appsModal.classList.add("hidden");
  appsModal.setAttribute("aria-hidden", "true");
};

const openSettingsModal = () => {
  closeMobileDrawer();
  stopLocalTyping({ emit: true });
  hideMemberContextMenu();
  hideMessageContextMenu();
  hideRoomContextMenu();
  closeChatActionsMenu();
  closeAppsModal();

  settingsModal.classList.remove("hidden");
  settingsModal.setAttribute("aria-hidden", "false");
  renderSettingsRooms();
  renderAccountHashSettings();
  renderPasswordLoginSettings();
  renderDeveloperModeSettings();
  renderNotificationSettings();
  renderDeviceSettings();
  void loadDeviceSettings({ showErrors: true }).then(() => {
    renderDeviceSettings();
  });

  if (state.user) {
    displayNameInput.value = state.user.displayName;
  }

  window.setTimeout(() => {
    displayNameInput.focus();
  }, 0);
};

const closeSettingsModal = () => {
  settingsModal.classList.add("hidden");
  settingsModal.setAttribute("aria-hidden", "true");
};

const openRoomModal = ({ locked = false } = {}) => {
  closeMobileDrawer();
  stopLocalTyping({ emit: true });
  hideMemberContextMenu();
  hideMessageContextMenu();
  hideRoomContextMenu();
  closeChatActionsMenu();
  closeSettingsModal();
  closeAppsModal();

  const wasHidden = roomModal.classList.contains("hidden");
  roomModalLocked = locked;
  roomModal.classList.toggle("locked", roomModalLocked);
  roomModal.setAttribute("aria-hidden", "false");

  if (!wasHidden) {
    return;
  }

  loadDiscoverableRooms({ showErrors: false });
  roomModal.classList.remove("hidden");

  window.setTimeout(() => {
    const defaultFocus = document.getElementById("new-room-name");
    if (defaultFocus) {
      defaultFocus.focus();
    }
  }, 0);
};

const closeRoomModal = ({ force = false } = {}) => {
  if (roomModalLocked && !force) {
    return;
  }

  roomModalLocked = false;
  roomModal.classList.add("hidden");
  roomModal.classList.remove("locked");
  roomModal.setAttribute("aria-hidden", "true");
};

const syncRoomModalForRoomCount = () => {
  if (state.rooms.length === 0) {
    openRoomModal({ locked: true });
    return;
  }

  if (roomModalLocked) {
    closeRoomModal({ force: true });
  }
};

const clearRoomPolling = () => {
  if (!roomPollTimer) {
    return;
  }

  window.clearInterval(roomPollTimer);
  roomPollTimer = null;
};

const shouldPollRooms = () =>
  Boolean(state.activeRoomId && !socket.connected && document.visibilityState === "visible");

const scheduleRoomPolling = () => {
  clearRoomPolling();

  if (!shouldPollRooms()) {
    return;
  }

  roomPollTimer = window.setInterval(async () => {
    if (roomPollBusy || !shouldPollRooms()) {
      return;
    }

    roomPollBusy = true;
    try {
      await loadRooms({ showErrors: false });
      if (state.activeRoomId) {
        await loadActiveRoomSnapshot({ showErrors: false, joinSocket: false, includeMessages: false });
      }
    } finally {
      roomPollBusy = false;
    }
  }, ROOM_POLL_INTERVAL_MS);
};

const isMessageListNearBottom = () => {
  const distanceToBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight;
  return distanceToBottom <= 72;
};

const scrollMessageListToBottom = ({ smooth = true } = {}) => {
  if (!messageList) {
    return;
  }

  const behavior = smooth ? "smooth" : "auto";
  if (typeof messageList.scrollTo === "function") {
    messageList.scrollTo({
      top: messageList.scrollHeight,
      behavior
    });
    return;
  }

  messageList.scrollTop = messageList.scrollHeight;
};

const renderMembers = () => {
  const room = getActiveRoom();
  const members = state.membersByRoom.get(state.activeRoomId) || [];
  const pendingUsers = state.pendingByRoom.get(state.activeRoomId) || [];

  hideMemberContextMenu();

  if (!room) {
    memberMeta.textContent = "";
    memberList.innerHTML = '<li class="empty">Select a room</li>';
    return;
  }

  if (!roomCanChat(room)) {
    memberMeta.textContent = "Waiting for approval";
    memberList.innerHTML = '<li class="empty">You can view the room status but not members yet.</li>';
    return;
  }

  memberMeta.textContent = `${members.length} members`;

  const memberItems = members
    .map(
      member => {
        const presenceStatus = normalizePresenceStatus(member);
        return `
        <li data-member-user-id="${member.id}">
          <span class="member-info">
            <span class="presence ${presenceStatus}"></span>
            <span class="member-name">${escapeHtml(member.displayName)}${member.isBot ? ' <span class="bot-tag bot-tag--inline">BOT</span>' : ""}</span>
          </span>
        </li>
      `;
      }
    )
    .join("");

  const isOwner = activeRoomIsOwner();
  const waitlistSection =
    isOwner && pendingUsers.length > 0
      ? `
        <li class="waitlist-heading">Waitlist (${pendingUsers.length})</li>
        ${pendingUsers
          .map(
            entry => `
              <li>
                <span class="member-info">
                  <span class="presence offline"></span>
                  <span class="member-name">${escapeHtml(entry.displayName)}${entry.isBot ? ' <span class="bot-tag bot-tag--inline">BOT</span>' : ""}</span>
                </span>
                <span class="member-actions">
                  <button class="inline-button accept" data-action="approve" data-user-id="${entry.id}">Approve</button>
                  <button class="inline-button reject" data-action="reject" data-user-id="${entry.id}">Reject</button>
                </span>
              </li>
            `
          )
          .join("")}
      `
      : "";

  memberList.innerHTML = memberItems + waitlistSection;
};

const setLastRenderedMessageState = ({ key, roomId, count, lastMessageId }) => {
  lastRenderedMessageKey = String(key || "");
  lastRenderedMessageRoomId = roomId || null;
  lastRenderedMessageCount = Number(count) || 0;
  lastRenderedLastMessageId = String(lastMessageId || "");
};

const buildFilledMessageRenderKey = ({ roomId, messages }) => {
  const lastMessage = messages[messages.length - 1];
  return `filled:${roomId}:${messages.length}:${lastMessage?.id || ""}:${lastMessage?.createdAt || ""}:${lastMessage?.userId || ""}`;
};

const replaceRenderedMessageTile = ({ roomId, targetMessageId, nextMessage, forceScroll = false } = {}) => {
  const normalizedRoomId = String(roomId || "");
  const normalizedTargetId = String(targetMessageId || "");
  if (!normalizedRoomId || !normalizedTargetId || !nextMessage?.id) {
    return false;
  }

  if (normalizedRoomId !== String(state.activeRoomId || "")) {
    return false;
  }

  const renderedMessages = [...messageList.querySelectorAll(".message[data-message-id]")];
  const targetElement = renderedMessages.find(entry => String(entry.getAttribute("data-message-id") || "") === normalizedTargetId);
  if (!targetElement) {
    return false;
  }

  const shouldStickToBottom = forceScroll || forceNextMessageStickToBottom || isMessageListNearBottom();
  targetElement.outerHTML = renderMessageTile(nextMessage);
  if (shouldStickToBottom) {
    scrollMessageListToBottom({ smooth: true });
  }

  const roomMessages = state.messagesByRoom.get(normalizedRoomId) || [];
  if (roomMessages.length > 0) {
    setLastRenderedMessageState({
      key: buildFilledMessageRenderKey({ roomId: normalizedRoomId, messages: roomMessages }),
      roomId: normalizedRoomId,
      count: roomMessages.length,
      lastMessageId: roomMessages[roomMessages.length - 1]?.id || ""
    });
  }

  forceNextMessageStickToBottom = false;
  return true;
};

const renderMessages = ({ forceScroll = false } = {}) => {
  const room = getActiveRoom();
  const roomId = state.activeRoomId;
  const messages = state.messagesByRoom.get(roomId) || [];

  hideMessageContextMenu();

  if (!room) {
    const nextKey = "no-room";
    if (nextKey !== lastRenderedMessageKey) {
      messageList.innerHTML = '<div class="empty-chat">Pick a room or create one to start chatting.</div>';
      setLastRenderedMessageState({
        key: nextKey,
        roomId: null,
        count: 0,
        lastMessageId: ""
      });
    }
    forceNextMessageStickToBottom = false;
    return;
  }

  if (!roomCanChat(room) || !state.activeRoomCanAccess) {
    const nextKey = `locked:${roomId}:${room.accessStatus || "none"}`;
    if (nextKey !== lastRenderedMessageKey) {
      messageList.innerHTML =
        '<div class="room-locked">This is a private room. Your request is pending owner approval, so chat is locked.</div>';
      setLastRenderedMessageState({
        key: nextKey,
        roomId,
        count: 0,
        lastMessageId: ""
      });
    }
    forceNextMessageStickToBottom = false;
    return;
  }

  if (messages.length === 0) {
    const nextKey = `empty:${roomId}`;
    if (nextKey !== lastRenderedMessageKey) {
      messageList.innerHTML = '<div class="empty-chat">No messages yet. Say hi.</div>';
      setLastRenderedMessageState({
        key: nextKey,
        roomId,
        count: 0,
        lastMessageId: ""
      });
    }
    forceNextMessageStickToBottom = false;
    return;
  }

  const lastMessage = messages[messages.length - 1];
  const nextKey = buildFilledMessageRenderKey({ roomId, messages });
  const previousMessage = messages[messages.length - 2];
  const roomChanged = lastRenderedMessageRoomId !== roomId;
  const shouldStickToBottom = forceScroll || forceNextMessageStickToBottom || roomChanged || isMessageListNearBottom();
  const shouldSmoothAutoScroll = !roomChanged;
  const canAppendSingleMessage =
    !roomChanged &&
    !forceScroll &&
    !forceNextMessageStickToBottom &&
    messages.length === lastRenderedMessageCount + 1 &&
    String(previousMessage?.id || "") === lastRenderedLastMessageId &&
    String(lastMessage?.id || "") !== lastRenderedLastMessageId;

  if (canAppendSingleMessage) {
    messageList.insertAdjacentHTML("beforeend", renderMessageTile(lastMessage));

    if (shouldStickToBottom) {
      scrollMessageListToBottom({ smooth: shouldSmoothAutoScroll });
    }

    setLastRenderedMessageState({
      key: nextKey,
      roomId,
      count: messages.length,
      lastMessageId: lastMessage?.id || ""
    });
    return;
  }

  if (nextKey === lastRenderedMessageKey && !forceScroll && !forceNextMessageStickToBottom) {
    return;
  }

  messageList.innerHTML = messages.map(renderMessageTile).join("");

  if (shouldStickToBottom) {
    scrollMessageListToBottom({ smooth: shouldSmoothAutoScroll });
  }

  forceNextMessageStickToBottom = false;
  setLastRenderedMessageState({
    key: nextKey,
    roomId,
    count: messages.length,
    lastMessageId: lastMessage?.id || ""
  });
};

const renderRoomHeader = () => {
  const room = getActiveRoom();

  if (roomKeyButton) {
    roomKeyButton.disabled = !room;
    roomKeyButton.textContent = room && getRoomPassphrase(room.id) ? "Refresh Security" : "Secure Sync";
  }

  if (e2eeStatus) {
    if (!room) {
      e2eeStatus.textContent = "Secure messaging is always on. Select a room to continue.";
    } else if (getRoomPassphrase(room.id)) {
      e2eeStatus.textContent = "Secure messaging active.";
    } else {
      e2eeStatus.textContent = "Preparing secure channel...";
    }
  }

  if (!room) {
    activeRoomName.textContent = "Select a room";
    activeRoomMeta.textContent = "No room selected";
    leaveRoomButton.classList.add("hidden");
    deleteRoomButton.classList.add("hidden");
    privacyToggleWrap.classList.add("hidden");
    discoverToggleWrap.classList.add("hidden");
    setComposerState(false);
    state.activeRoomCanAccess = false;
    state.activeRoomAccessStatus = "none";
    return;
  }

  const isPrivateLabel = room.isPrivate ? "private" : "public";
  activeRoomName.textContent = `# ${room.name}`;

  if (room.accessStatus === "pending") {
    activeRoomMeta.textContent = `ID ${room.id} · ${isPrivateLabel} · awaiting owner approval`;
    leaveRoomButton.textContent = "Leave Waitlist";
    leaveRoomButton.classList.remove("hidden");
    deleteRoomButton.classList.add("hidden");
    privacyToggleWrap.classList.add("hidden");
    discoverToggleWrap.classList.add("hidden");
    state.activeRoomCanAccess = false;
    state.activeRoomAccessStatus = "pending";
    setComposerState(false);
    return;
  }

  leaveRoomButton.textContent = "Leave Room";
  leaveRoomButton.classList.remove("hidden");
  deleteRoomButton.classList.toggle("hidden", !activeRoomIsOwner());
  state.activeRoomCanAccess = true;
  state.activeRoomAccessStatus = "member";
  activeRoomMeta.textContent = `ID ${room.id} · ${isPrivateLabel} · owner ${room.ownerDisplayName}`;
  setComposerState(true);

  if (activeRoomIsOwner()) {
    privacyToggleWrap.classList.remove("hidden");
    privacyToggle.checked = Boolean(room.isPrivate);
    discoverToggleWrap.classList.remove("hidden");
    discoverToggle.checked = room.isDiscoverable !== false;
  } else {
    privacyToggleWrap.classList.add("hidden");
    discoverToggleWrap.classList.add("hidden");
  }
};

const ensureActiveRoom = () => {
  if (state.rooms.length === 0) {
    state.activeRoomId = null;
    return;
  }

  if (!state.activeRoomId || !state.rooms.some(room => room.id === state.activeRoomId)) {
    state.activeRoomId = state.rooms[0].id;
  }
};

const getRoomPreviewText = room => {
  if (!room) {
    return "No messages yet";
  }

  if (room.accessStatus === "pending") {
    return "Waiting for owner approval";
  }

  if (room.latestMessage) {
    const latestText = String(room.latestMessage.text || "");
    if (isRoomKeyEnvelopeText(latestText)) {
      return "Secure channel updated";
    }

    if (isEncryptedMessageText(latestText)) {
      return "Secure message";
    }

    const authorName = room.latestMessage.userIsBot
      ? `${room.latestMessage.username || "Unknown"} [BOT]`
      : room.latestMessage.username || "Unknown";
    return `${authorName}: ${room.latestMessage.text}`;
  }

  return "No messages yet";
};

const findRoomListItemById = roomId => {
  const normalizedRoomId = String(roomId || "");
  if (!normalizedRoomId || !roomList) {
    return null;
  }

  const buttons = roomList.querySelectorAll(".room-item[data-room-id]");
  for (const button of buttons) {
    if (String(button.getAttribute("data-room-id") || "") === normalizedRoomId) {
      return button;
    }
  }

  return null;
};

const getRoomListSignature = rooms => {
  const list = Array.isArray(rooms) ? rooms : [];
  return list
    .map(room => {
      const latest = room?.latestMessage || null;
      return [
        String(room?.id || ""),
        String(room?.updatedAt || ""),
        String(room?.accessStatus || ""),
        String(room?.memberCount || 0),
        String(room?.pendingCount || 0),
        String(room?.name || ""),
        String(room?.ownerUserId || ""),
        room?.isPrivate ? "1" : "0",
        room?.isDiscoverable === false ? "0" : "1",
        String(latest?.id || ""),
        String(latest?.createdAt || ""),
        latest?.userIsBot ? "1" : "0",
        String(latest?.username || ""),
        String(latest?.text || "")
      ].join("|");
    })
    .join("~");
};

const renderRooms = ({ refreshActivePanels = true } = {}) => {
  userChip.textContent = state.user ? `${state.user.displayName} · ${state.user.id}` : "";
  renderManageAppsButton();

  if (state.user && document.activeElement !== displayNameInput) {
    displayNameInput.value = state.user.displayName;
  }

  const previousActiveRoomId = state.activeRoomId;
  ensureActiveRoom();
  const activeRoomChanged = previousActiveRoomId !== state.activeRoomId;
  const shouldRefreshPanels = refreshActivePanels || activeRoomChanged;

  if (state.rooms.length === 0) {
    roomList.innerHTML = '<p class="empty">No rooms yet. Create one.</p>';
    if (shouldRefreshPanels) {
      renderRoomHeader();
      renderMessages();
      renderMembers();
    }
    if (!settingsModal.classList.contains("hidden")) {
      renderSettingsRooms();
      renderAccountHashSettings();
      renderPasswordLoginSettings();
      renderDeveloperModeSettings();
      renderNotificationSettings();
      renderDeviceSettings();
    }
    syncRoomModalForRoomCount();
    return;
  }

  roomList.innerHTML = state.rooms
    .map(room => {
      const active = room.id === state.activeRoomId;
      const pending = room.accessStatus === "pending";
      const roomType = room.isPrivate ? "private" : "public";
      const preview = getRoomPreviewText(room);
      const ownerWaitlistHint = room.isOwner && room.pendingCount > 0 ? ` · ${room.pendingCount} waiting` : "";

      return `
        <button class="room-item ${active ? "active" : ""} ${pending ? "pending" : ""}" data-room-id="${room.id}" draggable="true" title="Drag to reorder">
          <span class="room-item__name"># ${escapeHtml(room.name)} ${room.isPrivate ? '<span class="room-item__flag">(private)</span>' : ""}</span>
          <span class="room-item__meta">${room.id} · ${roomType} · ${room.memberCount} members${ownerWaitlistHint}</span>
          <span class="room-item__preview">${escapeHtml(preview)}</span>
        </button>
      `;
    })
    .join("");

  if (shouldRefreshPanels) {
    renderRoomHeader();
    renderMessages();
    renderMembers();
  }
  if (!settingsModal.classList.contains("hidden")) {
    renderSettingsRooms();
    renderAccountHashSettings();
    renderPasswordLoginSettings();
    renderDeveloperModeSettings();
    renderNotificationSettings();
    renderDeviceSettings();
  }
  syncRoomModalForRoomCount();
};

const updateRoomPreviewFromMessage = message => {
  const roomId = String(message?.roomId || "").trim();
  if (!roomId) {
    return;
  }

  if (isRoomKeyEnvelopeText(message?.text)) {
    return;
  }

  const room = state.rooms.find(entry => String(entry.id || "") === roomId);
  if (!room || String(room.accessStatus || "") !== "member") {
    return;
  }

  room.latestMessage = {
    id: String(message.id || ""),
    username: String(message.username || "").trim() || "Unknown",
    userIsBot: Boolean(message.userIsBot),
    text: String(message.text || ""),
    createdAt: String(message.createdAt || "") || new Date().toISOString()
  };
  room.updatedAt = room.latestMessage.createdAt;

  const button = findRoomListItemById(roomId);
  if (!button) {
    renderRooms({ refreshActivePanels: false });
    return;
  }

  const previewElement = button.querySelector(".room-item__preview");
  if (previewElement) {
    previewElement.textContent = getRoomPreviewText(room);
  }
};

const refreshRoomPreviewFromCachedMessages = roomId => {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) {
    return;
  }

  const room = state.rooms.find(entry => String(entry.id || "") === normalizedRoomId);
  if (!room || String(room.accessStatus || "") !== "member") {
    return;
  }

  const roomMessages = state.messagesByRoom.get(normalizedRoomId) || [];
  const latest = roomMessages[roomMessages.length - 1] || null;
  room.latestMessage = latest
    ? {
        id: String(latest.id || ""),
        username: String(latest.username || "").trim() || "Unknown",
        userIsBot: Boolean(latest.userIsBot),
        text: String(latest.text || ""),
        createdAt: String(latest.createdAt || "") || new Date().toISOString()
      }
    : null;

  if (room.latestMessage?.createdAt) {
    room.updatedAt = room.latestMessage.createdAt;
  }

  const button = findRoomListItemById(normalizedRoomId);
  if (!button) {
    renderRooms({ refreshActivePanels: false });
    return;
  }

  const previewElement = button.querySelector(".room-item__preview");
  if (previewElement) {
    previewElement.textContent = getRoomPreviewText(room);
  }
};

const truncateNotificationBody = (value, maxLength = NOTIFICATION_BODY_MAX) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
};

const shouldDispatchDesktopNotification = message => {
  if (!message || !state.user) {
    return false;
  }

  if (!notificationPreferences.enabled || getDesktopNotificationPermission() !== "granted") {
    return false;
  }

  if (String(message.userId || "") === String(state.user.id || "")) {
    return false;
  }

  const roomId = String(message.roomId || "").trim();
  if (!roomId) {
    return false;
  }

  if (isRoomMutedForNotifications(roomId)) {
    return false;
  }

  if (notificationPreferences.onlyWhenUnfocused) {
    const isFocusedVisible = document.visibilityState === "visible" && document.hasFocus();
    if (isFocusedVisible) {
      return false;
    }
  }

  return true;
};

const dispatchDesktopNotificationForMessage = message => {
  if (!shouldDispatchDesktopNotification(message)) {
    return;
  }

  const room = state.rooms.find(entry => String(entry.id || "") === String(message.roomId || "")) || null;
  const roomName = room ? `#${room.name}` : `Room ${String(message.roomId || "").trim()}`;
  const authorName = String(message.username || "Unknown").trim() || "Unknown";
  const body = truncateNotificationBody(message.text) || "Sent an attachment or embed.";
  const title = `${authorName} in ${roomName}`;

  try {
    const desktopNotification = new Notification(title, {
      body,
      tag: `achat-message-${String(message.id || "") || Date.now()}`,
      renotify: false,
      silent: false
    });

    desktopNotification.onclick = () => {
      window.focus();
      if (room?.id) {
        void selectActiveRoom(String(room.id));
      }
      desktopNotification.close();
    };
  } catch (error) {
    // Ignore runtime notification errors.
  }
};

const isRoomLatestMessage = ({ roomId, messageId }) => {
  const normalizedRoomId = String(roomId || "");
  const normalizedMessageId = String(messageId || "");
  if (!normalizedRoomId || !normalizedMessageId) {
    return false;
  }

  const room = state.rooms.find(entry => String(entry.id || "") === normalizedRoomId);
  if (room?.latestMessage?.id) {
    return String(room.latestMessage.id) === normalizedMessageId;
  }

  const roomMessages = state.messagesByRoom.get(normalizedRoomId) || [];
  const latestCached = roomMessages[roomMessages.length - 1];
  return String(latestCached?.id || "") === normalizedMessageId;
};

const applyEditedMessageUpdate = message => {
  if (!message?.roomId || !message?.id) {
    return false;
  }

  const roomId = String(message.roomId);
  const messageId = String(message.id);
  const replaced = replaceMessageInState({
    roomId,
    targetMessageId: messageId,
    nextMessage: message
  });

  if (replaced && roomId === String(state.activeRoomId || "")) {
    const patched = replaceRenderedMessageTile({
      roomId,
      targetMessageId: messageId,
      nextMessage: message
    });
    if (!patched) {
      renderMessages();
    }
  }

  if (isRoomLatestMessage({ roomId, messageId })) {
    updateRoomPreviewFromMessage(message);
  }

  return replaced;
};

const renderDiscoveryRooms = () => {
  if (!discoveryRoomList) {
    return;
  }

  if (!Array.isArray(state.discoverableRooms) || state.discoverableRooms.length === 0) {
    discoveryRoomList.innerHTML = '<p class="empty">No discoverable rooms right now.</p>';
    return;
  }

  discoveryRoomList.innerHTML = state.discoverableRooms
    .map(room => {
      const isActive = room.id === state.activeRoomId;
      const access = String(room.accessStatus || "none");

      let actionMarkup = "";
      let statusLabel = "";

      if (access === "member") {
        statusLabel = isActive ? "Active" : "Joined";
        if (!isActive) {
          actionMarkup = `<button class="secondary-button" data-discovery-action="open" data-room-id="${room.id}">Open</button>`;
        }
      } else if (access === "pending") {
        statusLabel = "Pending approval";
      } else {
        statusLabel = room.isPrivate ? "Private" : "Public";
        actionMarkup = `<button class="primary-button" data-discovery-action="join" data-room-id="${room.id}">${room.isPrivate ? "Request" : "Join"}</button>`;
      }

      return `
        <article class="discovery-room">
          <div>
            <p class="discovery-room__name"># ${escapeHtml(room.name)}</p>
            <p class="discovery-room__meta">ID ${room.id} · owner ${escapeHtml(room.ownerDisplayName)} · ${room.memberCount} members</p>
          </div>
          <div class="discovery-room__status">
            ${escapeHtml(statusLabel)}
            ${actionMarkup}
          </div>
        </article>
      `;
    })
    .join("");
};

const loadDiscoverableRooms = async ({ showErrors = true } = {}) => {
  try {
    const data = await request("/api/discovery/rooms");
    state.discoverableRooms = Array.isArray(data.rooms) ? data.rooms : [];
    renderDiscoveryRooms();
  } catch (error) {
    if (showErrors) {
      notify(error.message);
    }
  }
};

const loadRooms = async ({ showErrors = true } = {}) => {
  try {
    const data = await request("/api/rooms");
    const preparedRooms = await prepareRoomsForDisplay(data.rooms || []);
    state.rooms = applyStoredRoomOrder(preparedRooms);
    renderRooms();
  } catch (error) {
    if (showErrors) {
      notify(error.message);
    }
  }
};

const emitWithAck = (eventName, payload, timeoutMs = SOCKET_ACK_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error("Socket not connected"));
      return;
    }

    const timer = window.setTimeout(() => {
      reject(new Error("Socket timeout"));
    }, timeoutMs);

    socket.emit(eventName, payload, ack => {
      window.clearTimeout(timer);

      if (ack?.error) {
        reject(new Error(ack.error));
        return;
      }

      resolve(ack || { ok: true });
    });
  });

const joinActiveRoom = async () => {
  const room = getActiveRoom();
  if (!socket.connected) {
    return;
  }

  if (!room || !roomCanChat(room)) {
    emitPresenceState();
    return;
  }

  try {
    await emitWithAck("room:join", { roomId: room.id });
  } catch (error) {
    notify(error.message || "Failed to join realtime room");
  } finally {
    emitPresenceState();
  }
};

const loadActiveRoomSnapshot = async ({ showErrors = true, joinSocket = true, includeMessages = false } = {}) => {
  const room = getActiveRoom();
  if (!room) {
    emitPresenceState();
    return;
  }

  try {
    const query = new URLSearchParams();
    if (includeMessages) {
      query.set("includeMessages", "1");
      query.set("messageLimit", String(MESSAGE_FETCH_LIMIT));
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const data = await request(`/api/rooms/${room.id}${suffix}`);
    state.activeRoomCanAccess = Boolean(data.canAccess);
    state.activeRoomAccessStatus = data.accessStatus || "none";

    if (includeMessages) {
      const preparedMessages = await prepareMessagesForDisplay(Array.isArray(data.messages) ? data.messages : []);
      state.messagesByRoom.set(room.id, preparedMessages);
      state.messageHasMoreByRoom.set(room.id, Boolean(data.messageHasMore));
    }

    if (data.canAccess && !getRoomPassphrase(room.id)) {
      try {
        await ensureRoomKeyAvailable({ roomId: room.id, forceRotate: false, allowCreate: false });
      } catch (error) {
        // Key sync may fail transiently; UI will keep showing pending status.
      }
    }
    state.membersByRoom.set(room.id, Array.isArray(data.members) ? data.members : []);
    state.pendingByRoom.set(room.id, Array.isArray(data.pendingUsers) ? data.pendingUsers : []);

    renderRoomHeader();
    renderMessages();
    renderMembers();
    updateComposerPlaceholder();

    if (joinSocket && data.canAccess) {
      await joinActiveRoom();
    }
    emitPresenceState();
  } catch (error) {
    emitPresenceState();
    if (showErrors) {
      notify(error.message);
    }
  }
};

const selectActiveRoom = async roomId => {
  if (!roomId || roomId === state.activeRoomId) {
    return;
  }

  closeMobileDrawer();
  clearComposerEditTarget({ clearInput: true });
  stopLocalTyping({ emit: true });
  hideMemberContextMenu();
  hideMessageContextMenu();
  closeChatActionsMenu();
  forceNextMessageStickToBottom = true;
  state.activeRoomId = roomId;
  renderRooms();
  await loadActiveRoomSnapshot({ showErrors: true, joinSocket: true, includeMessages: true });
  scheduleRoomPolling();
};

const sendMessageViaHttp = async ({ roomId, text }) => {
  const data = await request(`/api/rooms/${roomId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text })
  });
  return data.message || null;
};

const sendSystemEnvelopeMessage = async ({ roomId, text }) => {
  if (socket.connected) {
    try {
      const ack = await emitWithAck("message:send", { roomId, text });
      return ack?.message || null;
    } catch (error) {
      const fallback = await sendMessageViaHttp({ roomId, text });
      return fallback;
    }
  }

  return sendMessageViaHttp({ roomId, text });
};

const fetchRoomE2EEPublicKeys = async roomId => {
  const response = await request(`/api/rooms/${encodeURIComponent(roomId)}/e2ee/public-keys`);
  return Array.isArray(response?.keys) ? response.keys : [];
};

const syncRoomKeyToRoomMembers = async ({ roomId, roomKeyBase64 }) => {
  const normalizedRoomId = String(roomId || "").trim();
  const normalizedRoomKeyBase64 = String(roomKeyBase64 || "").trim();
  if (!normalizedRoomId || !normalizedRoomKeyBase64) {
    return;
  }

  const recipients = await fetchRoomE2EEPublicKeys(normalizedRoomId);
  const recipientEntries = recipients.filter(entry => {
    const userId = String(entry?.userId || "").trim();
    const publicKey = String(entry?.publicKey || "").trim();
    return userId && publicKey;
  });

  await Promise.all(
    recipientEntries.map(async recipient => {
      const envelopeText = await buildRoomKeyEnvelopePayload({
        roomId: normalizedRoomId,
        roomKeyBase64: normalizedRoomKeyBase64,
        recipientUserId: recipient.userId,
        recipientPublicKey: recipient.publicKey
      });
      await sendSystemEnvelopeMessage({ roomId: normalizedRoomId, text: envelopeText });
    })
  );
};

const ensureRoomKeyAvailable = async ({ roomId, forceRotate = false, allowCreate = true, syncExisting = false } = {}) => {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) {
    throw new Error("roomId is required");
  }

  await ensureE2EEIdentityRegistration();

  if (!forceRotate) {
    const existing = getRoomPassphrase(normalizedRoomId);
    if (existing) {
      if (syncExisting) {
        await syncRoomKeyToRoomMembers({ roomId: normalizedRoomId, roomKeyBase64: existing });
      }
      return existing;
    }

    if (!allowCreate) {
      return "";
    }
  }

  const roomKeyBytes = window.crypto.getRandomValues(new Uint8Array(32));
  const roomKeyBase64 = bytesToBase64(roomKeyBytes);
  setRoomPassphrase({ roomId: normalizedRoomId, passphrase: roomKeyBase64 });
  await syncRoomKeyToRoomMembers({ roomId: normalizedRoomId, roomKeyBase64 });

  return roomKeyBase64;
};

const sendMessage = async ({ roomId, text }) => {
  if (socket.connected) {
    try {
      const ack = await emitWithAck("message:send", { roomId, text });
      return {
        transport: "socket",
        message: ack?.message || null
      };
    } catch (error) {
      const message = await sendMessageViaHttp({ roomId, text });
      return {
        transport: "http",
        message
      };
    }
  }

  const message = await sendMessageViaHttp({ roomId, text });
  return {
    transport: "http",
    message
  };
};

const editMessageViaHttp = async ({ roomId, messageId, text }) => {
  const data = await request(`/api/rooms/${roomId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ text })
  });
  return data.message || null;
};

const editMessageById = async ({ roomId, messageId, text }) => {
  if (socket.connected) {
    try {
      const ack = await emitWithAck("message:edit", { roomId, messageId, text });
      return {
        transport: "socket",
        message: ack?.message || null
      };
    } catch (error) {
      const message = await editMessageViaHttp({ roomId, messageId, text });
      return {
        transport: "http",
        message
      };
    }
  }

  const message = await editMessageViaHttp({ roomId, messageId, text });
  return {
    transport: "http",
    message
  };
};

const deleteMessageById = async ({ roomId, messageId }) => {
  const data = await request(`/api/rooms/${roomId}/messages/${messageId}`, {
    method: "DELETE"
  });

  return {
    roomId: String(data.roomId || roomId),
    messageId: String(data.messageId || messageId)
  };
};

const refreshRoomsAndActive = async () => {
  await loadRooms({ showErrors: false });
  await loadActiveRoomSnapshot({ showErrors: false, joinSocket: false, includeMessages: false });
  if (!roomModal.classList.contains("hidden")) {
    await loadDiscoverableRooms({ showErrors: false });
  }
};

const clearRoomCaches = roomId => {
  const normalizedRoomId = String(roomId || "");
  if (!normalizedRoomId) {
    return;
  }

  state.membersByRoom.delete(normalizedRoomId);
  state.pendingByRoom.delete(normalizedRoomId);
  state.messagesByRoom.delete(normalizedRoomId);
  state.messageHasMoreByRoom.delete(normalizedRoomId);
  state.messageLoadingOlderByRoom.delete(normalizedRoomId);
  state.typingByRoom.delete(normalizedRoomId);
};

const loadOlderMessagesForActiveRoom = async () => {
  const room = getActiveRoom();
  if (!room || !roomCanChat(room) || !state.activeRoomCanAccess) {
    return;
  }

  const roomId = String(room.id);
  if (!state.messageHasMoreByRoom.get(roomId) || state.messageLoadingOlderByRoom.has(roomId)) {
    return;
  }

  const existingMessages = state.messagesByRoom.get(roomId) || [];
  const oldestMessage = existingMessages[0];
  if (!oldestMessage?.id) {
    return;
  }

  state.messageLoadingOlderByRoom.add(roomId);
  const previousScrollHeight = messageList.scrollHeight;
  const previousScrollTop = messageList.scrollTop;

  try {
    const query = new URLSearchParams();
    query.set("limit", String(MESSAGE_FETCH_LIMIT));
    query.set("beforeId", String(oldestMessage.id));

    const data = await request(`/api/rooms/${roomId}/messages?${query.toString()}`);
    const olderMessages = await prepareMessagesForDisplay(Array.isArray(data.messages) ? data.messages : []);
    state.messageHasMoreByRoom.set(roomId, Boolean(data.hasMore));

    const added = prependOlderMessagesToState({
      roomId,
      messages: olderMessages
    });

    if (!added || roomId !== String(state.activeRoomId || "")) {
      return;
    }

    renderMessages();
    const delta = messageList.scrollHeight - previousScrollHeight;
    messageList.scrollTop = Math.max(0, previousScrollTop + delta);
  } catch (error) {
    notify(error.message || "Unable to load older messages");
  } finally {
    state.messageLoadingOlderByRoom.delete(roomId);
  }
};

const leaveRoomById = async roomId => {
  const normalizedRoomId = String(roomId || "");
  if (!normalizedRoomId) {
    return;
  }

  await request(`/api/rooms/${normalizedRoomId}/leave`, { method: "POST" });
  clearRoomCaches(normalizedRoomId);
  if (String(state.activeRoomId || "") === normalizedRoomId) {
    state.activeRoomId = null;
  }

  await loadRooms({ showErrors: false });
  await loadActiveRoomSnapshot({ showErrors: false, joinSocket: true, includeMessages: false });
  scheduleRoomPolling();
};

const deleteRoomById = async roomId => {
  const normalizedRoomId = String(roomId || "");
  if (!normalizedRoomId) {
    return;
  }

  await request(`/api/rooms/${normalizedRoomId}`, { method: "DELETE" });
  clearRoomCaches(normalizedRoomId);
  if (String(state.activeRoomId || "") === normalizedRoomId) {
    state.activeRoomId = null;
  }

  await loadRooms({ showErrors: false });
  await loadActiveRoomSnapshot({ showErrors: false, joinSocket: true, includeMessages: false });
  scheduleRoomPolling();
};

const processMessageSendQueue = async () => {
  if (messageSendBusy) {
    return;
  }

  messageSendBusy = true;

  while (messageSendQueue.length > 0) {
    const nextMessage = messageSendQueue.shift();
    if (!nextMessage?.roomId) {
      continue;
    }

    let optimisticMessage = null;
    try {
      const uploadedFiles = await uploadComposerFiles(nextMessage.files || []);
      const attachmentUrls = uploadedFiles.map(item => String(item?.url || "").trim()).filter(Boolean);
      const mergedText = [nextMessage.text || "", ...attachmentUrls].filter(Boolean).join("\n").trim();
      if (!mergedText) {
        continue;
      }
      if (mergedText.length > MESSAGE_TEXT_MAX_LENGTH) {
        notify("Message is too long after adding attachment links. Remove some attachments.");
        continue;
      }

      const roomKeyBase64 = await ensureRoomKeyAvailable({ roomId: nextMessage.roomId });

      const encryptedText = await encryptRoomMessageText({
        plaintext: mergedText,
        roomKeyBase64
      });

      optimisticMessage = {
        id: `tmp-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
        roomId: nextMessage.roomId,
        userId: state.user?.id || "",
        username: state.user?.displayName || "You",
        avatarUrl: state.user?.avatarUrl || null,
        text: mergedText,
        createdAt: new Date().toISOString(),
        optimistic: true
      };

      const optimisticAdded = addMessageToState(optimisticMessage);
      if (optimisticAdded && String(nextMessage.roomId) === String(state.activeRoomId)) {
        renderMessages();
        scrollMessageListToBottom({ smooth: true });
      }

      const result = await sendMessage({
        roomId: nextMessage.roomId,
        text: encryptedText
      });

      if (result?.message) {
        const preparedResultMessage = await prepareMessageForDisplay(result.message);
        const optimisticId = String(optimisticMessage?.id || "");
        const replaced = optimisticMessage
          ? replaceMessageInState({
              roomId: nextMessage.roomId,
              targetMessageId: optimisticMessage.id,
              nextMessage: preparedResultMessage
            })
          : false;
        const added = replaced ? false : addMessageToState(preparedResultMessage);

        if ((replaced || added) && String(preparedResultMessage.roomId) === String(state.activeRoomId)) {
          if (replaced && optimisticId) {
            const patched = replaceRenderedMessageTile({
              roomId: preparedResultMessage.roomId,
              targetMessageId: optimisticId,
              nextMessage: preparedResultMessage,
              forceScroll: true
            });
            if (!patched) {
              renderMessages();
              scrollMessageListToBottom({ smooth: true });
            }
          } else {
            renderMessages();
            scrollMessageListToBottom({ smooth: true });
          }
        }

        updateRoomPreviewFromMessage(preparedResultMessage);
      }

      if (result?.transport === "http") {
        await loadRooms({ showErrors: false });
      }
    } catch (error) {
      if (optimisticMessage) {
        const removed = removeMessageFromState({
          roomId: optimisticMessage.roomId,
          messageId: optimisticMessage.id
        });
        if (removed && String(optimisticMessage.roomId) === String(state.activeRoomId)) {
          renderMessages();
        }
      }
      notify(error.message || "Unable to send message");
    }
  }

  messageSendBusy = false;
};

const submitComposerEdit = async () => {
  if (messageEditBusy) {
    return false;
  }

  const room = getActiveRoom();
  if (!room || !roomCanChat(room) || !state.activeRoomCanAccess || !isComposerEditing()) {
    clearComposerEditTarget();
    updateComposerPlaceholder();
    return false;
  }

  const targetRoomId = String(composerEditTarget.roomId || "");
  const targetMessageId = String(composerEditTarget.messageId || "");
  if (!targetRoomId || !targetMessageId || targetRoomId !== String(room.id)) {
    clearComposerEditTarget();
    updateComposerPlaceholder();
    return false;
  }

  const text = normalizeMessageText(messageInput.value);
  if (!text) {
    notify("Message cannot be empty");
    return false;
  }

  const roomKeyBase64 = await ensureRoomKeyAvailable({ roomId: targetRoomId });

  const encryptedText = await encryptRoomMessageText({
    plaintext: text,
    roomKeyBase64
  });

  messageEditBusy = true;
  syncComposerActionState();
  try {
    const result = await editMessageById({
      roomId: targetRoomId,
      messageId: targetMessageId,
      text: encryptedText
    });

    if (!result?.message) {
      throw new Error("Unable to edit message");
    }

    const preparedResultMessage = await prepareMessageForDisplay(result.message);
    applyEditedMessageUpdate(preparedResultMessage);
    messageInput.value = "";
    syncMessageInputHeight();
    stopLocalTyping({ emit: true });
    clearComposerEditTarget();
    updateComposerPlaceholder();

    if (result.transport === "http") {
      await loadRooms({ showErrors: false });
    }
    return true;
  } catch (error) {
    notify(error.message || "Unable to edit message");
    return false;
  } finally {
    messageEditBusy = false;
    syncComposerActionState();
  }
};

const queueComposerMessage = () => {
  const room = getActiveRoom();
  if (!room || !roomCanChat(room) || !state.activeRoomCanAccess) {
    return false;
  }

  if (isComposerEditing()) {
    void submitComposerEdit();
    return true;
  }

  const text = normalizeMessageText(messageInput.value);
  const files = [...composerAttachments];

  if (!text && files.length === 0) {
    return false;
  }

  messageInput.value = "";
  syncMessageInputHeight();
  clearComposerAttachments();
  messageInput.focus();
  stopLocalTyping({ emit: true });
  updateComposerPlaceholder();

  messageSendQueue.push({
    roomId: room.id,
    text,
    files
  });

  processMessageSendQueue();
  return true;
};

const bootAuthenticated = async ({ generatedAccountHash = "" } = {}) => {
  const data = await request("/api/me");
  state.user = data.user;
  state.devices = [];
  loadRoomKeysForUser();
  await ensureE2EEIdentityRegistration();
  const preparedRooms = await prepareRoomsForDisplay(data.rooms || []);
  state.rooms = applyStoredRoomOrder(preparedRooms);
  state.botApps = [];
  state.botTokensById = new Map();
  loadNotificationPreferences();
  setGeneratedAccountHash(generatedAccountHash);
  renderAccountHashSettings();
  renderPasswordLoginSettings();
  renderDeveloperModeSettings();
  renderNotificationSettings();
  await loadDeviceSettings({ showErrors: false });
  renderDeviceSettings();
  renderManageAppsButton();

  if (bootView) {
    bootView.classList.add("hidden");
  }
  authView.classList.add("hidden");
  appView.classList.remove("hidden");

  renderRooms();
  await loadActiveRoomSnapshot({ showErrors: false, joinSocket: false, includeMessages: true });
  scheduleRoomPolling();

  if (!socket.connected) {
    setConnectionStatus("syncing");
    socket.connect();
  }
};

accountCreateForm.addEventListener("submit", async event => {
  event.preventDefault();

  const username = String(accountCreateUsernameInput.value || "").trim();
  const deviceLabel = String(accountCreateDeviceLabelInput?.value || "").trim();
  if (!username) {
    notify("Username is required");
    return;
  }

  accountCreateButton.disabled = true;
  try {
    const result = await request("/auth/account/create", {
      method: "POST",
      body: JSON.stringify({ username, deviceLabel })
    });

    accountCreateForm.reset();
    await bootAuthenticated({ generatedAccountHash: result.accountHash || "" });
    openAccountHexModal({ accountHash: result.accountHash || "", user: result.user || null });
    notify("Account created. Save your account hex now.");
  } catch (error) {
    notify(error.message || "Unable to create account");
  } finally {
    accountCreateButton.disabled = false;
  }
});

accountHashLoginForm.addEventListener("submit", async event => {
  event.preventDefault();

  const accountHash = String(accountHashLoginInput.value || "").trim();
  const deviceLabel = String(accountHashDeviceLabelInput?.value || "").trim();
  if (!accountHash) {
    notify("Account hash is required");
    return;
  }

  accountHashLoginButton.disabled = true;
  try {
    await request("/auth/account-hash/login", {
      method: "POST",
      body: JSON.stringify({ accountHash, deviceLabel })
    });

    accountHashLoginForm.reset();
    await bootAuthenticated();
    notify("Logged in with account hash");
  } catch (error) {
    notify(error.message || "Unable to login with account hash");
  } finally {
    accountHashLoginButton.disabled = false;
  }
});

if (passwordLoginForm && passwordLoginEmailInput && passwordLoginPasswordInput && passwordLoginButton) {
  passwordLoginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = String(passwordLoginEmailInput.value || "").trim().toLowerCase();
    const password = String(passwordLoginPasswordInput.value || "");
    if (!email || !password) {
      notify("Email and password are required");
      return;
    }

    passwordLoginButton.disabled = true;
    try {
      await request("/auth/password/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      passwordLoginForm.reset();
      await bootAuthenticated();
      notify("Logged in with email and password");
    } catch (error) {
      notify(error.message || "Unable to login with email and password");
    } finally {
      passwordLoginButton.disabled = false;
    }
  });
}

logoutButton.addEventListener("click", async () => {
  try {
    stopLocalTyping({ emit: true });
    await request("/auth/logout", { method: "POST" });
    socket.disconnect();
    window.location.href = "/";
  } catch (error) {
    notify(error.message);
  }
});

if (roomKeyButton) {
  roomKeyButton.addEventListener("click", async () => {
    const room = getActiveRoom();
    if (!room) {
      notify("Select a room first");
      return;
    }

    try {
      const hadExistingKey = Boolean(getRoomPassphrase(room.id));
      await ensureRoomKeyAvailable({ roomId: room.id, forceRotate: hadExistingKey });
      renderRoomHeader();
      await loadActiveRoomSnapshot({ showErrors: false, joinSocket: false, includeMessages: true });
      notify(hadExistingKey ? "Security refreshed for this room" : "Secure sync completed");
    } catch (error) {
      notify(error.message || "Unable to refresh secure sync");
    }
  });
}

if (openRoomKeySettingsButton) {
  openRoomKeySettingsButton.addEventListener("click", () => {
    if (roomKeyButton) {
      roomKeyButton.click();
    }
  });
}

generateAccountHashButton.addEventListener("click", async () => {
  if (!state.user) {
    notify("You must be logged in");
    return;
  }

  generateAccountHashButton.disabled = true;
  try {
    const result = await request("/api/me/account-hash", { method: "POST" });
    state.user = result.user;
    setGeneratedAccountHash(result.accountHash || "");
    renderAccountHashSettings();
    notify("Account hash generated. Save it now.");
  } catch (error) {
    notify(error.message || "Unable to generate account hash");
  } finally {
    generateAccountHashButton.disabled = false;
  }
});

copyAccountHashButton.addEventListener("click", async () => {
  try {
    const copied = await copyText(generatedAccountHashValue);
    if (!copied) {
      notify("No account hash to copy");
      return;
    }

    notify("Account hash copied");
  } catch (error) {
    notify("Clipboard copy failed");
  }
});

disableAccountHashButton.addEventListener("click", async () => {
  const confirmed = window.confirm("Disable account hash login for this account?");
  if (!confirmed) {
    return;
  }

  disableAccountHashButton.disabled = true;
  try {
    const result = await request("/api/me/account-hash", { method: "DELETE" });
    state.user = result.user;
    setGeneratedAccountHash("");
    renderAccountHashSettings();
    notify("Account hash login disabled");
  } catch (error) {
    notify(error.message || "Unable to disable account hash login");
  } finally {
    disableAccountHashButton.disabled = false;
  }
});

if (deviceSettingsForm && maxDevicesInput && saveMaxDevicesButton) {
  deviceSettingsForm.addEventListener("submit", async event => {
    event.preventDefault();

    const maxDevices = Number(maxDevicesInput.value);
    if (!Number.isFinite(maxDevices)) {
      notify("Max devices must be a number");
      return;
    }

    saveMaxDevicesButton.disabled = true;
    try {
      const result = await request("/api/me/devices/settings", {
        method: "PATCH",
        body: JSON.stringify({ maxDevices })
      });
      state.user = result.user;
      await loadDeviceSettings({ showErrors: false });
      renderDeviceSettings();
      notify("Device limit updated");
    } catch (error) {
      notify(error.message || "Unable to update device limit");
    } finally {
      saveMaxDevicesButton.disabled = false;
    }
  });
}

if (deviceList) {
  deviceList.addEventListener("click", async event => {
    const button = event.target?.closest("button[data-device-action='revoke']");
    if (!button) {
      return;
    }

    const targetSessionId = String(button.getAttribute("data-device-id") || "").trim();
    if (!targetSessionId) {
      return;
    }

    const confirmed = window.confirm("Revoke this device session?");
    if (!confirmed) {
      return;
    }

    button.disabled = true;
    try {
      const result = await request(`/api/me/devices/${encodeURIComponent(targetSessionId)}`, {
        method: "DELETE"
      });

      if (result.revokedCurrent) {
        notify("Current device revoked. Please sign in again.");
        window.location.href = "/";
        return;
      }

      await loadDeviceSettings({ showErrors: false });
      renderDeviceSettings();
      notify("Device revoked");
    } catch (error) {
      notify(error.message || "Unable to revoke device");
      button.disabled = false;
    }
  });
}

if (
  settingsPasswordForm &&
  settingsPasswordInput &&
  settingsCurrentPasswordInput &&
  settingsPasswordSubmit &&
  disablePasswordLoginButton
) {
  settingsPasswordForm.addEventListener("submit", async event => {
    event.preventDefault();

    const password = String(settingsPasswordInput.value || "");
    const currentPassword = String(settingsCurrentPasswordInput.value || "");
    const requiresCurrentPassword = Boolean(state.user?.hasPasswordLogin);
    if (!password) {
      notify("Password is required");
      return;
    }
    if (requiresCurrentPassword && !currentPassword) {
      notify("Current password is required");
      return;
    }

    settingsPasswordSubmit.disabled = true;
    try {
      const result = await request("/api/me/password", {
        method: "POST",
        body: JSON.stringify({ password, currentPassword })
      });
      state.user = result.user;
      settingsPasswordForm.reset();
      renderPasswordLoginSettings();
      notify(requiresCurrentPassword ? "Password updated" : "Password login enabled");
    } catch (error) {
      notify(error.message || "Unable to enable password login");
    } finally {
      settingsPasswordSubmit.disabled = false;
    }
  });

  disablePasswordLoginButton.addEventListener("click", async () => {
    const confirmed = window.confirm("Disable email/password login for this account?");
    if (!confirmed) {
      return;
    }

    const currentPassword = String(settingsCurrentPasswordInput.value || "");
    if (!currentPassword) {
      notify("Current password is required");
      return;
    }

    disablePasswordLoginButton.disabled = true;
    try {
      const result = await request("/api/me/password", {
        method: "DELETE",
        body: JSON.stringify({ currentPassword })
      });
      state.user = result.user;
      settingsPasswordForm.reset();
      renderPasswordLoginSettings();
      notify("Password login disabled");
    } catch (error) {
      notify(error.message || "Unable to disable password login");
    } finally {
      disablePasswordLoginButton.disabled = false;
    }
  });
}

openRoomModalButton.addEventListener("click", () => {
  openRoomModal({ locked: state.rooms.length === 0 });
});

openAppsModalButton.addEventListener("click", () => {
  openAppsModal();
});

openSettingsButton.addEventListener("click", () => {
  openSettingsModal();
});

chatActionsToggleButton.addEventListener("click", event => {
  event.stopPropagation();
  toggleChatActionsMenu();
});

chatMenuSettingsButton.addEventListener("click", () => {
  openSettingsModal();
});

mobileRoomsToggleButton.addEventListener("click", () => {
  openMobileDrawer("rooms");
});

mobileMembersToggleButton.addEventListener("click", () => {
  openMobileDrawer("members");
});

mobileDrawerBackdrop.addEventListener("click", () => {
  closeMobileDrawer();
});

roomModalCloseButton.addEventListener("click", () => {
  closeRoomModal();
});

roomModalBackdrop.addEventListener("click", () => {
  closeRoomModal();
});

if (accountHexModalCloseButton) {
  accountHexModalCloseButton.addEventListener("click", () => {
    closeAccountHexModal();
  });
}

if (accountHexModalBackdrop) {
  accountHexModalBackdrop.addEventListener("click", () => {
    closeAccountHexModal();
  });
}

if (accountHexModalCopyButton) {
  accountHexModalCopyButton.addEventListener("click", async () => {
    const copied = await copyText(latestCreatedAccountHexValue);
    if (copied) {
      notify("Account hex copied");
      return;
    }

    notify("Unable to copy account hex");
  });
}

if (accountHexModalDownloadButton) {
  accountHexModalDownloadButton.addEventListener("click", () => {
    const downloaded = downloadAccountHexTextFile({
      accountHash: latestCreatedAccountHexValue,
      user: state.user
    });
    if (downloaded) {
      notify("Account hex TXT downloaded");
      return;
    }

    notify("No account hex available to download");
  });
}

settingsModalCloseButton.addEventListener("click", () => {
  closeSettingsModal();
});

settingsModalBackdrop.addEventListener("click", () => {
  closeSettingsModal();
});

appsModalCloseButton.addEventListener("click", () => {
  closeAppsModal();
});

appsModalBackdrop.addEventListener("click", () => {
  closeAppsModal();
});

createBotAppForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!isBotAppManagerEnabled()) {
    notify("Enable Developer Mode to manage bot apps.");
    return;
  }

  const form = new FormData(createBotAppForm);
  const displayName = String(form.get("displayName") || "").trim();
  if (!displayName) {
    notify("Bot display name is required");
    return;
  }

  const submitButton = createBotAppForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const result = await request("/api/apps/bots", {
      method: "POST",
      body: JSON.stringify({ displayName })
    });

    const createdBot = result.bot || null;
    const authToken = String(result.authToken || "").trim();
    if (createdBot) {
      state.botApps = [createdBot, ...(Array.isArray(state.botApps) ? state.botApps : [])];
      if (authToken) {
        state.botTokensById.set(String(createdBot.id), authToken);
      }
      renderBotApps();
      notify("Bot created. Save its token now.");
      createBotAppForm.reset();
      if (createBotAppNameInput) {
        createBotAppNameInput.focus();
      }
    }
  } catch (error) {
    notify(error.message || "Unable to create bot app");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
});

botAppList.addEventListener("click", async event => {
  const actionButton = event.target.closest("[data-bot-action][data-bot-user-id]");
  if (!actionButton) {
    return;
  }

  if (!isBotAppManagerEnabled()) {
    notify("Enable Developer Mode to manage bot apps.");
    return;
  }

  const action = String(actionButton.getAttribute("data-bot-action") || "");
  const botUserId = String(actionButton.getAttribute("data-bot-user-id") || "");
  if (!action || !botUserId) {
    return;
  }

  const bot = state.botApps.find(entry => String(entry?.id || "") === botUserId);
  if (!bot) {
    notify("Bot not found");
    return;
  }

  actionButton.disabled = true;
  try {
    if (action === "copy-id") {
      const copied = await copyText(botUserId);
      notify(copied ? "Bot user ID copied" : "Unable to copy bot user ID");
      return;
    }

    if (action === "copy-token") {
      const token = String(state.botTokensById.get(botUserId) || "").trim();
      if (!token) {
        notify("Token is hidden. Regenerate to reveal a new one.");
        return;
      }
      const copied = await copyText(token);
      notify(copied ? "Bot token copied" : "Unable to copy bot token");
      return;
    }

    if (action === "rotate-token") {
      const confirmed = window.confirm(`Regenerate auth token for ${bot.displayName}?`);
      if (!confirmed) {
        return;
      }

      const result = await request(`/api/apps/bots/${botUserId}/token`, { method: "POST" });
      const authToken = String(result.authToken || "").trim();
      if (authToken) {
        state.botTokensById.set(botUserId, authToken);
      }

      if (result.bot) {
        state.botApps = state.botApps.map(entry => (String(entry.id) === botUserId ? result.bot : entry));
      }
      renderBotApps();
      notify("Token regenerated. Copy and store it securely.");
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm(`Delete bot ${bot.displayName}? This cannot be undone.`);
      if (!confirmed) {
        return;
      }

      await request(`/api/apps/bots/${botUserId}`, { method: "DELETE" });
      state.botApps = state.botApps.filter(entry => String(entry?.id || "") !== botUserId);
      state.botTokensById.delete(botUserId);
      renderBotApps();
      await refreshRoomsAndActive();
      notify("Bot deleted");
    }
  } catch (error) {
    notify(error.message || "Unable to update bot app");
  } finally {
    actionButton.disabled = false;
  }
});

botAppList.addEventListener("submit", async event => {
  const form = event.target.closest("[data-bot-action='rename'][data-bot-user-id]");
  if (!form) {
    return;
  }

  event.preventDefault();

  if (!isBotAppManagerEnabled()) {
    notify("Enable Developer Mode to manage bot apps.");
    return;
  }

  const botUserId = String(form.getAttribute("data-bot-user-id") || "");
  if (!botUserId) {
    return;
  }

  const formData = new FormData(form);
  const displayName = String(formData.get("displayName") || "").trim();
  if (!displayName) {
    notify("Bot display name is required");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const result = await request(`/api/apps/bots/${botUserId}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName })
    });

    if (result.bot) {
      state.botApps = state.botApps.map(entry => (String(entry.id) === botUserId ? result.bot : entry));
      renderBotApps();
      await refreshRoomsAndActive();
      notify("Bot name updated");
    }
  } catch (error) {
    notify(error.message || "Unable to rename bot");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
});

attachFilesButton.addEventListener("click", () => {
  if (attachFilesButton.disabled) {
    return;
  }
  attachmentInput.click();
});

attachmentInput.addEventListener("change", () => {
  addComposerFiles(attachmentInput.files);
  attachmentInput.value = "";
});

composerAttachmentList.addEventListener("click", event => {
  const removeButton = event.target.closest("[data-remove-attachment]");
  if (!removeButton) {
    return;
  }

  const index = Number(removeButton.getAttribute("data-remove-attachment"));
  if (!Number.isInteger(index) || index < 0 || index >= composerAttachments.length) {
    return;
  }

  composerAttachments.splice(index, 1);
  renderComposerAttachments();
});

messageList.addEventListener("contextmenu", event => {
  const messageTile = event.target.closest(".message[data-message-id]");
  if (!messageTile) {
    hideMessageContextMenu();
    return;
  }

  const room = getActiveRoom();
  if (!room || !roomCanChat(room) || !state.activeRoomCanAccess) {
    hideMessageContextMenu();
    return;
  }

  const messageId = String(messageTile.getAttribute("data-message-id") || "").trim();
  if (!messageId) {
    hideMessageContextMenu();
    return;
  }

  const roomMessages = state.messagesByRoom.get(room.id) || [];
  const targetMessage = roomMessages.find(message => String(message.id) === messageId);
  const developerMode = Boolean(state.user?.developerMode);
  const allowEdit = canEditMessage(targetMessage);
  const allowDelete = canDeleteMessage(targetMessage);
  const allowDeveloperCopy = developerMode && Boolean(targetMessage);
  if (!allowEdit && !allowDelete && !allowDeveloperCopy) {
    hideMessageContextMenu();
    return;
  }

  messageContextEditButton.classList.toggle("hidden", !allowEdit);
  messageContextDeleteButton.classList.toggle("hidden", !allowDelete);
  messageContextCopyIdButton.classList.toggle("hidden", !allowDeveloperCopy);
  messageContextCopyTimestampButton.classList.toggle("hidden", !allowDeveloperCopy);
  messageContextTargetTimestamp = String(targetMessage?.createdAt || "");

  event.preventDefault();
  hideMemberContextMenu();
  hideRoomContextMenu();
  showMessageContextMenu({
    x: event.clientX,
    y: event.clientY,
    messageId
  });
});

messageContextEditButton.addEventListener("click", () => {
  const room = getActiveRoom();
  const messageId = String(messageContextTargetMessageId || "").trim();
  if (!room || !messageId) {
    hideMessageContextMenu();
    return;
  }

  const roomMessages = state.messagesByRoom.get(room.id) || [];
  const targetMessage = roomMessages.find(message => String(message.id) === messageId);
  if (!canEditMessage(targetMessage)) {
    hideMessageContextMenu();
    notify("You can only edit your own messages.");
    return;
  }

  beginComposerEdit(targetMessage);
  hideMessageContextMenu();
});

messageContextDeleteButton.addEventListener("click", async () => {
  const room = getActiveRoom();
  const messageId = String(messageContextTargetMessageId || "").trim();
  if (!room || !messageId) {
    hideMessageContextMenu();
    return;
  }

  const roomMessages = state.messagesByRoom.get(room.id) || [];
  const targetMessage = roomMessages.find(message => String(message.id) === messageId);
  if (!canDeleteMessage(targetMessage)) {
    hideMessageContextMenu();
    notify("You can only delete your own messages unless you own the room.");
    return;
  }

  const previousMessageIndex = roomMessages.findIndex(message => String(message.id) === messageId);
  const deletedMessageSnapshot = targetMessage ? { ...targetMessage } : null;
  messageContextDeleteButton.disabled = true;
  try {
    const removed = removeMessageFromState({ roomId: room.id, messageId });
    if (!removed) {
      return;
    }

    if (
      isComposerEditing() &&
      String(composerEditTarget.roomId || "") === String(room.id || "") &&
      String(composerEditTarget.messageId || "") === String(messageId || "")
    ) {
      clearComposerEditTarget();
      messageInput.value = "";
      syncMessageInputHeight();
      updateComposerPlaceholder();
    }

    refreshRoomPreviewFromCachedMessages(room.id);
    if (String(room.id) === String(state.activeRoomId)) {
      renderMessages();
    }
    hideMessageContextMenu();

    await deleteMessageById({ roomId: room.id, messageId });
    if (!socket.connected) {
      await loadRooms({ showErrors: false });
    }
  } catch (error) {
    const currentRoomMessages = state.messagesByRoom.get(String(room.id)) || [];
    const alreadyRestored = currentRoomMessages.some(message => String(message.id) === messageId);
    if (!alreadyRestored && deletedMessageSnapshot) {
      const nextRoomMessages = [...currentRoomMessages];
      const insertAt = Math.max(0, Math.min(previousMessageIndex, nextRoomMessages.length));
      nextRoomMessages.splice(insertAt, 0, deletedMessageSnapshot);
      state.messagesByRoom.set(String(room.id), nextRoomMessages.slice(-MAX_MESSAGES_PER_ROOM));
    }
    refreshRoomPreviewFromCachedMessages(room.id);
    if (String(room.id) === String(state.activeRoomId)) {
      renderMessages();
    }
    notify(error.message || "Unable to delete message");
  } finally {
    messageContextDeleteButton.disabled = false;
    hideMessageContextMenu();
  }
});

messageContextCopyIdButton.addEventListener("click", async () => {
  const messageId = String(messageContextTargetMessageId || "").trim();
  if (!messageId) {
    hideMessageContextMenu();
    return;
  }

  try {
    const copied = await copyText(messageId);
    if (!copied) {
      notify("Unable to copy message ID");
      return;
    }
    notify("Message ID copied");
  } catch (error) {
    notify("Unable to copy message ID");
  } finally {
    hideMessageContextMenu();
  }
});

messageContextCopyTimestampButton.addEventListener("click", async () => {
  const timestamp = String(messageContextTargetTimestamp || "").trim();
  if (!timestamp) {
    hideMessageContextMenu();
    return;
  }

  try {
    const copied = await copyText(timestamp);
    if (!copied) {
      notify("Unable to copy timestamp");
      return;
    }
    notify("Timestamp copied");
  } catch (error) {
    notify("Unable to copy timestamp");
  } finally {
    hideMessageContextMenu();
  }
});

messageInput.addEventListener("input", () => {
  syncMessageInputHeight();
  syncLocalTypingFromInput();
  updateComposerPlaceholder();
});

messageList.addEventListener("scroll", () => {
  if (messageList.scrollTop > 52) {
    return;
  }

  void loadOlderMessagesForActiveRoom();
});

messageInput.addEventListener("keydown", event => {
  if (event.key === "Escape" && isComposerEditing()) {
    event.preventDefault();
    clearComposerEditTarget();
    messageInput.value = "";
    syncMessageInputHeight();
    stopLocalTyping({ emit: true });
    updateComposerPlaceholder();
    return;
  }

  if (event.key !== "Enter" || event.isComposing) {
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    insertNewlineAtCursor(messageInput);
    return;
  }

  if (event.shiftKey || event.altKey) {
    return;
  }

  event.preventDefault();
  queueComposerMessage();
});

refreshDiscoveryButton.addEventListener("click", async () => {
  refreshDiscoveryButton.disabled = true;
  try {
    await loadDiscoverableRooms({ showErrors: true });
  } finally {
    refreshDiscoveryButton.disabled = false;
  }
});

discoveryRoomList.addEventListener("click", async event => {
  const actionButton = event.target.closest("[data-discovery-action][data-room-id]");
  if (!actionButton) {
    return;
  }

  const action = String(actionButton.getAttribute("data-discovery-action") || "");
  const roomId = String(actionButton.getAttribute("data-room-id") || "");
  if (!roomId) {
    return;
  }

  if (action === "open") {
    await selectActiveRoom(roomId);
    closeRoomModal({ force: true });
    return;
  }

  if (action !== "join") {
    return;
  }

  actionButton.disabled = true;
  try {
    const result = await request(`/api/rooms/${roomId}/join`, { method: "POST" });
    await loadRooms({ showErrors: false });
    await selectActiveRoom(roomId);
    closeRoomModal({ force: true });

    if (result.status === "pending") {
      notify(result.message || "Join request sent. Waiting for owner approval.");
    }
  } catch (error) {
    notify(error.message);
  } finally {
    actionButton.disabled = false;
    await loadDiscoverableRooms({ showErrors: false });
  }
});

settingsRoomList.addEventListener("click", async event => {
  const actionButton = event.target.closest("[data-settings-action][data-room-id]");
  if (!actionButton) {
    return;
  }

  const action = String(actionButton.getAttribute("data-settings-action") || "");
  const roomId = String(actionButton.getAttribute("data-room-id") || "");
  if (!roomId || !action) {
    return;
  }

  actionButton.disabled = true;
  try {
    if (action === "leave") {
      await leaveRoomById(roomId);
      notify("Left room");
      return;
    }

    if (action === "delete-room") {
      const confirmed = window.confirm("Delete this room permanently? This will remove all room messages.");
      if (!confirmed) {
        return;
      }

      await deleteRoomById(roomId);
      notify("Room deleted");
      return;
    }
  } catch (error) {
    notify(error.message || "Action failed");
  } finally {
    actionButton.disabled = false;
    renderSettingsRooms();
  }
});

deleteAccountButton.addEventListener("click", async () => {
  const ownsAnyRoom = state.rooms.some(room => String(room.ownerUserId) === String(state.user?.id));
  if (ownsAnyRoom) {
    notify("Transfer ownership or delete your owned rooms first.");
    return;
  }

  const confirmed = window.confirm(
    "Delete your account permanently? Your messages will remain as sent by Deleted User."
  );
  if (!confirmed) {
    return;
  }

  deleteAccountButton.disabled = true;
  try {
    stopLocalTyping({ emit: true });
    await request("/api/me", { method: "DELETE" });
    socket.disconnect();
    window.location.href = "/";
  } catch (error) {
    notify(error.message || "Unable to delete account");
    deleteAccountButton.disabled = false;
  }
});

document.addEventListener("click", event => {
  if (!event.target.closest("#member-context-menu")) {
    hideMemberContextMenu();
  }

  if (!event.target.closest("#message-context-menu")) {
    hideMessageContextMenu();
  }

  if (!event.target.closest("#room-context-menu")) {
    hideRoomContextMenu();
  }

  if (!event.target.closest(".chat-actions-menu-wrap")) {
    closeChatActionsMenu();
  }
});

window.addEventListener("keydown", event => {
  if (event.key === "Escape" && mobileDrawer) {
    closeMobileDrawer();
    return;
  }

  if (event.key === "Escape") {
    if (!chatActionsMenu.classList.contains("hidden")) {
      closeChatActionsMenu();
      return;
    }

    if (!appsModal.classList.contains("hidden")) {
      closeAppsModal();
      return;
    }

    if (!settingsModal.classList.contains("hidden")) {
      closeSettingsModal();
      return;
    }

    hideMemberContextMenu();
    hideMessageContextMenu();
    hideRoomContextMenu();
    closeRoomModal();
  }
});

window.addEventListener("resize", () => {
  hideMemberContextMenu();
  hideMessageContextMenu();
  hideRoomContextMenu();
  closeChatActionsMenu();
  if (!isMobileLayout()) {
    closeMobileDrawer();
  }
});

window.addEventListener("focus", () => {
  emitPresenceState();
  scheduleRoomPolling();
  updateComposerPlaceholder();
});

window.addEventListener("blur", () => {
  stopLocalTyping({ emit: true });
  emitPresenceState();
  scheduleRoomPolling();
  updateComposerPlaceholder();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    stopLocalTyping({ emit: true });
  }
  emitPresenceState();
  scheduleRoomPolling();
  updateComposerPlaceholder();
});

window.addEventListener(
  "scroll",
  () => {
    hideMemberContextMenu();
    hideMessageContextMenu();
    hideRoomContextMenu();
    closeChatActionsMenu();
  },
  true
);

roomList.addEventListener("click", event => {
  if (Date.now() < suppressRoomClickUntil) {
    return;
  }

  const target = event.target.closest("[data-room-id]");
  if (!target) {
    return;
  }

  const roomId = target.getAttribute("data-room-id");
  if (roomId === state.activeRoomId) {
    closeMobileDrawer();
    return;
  }

  selectActiveRoom(roomId);
});

roomList.addEventListener("contextmenu", event => {
  const target = event.target.closest("[data-room-id]");
  if (!target || !state.user) {
    hideRoomContextMenu();
    return;
  }

  const roomId = String(target.getAttribute("data-room-id") || "").trim();
  if (!roomId) {
    hideRoomContextMenu();
    return;
  }

  const allowDeveloperCopy = Boolean(state.user?.developerMode);
  roomContextCopyIdButton.classList.toggle("hidden", !allowDeveloperCopy);
  roomContextToggleMuteButton.textContent = isRoomMutedForNotifications(roomId) ? "Unmute Room" : "Mute Room";

  event.preventDefault();
  hideMemberContextMenu();
  hideMessageContextMenu();
  showRoomContextMenu({
    x: event.clientX,
    y: event.clientY,
    roomId
  });
});

roomList.addEventListener("dragstart", event => {
  const sourceItem = event.target.closest(".room-item[data-room-id]");
  if (!sourceItem) {
    return;
  }

  draggingRoomId = String(sourceItem.getAttribute("data-room-id") || "");
  sourceItem.classList.add("dragging");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggingRoomId);
  }
});

roomList.addEventListener("dragover", event => {
  if (!draggingRoomId) {
    return;
  }

  const targetItem = event.target.closest(".room-item[data-room-id]");
  if (!targetItem) {
    return;
  }

  const targetRoomId = String(targetItem.getAttribute("data-room-id") || "");
  if (!targetRoomId || targetRoomId === draggingRoomId) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }

  const targetRect = targetItem.getBoundingClientRect();
  const nextPosition = event.clientY > targetRect.top + targetRect.height / 2 ? "after" : "before";

  dragTargetRoomId = targetRoomId;
  dragTargetPosition = nextPosition;

  clearRoomDropIndicators();
  targetItem.classList.add(nextPosition === "after" ? "drop-after" : "drop-before");
});

roomList.addEventListener("drop", event => {
  if (!draggingRoomId) {
    return;
  }

  event.preventDefault();

  const targetItem = event.target.closest(".room-item[data-room-id]");
  if (targetItem) {
    dragTargetRoomId = String(targetItem.getAttribute("data-room-id") || dragTargetRoomId || "");
  }

  reorderRooms({
    sourceRoomId: draggingRoomId,
    targetRoomId: dragTargetRoomId,
    position: dragTargetPosition
  });

  suppressRoomClickUntil = Date.now() + 180;
  clearRoomDragState();
});

roomList.addEventListener("dragend", () => {
  clearRoomDragState();
});

memberList.addEventListener("contextmenu", event => {
  const row = event.target.closest("[data-member-user-id]");
  if (!row) {
    hideMemberContextMenu();
    return;
  }

  const room = getActiveRoom();
  if (!room || !roomCanChat(room)) {
    hideMemberContextMenu();
    return;
  }

  const targetUserId = String(row.getAttribute("data-member-user-id") || "");
  if (!targetUserId) {
    hideMemberContextMenu();
    return;
  }

  const canModerate = activeRoomIsOwner() && targetUserId !== room.ownerUserId;
  const allowDeveloperCopy = Boolean(state.user?.developerMode);
  if (!canModerate && !allowDeveloperCopy) {
    hideMemberContextMenu();
    return;
  }

  memberContextTransferButton.classList.toggle("hidden", !canModerate);
  memberContextKickButton.classList.toggle("hidden", !canModerate);
  memberContextCopyIdButton.classList.toggle("hidden", !allowDeveloperCopy);

  event.preventDefault();
  hideMessageContextMenu();
  hideRoomContextMenu();
  showMemberContextMenu({
    x: event.clientX,
    y: event.clientY,
    userId: targetUserId
  });
});

roomContextToggleMuteButton.addEventListener("click", () => {
  const roomId = String(roomContextTargetRoomId || "").trim();
  if (!roomId || !state.user) {
    hideRoomContextMenu();
    return;
  }

  const muted = isRoomMutedForNotifications(roomId);
  setRoomNotificationMuted(roomId, !muted);
  roomContextToggleMuteButton.textContent = muted ? "Mute Room" : "Unmute Room";

  const room = state.rooms.find(entry => String(entry.id || "") === roomId);
  const roomLabel = room ? `#${room.name}` : `Room ${roomId}`;
  notify(!muted ? `Muted notifications for ${roomLabel}` : `Unmuted notifications for ${roomLabel}`);
  renderNotificationSettings();
  hideRoomContextMenu();
});

roomContextCopyIdButton.addEventListener("click", async () => {
  const roomId = String(roomContextTargetRoomId || "").trim();
  if (!roomId) {
    hideRoomContextMenu();
    return;
  }

  try {
    const copied = await copyText(roomId);
    if (!copied) {
      notify("Unable to copy room ID");
      return;
    }
    notify("Room ID copied");
  } catch (error) {
    notify("Unable to copy room ID");
  } finally {
    hideRoomContextMenu();
  }
});

memberContextCopyIdButton.addEventListener("click", async () => {
  const userId = String(memberContextTargetUserId || "").trim();
  if (!userId) {
    hideMemberContextMenu();
    return;
  }

  try {
    const copied = await copyText(userId);
    if (!copied) {
      notify("Unable to copy user ID");
      return;
    }
    notify("User ID copied");
  } catch (error) {
    notify("Unable to copy user ID");
  } finally {
    hideMemberContextMenu();
  }
});

memberContextKickButton.addEventListener("click", async () => {
  const room = getActiveRoom();
  const targetUserId = memberContextTargetUserId;
  if (!room || !targetUserId || !activeRoomIsOwner()) {
    hideMemberContextMenu();
    return;
  }

  hideMemberContextMenu();

  try {
    await request(`/api/rooms/${room.id}/members/${targetUserId}/kick`, {
      method: "POST"
    });

    await refreshRoomsAndActive();
    notify("Member kicked");
  } catch (error) {
    notify(error.message);
  }
});

memberContextTransferButton.addEventListener("click", async () => {
  const room = getActiveRoom();
  const targetUserId = memberContextTargetUserId;
  if (!room || !targetUserId || !activeRoomIsOwner()) {
    hideMemberContextMenu();
    return;
  }

  const confirmed = window.confirm("Transfer room ownership to this member?");
  if (!confirmed) {
    hideMemberContextMenu();
    return;
  }

  hideMemberContextMenu();

  try {
    await request(`/api/rooms/${room.id}/ownership/${targetUserId}`, {
      method: "POST"
    });

    await refreshRoomsAndActive();
    notify("Ownership transferred");
  } catch (error) {
    notify(error.message);
  }
});

memberList.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const room = getActiveRoom();
  if (!room || !activeRoomIsOwner()) {
    return;
  }

  const targetUserId = button.getAttribute("data-user-id");
  const action = button.getAttribute("data-action");
  if (!targetUserId || !action) {
    return;
  }

  try {
    await request(`/api/rooms/${room.id}/waitlist/${targetUserId}/${action}`, {
      method: "POST"
    });

    await refreshRoomsAndActive();
    notify(action === "approve" ? "User approved" : "User rejected");
  } catch (error) {
    notify(error.message);
  }
});

privacyToggle.addEventListener("change", async () => {
  const room = getActiveRoom();
  if (!room || !activeRoomIsOwner()) {
    return;
  }

  privacyToggle.disabled = true;
  try {
    await request(`/api/rooms/${room.id}/privacy`, {
      method: "PATCH",
      body: JSON.stringify({ isPrivate: privacyToggle.checked })
    });

    await refreshRoomsAndActive();
    closeChatActionsMenu();
  } catch (error) {
    notify(error.message);
  } finally {
    privacyToggle.disabled = false;
  }
});

discoverToggle.addEventListener("change", async () => {
  const room = getActiveRoom();
  if (!room || !activeRoomIsOwner()) {
    return;
  }

  discoverToggle.disabled = true;
  try {
    await request(`/api/rooms/${room.id}/discovery`, {
      method: "PATCH",
      body: JSON.stringify({ isDiscoverable: discoverToggle.checked })
    });

    await refreshRoomsAndActive();
    closeChatActionsMenu();
  } catch (error) {
    notify(error.message);
  } finally {
    discoverToggle.disabled = false;
  }
});

displayNameForm.addEventListener("submit", async event => {
  event.preventDefault();

  const displayName = String(displayNameInput.value || "").trim();
  if (!displayName) {
    notify("Display name is required");
    return;
  }

  try {
    const result = await request("/api/me", {
      method: "PATCH",
      body: JSON.stringify({ displayName })
    });

    state.user = result.user;
    await refreshRoomsAndActive();
    notify("Display name updated");
  } catch (error) {
    notify(error.message);
  }
});

developerModeToggle.addEventListener("change", async () => {
  if (!state.user) {
    developerModeToggle.checked = false;
    return;
  }

  const enabled = Boolean(developerModeToggle.checked);
  developerModeToggle.disabled = true;
  try {
    const result = await request("/api/me/developer-mode", {
      method: "PATCH",
      body: JSON.stringify({ enabled })
    });
    state.user = result.user;
    renderDeveloperModeSettings();
    if (enabled) {
      void loadBotApps({ showErrors: false });
    } else {
      state.botApps = [];
      state.botTokensById = new Map();
      renderBotApps();
    }
    notify(enabled ? "Developer Mode enabled" : "Developer Mode disabled");
  } catch (error) {
    developerModeToggle.checked = Boolean(state.user?.developerMode);
    notify(error.message || "Unable to update Developer Mode");
  } finally {
    developerModeToggle.disabled = false;
  }
});

notificationEnabledToggle.addEventListener("change", async () => {
  if (!state.user) {
    notificationEnabledToggle.checked = false;
    renderNotificationSettings();
    return;
  }

  if (!isDesktopNotificationSupported()) {
    notificationEnabledToggle.checked = false;
    notificationPreferences.enabled = false;
    persistNotificationPreferences();
    renderNotificationSettings();
    notify("Desktop notifications are not supported in this browser.");
    return;
  }

  if (!notificationEnabledToggle.checked) {
    notificationPreferences.enabled = false;
    persistNotificationPreferences();
    renderNotificationSettings();
    notify("Desktop notifications disabled");
    return;
  }

  notificationEnabledToggle.disabled = true;
  try {
    const permission = getDesktopNotificationPermission();
    const nextPermission = permission === "granted" ? "granted" : await requestDesktopNotificationPermission();
    if (nextPermission !== "granted") {
      notificationPreferences.enabled = false;
      persistNotificationPreferences();
      renderNotificationSettings();
      notify(nextPermission === "denied" ? "Notification permission was denied." : "Notification permission not granted.");
      return;
    }

    notificationPreferences.enabled = true;
    persistNotificationPreferences();
    renderNotificationSettings();
    notify("Desktop notifications enabled");
  } catch (error) {
    notificationPreferences.enabled = false;
    persistNotificationPreferences();
    renderNotificationSettings();
    notify("Unable to enable desktop notifications");
  } finally {
    notificationEnabledToggle.disabled = false;
  }
});

notificationUnfocusedOnlyToggle.addEventListener("change", () => {
  if (!state.user) {
    notificationUnfocusedOnlyToggle.checked = true;
    renderNotificationSettings();
    return;
  }

  notificationPreferences.onlyWhenUnfocused = Boolean(notificationUnfocusedOnlyToggle.checked);
  persistNotificationPreferences();
  renderNotificationSettings();
});

notificationTestButton.addEventListener("click", async () => {
  if (!state.user) {
    notify("You must be logged in");
    return;
  }

  if (!isDesktopNotificationSupported()) {
    notify("Desktop notifications are not supported in this browser.");
    return;
  }

  if (!notificationPreferences.enabled) {
    notify("Enable desktop notifications first.");
    return;
  }

  let permission = getDesktopNotificationPermission();
  if (permission !== "granted") {
    permission = await requestDesktopNotificationPermission();
    if (permission !== "granted") {
      notificationPreferences.enabled = false;
      persistNotificationPreferences();
      renderNotificationSettings();
      notify("Notification permission not granted.");
      return;
    }
  }

  try {
    const room = getActiveRoom();
    const roomName = room ? `#${room.name}` : "AChat";
    const testNotification = new Notification(`AChat Test in ${roomName}`, {
      body: "You will get notifications for new messages based on your settings.",
      tag: `achat-test-${Date.now()}`,
      renotify: false,
      silent: false
    });
    testNotification.onclick = () => {
      window.focus();
      testNotification.close();
    };
  } catch (error) {
    notify("Unable to show desktop notification.");
  }
});

createRoomForm.addEventListener("submit", async event => {
  event.preventDefault();

  const form = new FormData(createRoomForm);
  const name = String(form.get("name") || "").trim();
  const isPrivate = form.get("isPrivate") === "on";
  const isDiscoverable = form.get("isDiscoverable") === "on";

  if (!name) {
    notify("Room name is required");
    return;
  }

  try {
    const result = await request("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ name, isPrivate, isDiscoverable })
    });

    createRoomForm.reset();
    await loadRooms({ showErrors: false });
    await selectActiveRoom(result.room.id);
    closeRoomModal({ force: true });
  } catch (error) {
    notify(error.message);
  }
});

joinRoomForm.addEventListener("submit", async event => {
  event.preventDefault();

  const form = new FormData(joinRoomForm);
  const roomId = String(form.get("roomId") || "").trim();

  if (!/^\d{4}$/.test(roomId)) {
    notify("Room ID must be 4 digits");
    return;
  }

  try {
    const result = await request(`/api/rooms/${roomId}/join`, { method: "POST" });
    joinRoomForm.reset();
    await loadRooms({ showErrors: false });
    await selectActiveRoom(roomId);
    closeRoomModal({ force: true });

    if (result.status === "pending") {
      notify(result.message || "Join request sent. Waiting for owner approval.");
    }
  } catch (error) {
    if (error.status === 202) {
      notify("Join request sent. Waiting for owner approval.");
      await loadRooms({ showErrors: false });
      await selectActiveRoom(roomId);
      closeRoomModal({ force: true });
      return;
    }

    notify(error.message);
  }
});

leaveRoomButton.addEventListener("click", async () => {
  const room = getActiveRoom();
  if (!room) {
    return;
  }

  try {
    await leaveRoomById(room.id);
    closeChatActionsMenu();
  } catch (error) {
    notify(error.message);
  }
});

deleteRoomButton.addEventListener("click", async () => {
  const room = getActiveRoom();
  if (!room || !activeRoomIsOwner()) {
    return;
  }

  const confirmed = window.confirm("Delete this room permanently? This will remove all room messages.");
  if (!confirmed) {
    return;
  }

  try {
    await deleteRoomById(room.id);
    closeChatActionsMenu();
    notify("Room deleted");
  } catch (error) {
    notify(error.message);
  }
});

messageForm.addEventListener("submit", event => {
  event.preventDefault();
  queueComposerMessage();
});

socket.on("connect", async () => {
  setConnectionStatus("online");
  scheduleRoomPolling();
  await joinActiveRoom();
});

socket.on("disconnect", () => {
  stopLocalTyping({ emit: false });
  setConnectionStatus("offline");
  scheduleRoomPolling();
  updateComposerPlaceholder();
});

socket.on("connect_error", () => {
  setConnectionStatus("offline");
  notify("Realtime socket failed. Using HTTP fallback.");
});

socket.on("rooms:update", async rooms => {
  const preparedRooms = await prepareRoomsForDisplay(Array.isArray(rooms) ? rooms : []);
  const nextRooms = applyStoredRoomOrder(preparedRooms);
  if (getRoomListSignature(nextRooms) === getRoomListSignature(state.rooms)) {
    return;
  }

  const previousRooms = state.rooms;
  const previousActive = state.activeRoomId;
  const previousActiveRoom = previousRooms.find(room => room.id === previousActive) || null;
  state.rooms = nextRooms;
  const currentActiveStillExists = state.rooms.some(room => room.id === state.activeRoomId);
  const nextActiveRoomForComparison = currentActiveStillExists
    ? state.rooms.find(room => room.id === state.activeRoomId) || null
    : null;
  const accessChanged =
    previousActiveRoom?.accessStatus !== nextActiveRoomForComparison?.accessStatus ||
    previousActiveRoom?.pendingCount !== nextActiveRoomForComparison?.pendingCount ||
    previousActiveRoom?.memberCount !== nextActiveRoomForComparison?.memberCount;
  const activeRoomMetaChanged =
    previousActiveRoom?.name !== nextActiveRoomForComparison?.name ||
    previousActiveRoom?.ownerUserId !== nextActiveRoomForComparison?.ownerUserId ||
    Boolean(previousActiveRoom?.isPrivate) !== Boolean(nextActiveRoomForComparison?.isPrivate) ||
    Boolean(previousActiveRoom?.isDiscoverable) !== Boolean(nextActiveRoomForComparison?.isDiscoverable);
  const activeRoomMayChange = Boolean(state.activeRoomId && !currentActiveStillExists);
  const missingMessageCacheBeforeRender = Boolean(state.activeRoomId && !state.messagesByRoom.has(state.activeRoomId));
  const shouldRefreshPanels =
    activeRoomMayChange || accessChanged || activeRoomMetaChanged || missingMessageCacheBeforeRender;
  renderRooms({ refreshActivePanels: shouldRefreshPanels });
  const nextActiveRoom = state.rooms.find(room => room.id === state.activeRoomId) || null;
  const activeRoomChanged = previousActive !== state.activeRoomId;
  const missingMessageCache = Boolean(state.activeRoomId && !state.messagesByRoom.has(state.activeRoomId));

  if (!state.activeRoomId) {
    emitPresenceState();
    return;
  }

  if (activeRoomChanged || missingMessageCache || accessChanged) {
    const shouldIncludeMessages = activeRoomChanged || missingMessageCache;
    loadActiveRoomSnapshot({
      showErrors: false,
      joinSocket: Boolean(nextActiveRoom && nextActiveRoom.accessStatus === "member"),
      includeMessages: shouldIncludeMessages
    });
  }
});

socket.on("room:history", async payload => {
  if (!payload?.roomId) {
    return;
  }

  const preparedMessages = await prepareMessagesForDisplay(Array.isArray(payload.messages) ? payload.messages : []);
  state.messagesByRoom.set(payload.roomId, preparedMessages);
  if (typeof payload.hasMore === "boolean") {
    state.messageHasMoreByRoom.set(payload.roomId, payload.hasMore);
  }

  if (payload.roomId === state.activeRoomId) {
    renderMessages({ forceScroll: true });
    updateComposerPlaceholder();
  }
});

socket.on("message:new", async message => {
  if (!message?.roomId) {
    return;
  }

  const preparedMessage = await prepareMessageForDisplay(message);
  if (!preparedMessage) {
    return;
  }

  const reconciledOptimisticId = reconcileOwnOptimisticMessage(preparedMessage);
  if (reconciledOptimisticId) {
    if (String(preparedMessage.roomId) === String(state.activeRoomId)) {
      const patched = replaceRenderedMessageTile({
        roomId: preparedMessage.roomId,
        targetMessageId: reconciledOptimisticId,
        nextMessage: preparedMessage,
        forceScroll: true
      });
      if (!patched) {
        renderMessages();
        scrollMessageListToBottom({ smooth: true });
      }
    }
    updateRoomPreviewFromMessage(preparedMessage);
    return;
  }

  const added = addMessageToState(preparedMessage);
  if (!added) {
    updateRoomPreviewFromMessage(preparedMessage);
    return;
  }

  dispatchDesktopNotificationForMessage(preparedMessage);

  if (String(preparedMessage.roomId) === String(state.activeRoomId)) {
    renderMessages();
    if (preparedMessage.userId === state.user?.id) {
      scrollMessageListToBottom({ smooth: true });
    }
    updateComposerPlaceholder();
  }

  updateRoomPreviewFromMessage(preparedMessage);
});

socket.on("message:update", async payload => {
  const message = payload?.message || payload;
  if (!message?.roomId || !message?.id) {
    return;
  }

  const preparedMessage = await prepareMessageForDisplay(message);
  if (!preparedMessage) {
    return;
  }
  applyEditedMessageUpdate(preparedMessage);
});

socket.on("typing:update", payload => {
  const roomId = String(payload?.roomId || "").trim();
  const userId = String(payload?.userId || "").trim();
  if (!roomId || !userId || userId === String(state.user?.id || "")) {
    return;
  }

  const isTyping = Boolean(payload?.isTyping);
  const displayName = String(payload?.displayName || "User").trim() || "User";
  const existingRoomTyping = state.typingByRoom.get(roomId) || new Map();

  if (isTyping) {
    existingRoomTyping.set(userId, {
      userId,
      displayName,
      expiresAt: Date.now() + TYPING_EVENT_TTL_MS
    });
    state.typingByRoom.set(roomId, existingRoomTyping);
  } else {
    existingRoomTyping.delete(userId);
    if (existingRoomTyping.size === 0) {
      state.typingByRoom.delete(roomId);
    } else {
      state.typingByRoom.set(roomId, existingRoomTyping);
    }
  }

  if (roomId === String(state.activeRoomId || "")) {
    updateComposerPlaceholder();
  }
});

socket.on("message:delete", payload => {
  const roomId = String(payload?.roomId || "").trim();
  const messageId = String(payload?.messageId || "").trim();
  if (!roomId || !messageId) {
    return;
  }

  if (
    isComposerEditing() &&
    String(composerEditTarget.roomId || "") === roomId &&
    String(composerEditTarget.messageId || "") === messageId
  ) {
    clearComposerEditTarget();
    messageInput.value = "";
    syncMessageInputHeight();
    stopLocalTyping({ emit: true });
    updateComposerPlaceholder();
  }

  const removed = removeMessageFromState({ roomId, messageId });
  if (!removed) {
    return;
  }

  refreshRoomPreviewFromCachedMessages(roomId);

  if (roomId === String(state.activeRoomId || "")) {
    renderMessages();
  }
});

socket.on("room:presence", payload => {
  if (!payload?.roomId) {
    return;
  }

  const roomId = String(payload.roomId || "").trim();
  const nextMembers = Array.isArray(payload.members) ? payload.members : [];
  const memberSignature = nextMembers
    .map(member => String(member?.id || "").trim())
    .filter(Boolean)
    .sort()
    .join(",");

  state.membersByRoom.set(roomId, nextMembers);
  state.pendingByRoom.set(roomId, Array.isArray(payload.pendingUsers) ? payload.pendingUsers : []);

  const room = state.rooms.find(entry => String(entry.id || "") === roomId) || null;
  const isCurrentUserOwner = String(payload.ownerUserId || room?.ownerUserId || "") === String(state.user?.id || "");
  if (isCurrentUserOwner && memberSignature) {
    const roomKeyBase64 = getRoomPassphrase(roomId);
    if (roomKeyBase64) {
      const now = Date.now();
      const previousResyncState = roomKeyResyncStateByRoomId.get(roomId) || { memberSignature: "", lastSyncedAt: 0 };
      const membersChanged = previousResyncState.memberSignature !== memberSignature;
      const beyondCooldown = now - Number(previousResyncState.lastSyncedAt || 0) >= ROOM_KEY_RESYNC_MIN_INTERVAL_MS;
      if (membersChanged && beyondCooldown) {
        roomKeyResyncStateByRoomId.set(roomId, {
          memberSignature,
          lastSyncedAt: now
        });

        ensureRoomKeyAvailable({ roomId, forceRotate: false, allowCreate: false, syncExisting: true }).catch(() => {});
      }
    }
  }

  if (roomId === state.activeRoomId) {
    renderMembers();
    renderRoomHeader();
    updateComposerPlaceholder();
  }
});

syncMobileDrawerUi();
setConnectionStatus("syncing");
syncMessageInputHeight();
syncComposerActionState();
updateComposerPlaceholder();
window.setInterval(() => {
  updateComposerPlaceholder();
}, 1000);
for (const element of document.querySelectorAll("form, input, textarea")) {
  element.setAttribute("autocomplete", "off");
}

(async () => {
  setAuthMode("choice");
  try {
    await bootAuthenticated();
  } catch (error) {
    if (bootView) {
      bootView.classList.add("hidden");
    }
    if (error.status !== 401) {
      notify(error.message);
    }

    setAuthMode("choice");
    authView.classList.remove("hidden");
    appView.classList.add("hidden");
    socket.disconnect();
  }
})();
