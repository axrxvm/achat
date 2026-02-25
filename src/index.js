require("dotenv").config();

const http = require("http");
const express = require("express");
const socketio = require("socket.io");

const config = require("./config");
const store = require("./store");
const { parseCookies, setSessionCookie, clearSessionCookie } = require("./lib/cookies");
const { decodeJwtPayload } = require("./lib/jwt");
const { createRequireAuth } = require("./middleware/requireAuth");
const { fetchSignupUrl } = require("./oauth");
const { setupRealtime } = require("./realtime");
const { registerRoutes } = require("./routes");

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

app.use(express.json());
app.use(express.static(config.PUBLIC_DIR));

const requireAuth = createRequireAuth({
  sessionCookie: config.SESSION_COOKIE,
  parseCookies,
  getSessionUser: store.getSessionUser,
  touchSession: store.touchSession,
  clearSessionCookie: res => clearSessionCookie(res, config.SESSION_COOKIE)
});

const realtime = setupRealtime({
  io,
  sessionCookie: config.SESSION_COOKIE,
  parseCookies,
  getSessionUser: store.getSessionUser,
  touchSession: store.touchSession,
  listRoomsForUser: store.listRoomsForUser,
  getRoomUserIds: store.getRoomUserIds,
  getRoomById: store.getRoomById,
  getRoomMembers: store.getRoomMembers,
  getRoomPendingUsers: store.getRoomPendingUsers,
  getRoomAccessForUser: store.getRoomAccessForUser,
  getMessagesForRoom: store.getMessagesForRoom,
  addMessage: store.addMessage
});

registerRoutes({
  app,
  io,
  requireAuth,
  fetchSignupUrl: () =>
    fetchSignupUrl({
      oauthBase: config.OAUTH_BASE,
      oauthAppId: config.OAUTH_APP_ID,
      appBaseUrl: config.APP_BASE_URL,
      oauthProviders: config.OAUTH_PROVIDERS
    }),
  decodeJwtPayload,
  setSessionCookie: (res, value) =>
    setSessionCookie(res, config.SESSION_COOKIE, value, config.SESSION_COOKIE_MAX_AGE_SECONDS),
  clearSessionCookie: res => clearSessionCookie(res, config.SESSION_COOKIE),
  realtime,
  store
});

const start = async () => {
  await store.ensureStore();

  server.listen(config.PORT, config.HOST, () => {
    console.log(`[INFO] Running on ${config.APP_BASE_URL}`);
  });
};

start().catch(error => {
  console.error("[ERROR] Failed to start server", error);
  process.exit(1);
});
