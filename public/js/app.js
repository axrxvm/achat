const state = {
  user: null,
  rooms: [],
  activeRoomId: null,
  membersByRoom: new Map(),
  pendingByRoom: new Map(),
  messagesByRoom: new Map(),
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
const connectionChip = document.getElementById("connection-chip");

const privacyToggleWrap = document.getElementById("privacy-toggle-wrap");
const privacyToggle = document.getElementById("privacy-toggle");

const memberList = document.getElementById("member-list");
const memberMeta = document.getElementById("member-meta");
const messageList = document.getElementById("message-list");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const sendMessageButton = document.getElementById("send-message");

const displayNameForm = document.getElementById("display-name-form");
const displayNameInput = document.getElementById("display-name-input");

const createRoomForm = document.getElementById("create-room-form");
const joinRoomForm = document.getElementById("join-room-form");
const openRoomModalButton = document.getElementById("open-room-modal");

const roomModal = document.getElementById("room-modal");
const roomModalBackdrop = document.getElementById("room-modal-backdrop");
const roomModalCloseButton = document.getElementById("room-modal-close");

const toast = document.getElementById("toast");
const memberContextMenu = document.getElementById("member-context-menu");
const memberContextKickButton = document.getElementById("member-context-kick");

let toastTimer = null;
let roomPollTimer = null;
let roomPollBusy = false;
let roomModalLocked = false;
let mobileDrawer = null;
let memberContextTargetUserId = null;
let forceNextMessageStickToBottom = false;
let lastRenderedMessageKey = "";
let lastRenderedMessageRoomId = null;
let draggingRoomId = null;
let dragTargetRoomId = null;
let dragTargetPosition = "before";
let suppressRoomClickUntil = 0;

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

const showMemberContextMenu = ({ x, y, userId }) => {
  memberContextTargetUserId = String(userId || "");
  if (!memberContextTargetUserId) {
    hideMemberContextMenu();
    return;
  }

  memberContextMenu.classList.remove("hidden");
  memberContextMenu.setAttribute("aria-hidden", "false");
  memberContextMenu.style.left = "0px";
  memberContextMenu.style.top = "0px";

  const rect = memberContextMenu.getBoundingClientRect();
  const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
  const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
  const nextLeft = Math.min(Math.max(8, x), maxLeft);
  const nextTop = Math.min(Math.max(8, y), maxTop);

  memberContextMenu.style.left = `${nextLeft}px`;
  memberContextMenu.style.top = `${nextTop}px`;
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
  sendMessageButton.disabled = !enabled;
  if (!enabled) {
    messageInput.value = "";
  }
};

const openRoomModal = ({ locked = false } = {}) => {
  closeMobileDrawer();
  hideMemberContextMenu();

  const wasHidden = roomModal.classList.contains("hidden");
  roomModalLocked = locked;
  roomModal.classList.toggle("locked", roomModalLocked);
  roomModal.setAttribute("aria-hidden", "false");

  if (!wasHidden) {
    return;
  }

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
        await loadActiveRoomSnapshot({ showErrors: false, joinSocket: false });
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
            <span class="member-name">${escapeHtml(member.displayName)}</span>
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
                  <span class="member-name">${escapeHtml(entry.displayName)}</span>
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

const renderMessages = ({ forceScroll = false } = {}) => {
  const room = getActiveRoom();
  const roomId = state.activeRoomId;
  const messages = state.messagesByRoom.get(roomId) || [];

  if (!room) {
    const nextKey = "no-room";
    if (nextKey !== lastRenderedMessageKey) {
      messageList.innerHTML = '<div class="empty-chat">Pick a room or create one to start chatting.</div>';
      lastRenderedMessageKey = nextKey;
      lastRenderedMessageRoomId = null;
    }
    forceNextMessageStickToBottom = false;
    return;
  }

  if (!roomCanChat(room) || !state.activeRoomCanAccess) {
    const nextKey = `locked:${roomId}:${room.accessStatus || "none"}`;
    if (nextKey !== lastRenderedMessageKey) {
      messageList.innerHTML =
        '<div class="room-locked">This is a private room. Your request is pending owner approval, so chat is locked.</div>';
      lastRenderedMessageKey = nextKey;
      lastRenderedMessageRoomId = roomId;
    }
    forceNextMessageStickToBottom = false;
    return;
  }

  if (messages.length === 0) {
    const nextKey = `empty:${roomId}`;
    if (nextKey !== lastRenderedMessageKey) {
      messageList.innerHTML = '<div class="empty-chat">No messages yet. Say hi.</div>';
      lastRenderedMessageKey = nextKey;
      lastRenderedMessageRoomId = roomId;
    }
    forceNextMessageStickToBottom = false;
    return;
  }

  const lastMessage = messages[messages.length - 1];
  const nextKey = `filled:${roomId}:${messages.length}:${lastMessage?.id || ""}:${lastMessage?.createdAt || ""}:${lastMessage?.userId || ""}`;
  const roomChanged = lastRenderedMessageRoomId !== roomId;
  const shouldStickToBottom = forceScroll || forceNextMessageStickToBottom || roomChanged || isMessageListNearBottom();

  if (nextKey === lastRenderedMessageKey && !forceScroll && !forceNextMessageStickToBottom) {
    return;
  }

  messageList.innerHTML = messages
    .map(message => {
      const isSelf = message.userId === state.user?.id;
      return `
        <article class="message ${isSelf ? "self" : ""}">
          <header>
            <span class="author">${escapeHtml(message.username)}</span>
            <time>${formatTime(message.createdAt)}</time>
          </header>
          <p>${escapeHtml(message.text)}</p>
        </article>
      `;
    })
    .join("");

  if (shouldStickToBottom) {
    messageList.scrollTop = messageList.scrollHeight;
  }

  forceNextMessageStickToBottom = false;
  lastRenderedMessageKey = nextKey;
  lastRenderedMessageRoomId = roomId;
};

const renderRoomHeader = () => {
  const room = getActiveRoom();

  if (!room) {
    activeRoomName.textContent = "Select a room";
    activeRoomMeta.textContent = "No room selected";
    leaveRoomButton.classList.add("hidden");
    privacyToggleWrap.classList.add("hidden");
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
    privacyToggleWrap.classList.add("hidden");
    state.activeRoomCanAccess = false;
    state.activeRoomAccessStatus = "pending";
    setComposerState(false);
    return;
  }

  leaveRoomButton.textContent = "Leave Room";
  leaveRoomButton.classList.remove("hidden");
  state.activeRoomCanAccess = true;
  state.activeRoomAccessStatus = "member";
  activeRoomMeta.textContent = `ID ${room.id} · ${isPrivateLabel} · owner ${room.ownerDisplayName}`;
  setComposerState(true);

  if (activeRoomIsOwner()) {
    privacyToggleWrap.classList.remove("hidden");
    privacyToggle.checked = Boolean(room.isPrivate);
  } else {
    privacyToggleWrap.classList.add("hidden");
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

const renderRooms = () => {
  userChip.textContent = state.user ? `${state.user.displayName} · ${state.user.id}` : "";

  if (state.user && document.activeElement !== displayNameInput) {
    displayNameInput.value = state.user.displayName;
  }

  ensureActiveRoom();

  if (state.rooms.length === 0) {
    roomList.innerHTML = '<p class="empty">No rooms yet. Create one.</p>';
    renderRoomHeader();
    renderMessages();
    renderMembers();
    syncRoomModalForRoomCount();
    return;
  }

  roomList.innerHTML = state.rooms
    .map(room => {
      const active = room.id === state.activeRoomId;
      const pending = room.accessStatus === "pending";
      const roomType = room.isPrivate ? "private" : "public";
      const preview = pending
        ? "Waiting for owner approval"
        : room.latestMessage
          ? `${room.latestMessage.username || "Unknown"}: ${room.latestMessage.text}`
          : "No messages yet";
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

  renderRoomHeader();
  renderMessages();
  renderMembers();
  syncRoomModalForRoomCount();
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

const loadActiveRoomSnapshot = async ({ showErrors = true, joinSocket = true } = {}) => {
  const room = getActiveRoom();
  if (!room) {
    emitPresenceState();
    return;
  }

  try {
    const data = await request(`/api/rooms/${room.id}`);
    state.activeRoomCanAccess = Boolean(data.canAccess);
    state.activeRoomAccessStatus = data.accessStatus || "none";

    state.messagesByRoom.set(room.id, Array.isArray(data.messages) ? data.messages : []);
    state.membersByRoom.set(room.id, Array.isArray(data.members) ? data.members : []);
    state.pendingByRoom.set(room.id, Array.isArray(data.pendingUsers) ? data.pendingUsers : []);

    renderRoomHeader();
    renderMessages();
    renderMembers();

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
  hideMemberContextMenu();
  forceNextMessageStickToBottom = true;
  state.activeRoomId = roomId;
  renderRooms();
  await loadActiveRoomSnapshot({ showErrors: true, joinSocket: true });
  scheduleRoomPolling();
};

const sendMessageViaHttp = async ({ roomId, text }) => {
  await request(`/api/rooms/${roomId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text })
  });
};

const sendMessage = async ({ roomId, text }) => {
  if (socket.connected) {
    try {
      await emitWithAck("message:send", { roomId, text });
      return "socket";
    } catch (error) {
      await sendMessageViaHttp({ roomId, text });
      return "http";
    }
  }

  await sendMessageViaHttp({ roomId, text });
  return "http";
};

const refreshRoomsAndActive = async () => {
  await loadRooms({ showErrors: false });
  await loadActiveRoomSnapshot({ showErrors: false, joinSocket: false });
};

const bootAuthenticated = async () => {
  const data = await request("/api/me");
  state.user = data.user;
  state.rooms = applyStoredRoomOrder(data.rooms || []);

  authView.classList.add("hidden");
  appView.classList.remove("hidden");

  renderRooms();
  await loadActiveRoomSnapshot({ showErrors: false, joinSocket: false });
  scheduleRoomPolling();

  if (!socket.connected) {
    setConnectionStatus("syncing");
    socket.connect();
  }
};

oauthButton.addEventListener("click", () => {
  window.location.href = "/auth/login";
});

logoutButton.addEventListener("click", async () => {
  try {
    await request("/auth/logout", { method: "POST" });
    socket.disconnect();
    window.location.href = "/";
  } catch (error) {
    notify(error.message);
  }
});

openRoomModalButton.addEventListener("click", () => {
  openRoomModal({ locked: state.rooms.length === 0 });
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

document.addEventListener("click", event => {
  if (!event.target.closest("#member-context-menu")) {
    hideMemberContextMenu();
  }
});

window.addEventListener("keydown", event => {
  if (event.key === "Escape" && mobileDrawer) {
    closeMobileDrawer();
    return;
  }

  if (event.key === "Escape") {
    hideMemberContextMenu();
    closeRoomModal();
  }
});

window.addEventListener("resize", () => {
  hideMemberContextMenu();
  if (!isMobileLayout()) {
    closeMobileDrawer();
  }
});

window.addEventListener("focus", () => {
  emitPresenceState();
  scheduleRoomPolling();
});

window.addEventListener("blur", () => {
  emitPresenceState();
  scheduleRoomPolling();
});

document.addEventListener("visibilitychange", () => {
  emitPresenceState();
  scheduleRoomPolling();
});

window.addEventListener("scroll", hideMemberContextMenu, true);

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
  if (!room || !activeRoomIsOwner() || !roomCanChat(room)) {
    hideMemberContextMenu();
    return;
  }

  const targetUserId = String(row.getAttribute("data-member-user-id") || "");
  if (!targetUserId || targetUserId === room.ownerUserId) {
    hideMemberContextMenu();
    return;
  }

  event.preventDefault();
  showMemberContextMenu({
    x: event.clientX,
    y: event.clientY,
    userId: targetUserId
  });
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
  } catch (error) {
    notify(error.message);
  } finally {
    privacyToggle.disabled = false;
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

createRoomForm.addEventListener("submit", async event => {
  event.preventDefault();

  const form = new FormData(createRoomForm);
  const name = String(form.get("name") || "").trim();
  const isPrivate = form.get("isPrivate") === "on";

  if (!name) {
    notify("Room name is required");
    return;
  }

  try {
    const result = await request("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ name, isPrivate })
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
      notify("Join request sent. Waiting for owner approval.");
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
    await request(`/api/rooms/${room.id}/leave`, { method: "POST" });
    state.membersByRoom.delete(room.id);
    state.pendingByRoom.delete(room.id);
    state.messagesByRoom.delete(room.id);

    await loadRooms({ showErrors: false });
    await loadActiveRoomSnapshot({ showErrors: false, joinSocket: true });
    scheduleRoomPolling();
  } catch (error) {
    notify(error.message);
  }
});

messageForm.addEventListener("submit", async event => {
  event.preventDefault();

  const room = getActiveRoom();
  if (!room || !roomCanChat(room) || !state.activeRoomCanAccess) {
    return;
  }

  const text = String(messageInput.value || "").trim();
  if (!text) {
    return;
  }

  sendMessageButton.disabled = true;

  try {
    forceNextMessageStickToBottom = true;
    const transport = await sendMessage({ roomId: room.id, text });
    messageInput.value = "";
    messageInput.focus();

    if (transport === "http") {
      await loadRooms({ showErrors: false });
      await loadActiveRoomSnapshot({ showErrors: false, joinSocket: false });
    }
  } catch (error) {
    notify(error.message || "Unable to send message");
  } finally {
    setComposerState(Boolean(getActiveRoom() && roomCanChat(getActiveRoom()) && state.activeRoomCanAccess));
  }
});

socket.on("connect", async () => {
  setConnectionStatus("online");
  scheduleRoomPolling();
  await joinActiveRoom();
});

socket.on("disconnect", () => {
  setConnectionStatus("offline");
  scheduleRoomPolling();
});

socket.on("connect_error", () => {
  setConnectionStatus("offline");
  notify("Realtime socket failed. Using HTTP fallback.");
});

socket.on("rooms:update", rooms => {
  const previousRooms = state.rooms;
  const previousActive = state.activeRoomId;
  const previousActiveRoom = previousRooms.find(room => room.id === previousActive) || null;
  state.rooms = applyStoredRoomOrder(Array.isArray(rooms) ? rooms : []);
  renderRooms();

  if (!state.activeRoomId) {
    emitPresenceState();
    return;
  }

  const nextActiveRoom = state.rooms.find(room => room.id === state.activeRoomId) || null;
  const accessChanged =
    previousActiveRoom?.accessStatus !== nextActiveRoom?.accessStatus ||
    previousActiveRoom?.pendingCount !== nextActiveRoom?.pendingCount ||
    previousActiveRoom?.memberCount !== nextActiveRoom?.memberCount;

  if (previousActive !== state.activeRoomId || !state.messagesByRoom.has(state.activeRoomId) || accessChanged) {
    loadActiveRoomSnapshot({
      showErrors: false,
      joinSocket: Boolean(nextActiveRoom && nextActiveRoom.accessStatus === "member")
    });
  }
});

socket.on("room:history", payload => {
  if (!payload?.roomId) {
    return;
  }

  state.messagesByRoom.set(payload.roomId, Array.isArray(payload.messages) ? payload.messages : []);

  if (payload.roomId === state.activeRoomId) {
    renderMessages({ forceScroll: true });
  }
});

socket.on("message:new", message => {
  if (!message?.roomId) {
    return;
  }

  const existing = state.messagesByRoom.get(message.roomId) || [];
  existing.push(message);
  state.messagesByRoom.set(message.roomId, existing.slice(-500));

  if (message.roomId === state.activeRoomId) {
    renderMessages({ forceScroll: message.userId === state.user?.id });
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
  }
});

syncMobileDrawerUi();
setConnectionStatus("syncing");
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
