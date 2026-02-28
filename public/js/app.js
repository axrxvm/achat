const state = {
  user: null,
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

const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const oauthButton = document.getElementById("oauth-login");
const accountHashLoginForm = document.getElementById("account-hash-login-form");
const accountHashLoginInput = document.getElementById("account-hash-login-input");
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
const leaveRoomButton = document.getElementById("leave-room");
const deleteRoomButton = document.getElementById("delete-room");
const connectionChip = document.getElementById("connection-chip");
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
const openSettingsButton = document.getElementById("open-settings");
const deleteAccountButton = document.getElementById("delete-account");
const settingsRoomList = document.getElementById("settings-room-list");
const accountHashStatus = document.getElementById("account-hash-status");
const generateAccountHashButton = document.getElementById("generate-account-hash");
const copyAccountHashButton = document.getElementById("copy-account-hash");
const disableAccountHashButton = document.getElementById("disable-account-hash");
const accountHashDisplay = document.getElementById("account-hash-display");
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

const MAX_COMPOSER_ATTACHMENTS = 4;
const MAX_COMPOSER_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MESSAGE_FETCH_LIMIT = 80;
const MAX_MESSAGES_PER_ROOM = 2000;
const DEFAULT_MESSAGE_PLACEHOLDER = "Message the room (Enter to send, Ctrl+Enter for newline)";
const EDIT_MESSAGE_PLACEHOLDER = "Edit message (Enter to save, Esc to cancel)";
const TYPING_EVENT_THROTTLE_MS = 1200;
const TYPING_EVENT_TTL_MS = 3200;
const HEAD_SCRAPER_ENDPOINT = "https://head-scraper.aaravm.workers.dev/";
const LINK_PREVIEW_DESCRIPTION_MAX = 220;
const linkPreviewCache = new Map();

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

const normalizeMessageText = value => String(value || "").replace(/\r\n/g, "\n").slice(0, 2000).trim();
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
  input.value = next.slice(0, 2000);
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
    ? "Hash login is active. Format: word(optionalNumber)-word-word-word-number. Regenerating replaces your current hash."
    : "Generate an account hash with format word(optionalNumber)-word-word-word-number, and keep it private.";
};

const renderPasswordLoginSettings = () => {
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

const isBotAppManagerEnabled = () => Boolean(state.user && !state.user.isBot && state.user.developerMode);

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
    messageList.scrollTop = messageList.scrollHeight;
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
      messageList.scrollTop = messageList.scrollHeight;
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
    messageList.scrollTop = messageList.scrollHeight;
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
  }
  syncRoomModalForRoomCount();
};

const updateRoomPreviewFromMessage = message => {
  const roomId = String(message?.roomId || "").trim();
  if (!roomId) {
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
    state.rooms = applyStoredRoomOrder(data.rooms || []);
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
      state.messagesByRoom.set(room.id, Array.isArray(data.messages) ? data.messages : []);
      state.messageHasMoreByRoom.set(room.id, Boolean(data.messageHasMore));
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
    const olderMessages = Array.isArray(data.messages) ? data.messages : [];
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
      if (mergedText.length > 2000) {
        notify("Message is too long after adding attachment links. Remove some attachments.");
        continue;
      }

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
        messageList.scrollTop = messageList.scrollHeight;
      }

      const result = await sendMessage({
        roomId: nextMessage.roomId,
        text: mergedText
      });

      if (result?.message) {
        const optimisticId = String(optimisticMessage?.id || "");
        const replaced = optimisticMessage
          ? replaceMessageInState({
              roomId: nextMessage.roomId,
              targetMessageId: optimisticMessage.id,
              nextMessage: result.message
            })
          : false;
        const added = replaced ? false : addMessageToState(result.message);

        if ((replaced || added) && String(result.message.roomId) === String(state.activeRoomId)) {
          if (replaced && optimisticId) {
            const patched = replaceRenderedMessageTile({
              roomId: result.message.roomId,
              targetMessageId: optimisticId,
              nextMessage: result.message,
              forceScroll: true
            });
            if (!patched) {
              renderMessages();
              messageList.scrollTop = messageList.scrollHeight;
            }
          } else {
            renderMessages();
            messageList.scrollTop = messageList.scrollHeight;
          }
        }

        updateRoomPreviewFromMessage(result.message);
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

  messageEditBusy = true;
  syncComposerActionState();
  try {
    const result = await editMessageById({
      roomId: targetRoomId,
      messageId: targetMessageId,
      text
    });

    if (!result?.message) {
      throw new Error("Unable to edit message");
    }

    applyEditedMessageUpdate(result.message);
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

const bootAuthenticated = async () => {
  const data = await request("/api/me");
  state.user = data.user;
  state.rooms = applyStoredRoomOrder(data.rooms || []);
  state.botApps = [];
  state.botTokensById = new Map();
  setGeneratedAccountHash("");
  renderAccountHashSettings();
  renderPasswordLoginSettings();
  renderDeveloperModeSettings();
  renderManageAppsButton();

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

oauthButton.addEventListener("click", () => {
  window.location.href = "/auth/login";
});

accountHashLoginForm.addEventListener("submit", async event => {
  event.preventDefault();

  const accountHash = String(accountHashLoginInput.value || "").trim();
  if (!accountHash) {
    notify("Account hash is required");
    return;
  }

  accountHashLoginButton.disabled = true;
  try {
    await request("/auth/account-hash/login", {
      method: "POST",
      body: JSON.stringify({ accountHash })
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

  messageContextDeleteButton.disabled = true;
  try {
    const result = await deleteMessageById({ roomId: room.id, messageId });
    if (
      isComposerEditing() &&
      String(composerEditTarget.roomId || "") === String(result.roomId || "") &&
      String(composerEditTarget.messageId || "") === String(result.messageId || "")
    ) {
      clearComposerEditTarget();
      messageInput.value = "";
      syncMessageInputHeight();
      updateComposerPlaceholder();
    }
    const removed = removeMessageFromState(result);
    if (removed && String(result.roomId) === String(state.activeRoomId)) {
      renderMessages();
    }

    if (!socket.connected) {
      await loadRooms({ showErrors: false });
    }
  } catch (error) {
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
  if (!target || !state.user?.developerMode) {
    hideRoomContextMenu();
    return;
  }

  const roomId = String(target.getAttribute("data-room-id") || "").trim();
  if (!roomId) {
    hideRoomContextMenu();
    return;
  }

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

socket.on("rooms:update", rooms => {
  const nextRooms = applyStoredRoomOrder(Array.isArray(rooms) ? rooms : []);
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

socket.on("room:history", payload => {
  if (!payload?.roomId) {
    return;
  }

  state.messagesByRoom.set(payload.roomId, Array.isArray(payload.messages) ? payload.messages : []);
  if (typeof payload.hasMore === "boolean") {
    state.messageHasMoreByRoom.set(payload.roomId, payload.hasMore);
  }

  if (payload.roomId === state.activeRoomId) {
    renderMessages({ forceScroll: true });
    updateComposerPlaceholder();
  }
});

socket.on("message:new", message => {
  if (!message?.roomId) {
    return;
  }

  const reconciledOptimisticId = reconcileOwnOptimisticMessage(message);
  if (reconciledOptimisticId) {
    if (String(message.roomId) === String(state.activeRoomId)) {
      const patched = replaceRenderedMessageTile({
        roomId: message.roomId,
        targetMessageId: reconciledOptimisticId,
        nextMessage: message,
        forceScroll: true
      });
      if (!patched) {
        renderMessages();
        messageList.scrollTop = messageList.scrollHeight;
      }
    }
    updateRoomPreviewFromMessage(message);
    return;
  }

  const added = addMessageToState(message);
  if (!added) {
    updateRoomPreviewFromMessage(message);
    return;
  }

  if (String(message.roomId) === String(state.activeRoomId)) {
    renderMessages();
    if (message.userId === state.user?.id) {
      messageList.scrollTop = messageList.scrollHeight;
    }
    updateComposerPlaceholder();
  }

  updateRoomPreviewFromMessage(message);
});

socket.on("message:update", payload => {
  const message = payload?.message || payload;
  if (!message?.roomId || !message?.id) {
    return;
  }

  applyEditedMessageUpdate(message);
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

  if (roomId === String(state.activeRoomId || "")) {
    renderMessages();
  }
});

socket.on("room:presence", payload => {
  if (!payload?.roomId) {
    return;
  }

  state.membersByRoom.set(payload.roomId, Array.isArray(payload.members) ? payload.members : []);
  state.pendingByRoom.set(payload.roomId, Array.isArray(payload.pendingUsers) ? payload.pendingUsers : []);

  if (payload.roomId === state.activeRoomId) {
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
  try {
    await bootAuthenticated();
  } catch (error) {
    if (error.status !== 401) {
      notify(error.message);
    }

    authView.classList.remove("hidden");
    appView.classList.add("hidden");
    socket.disconnect();
  }
})();
