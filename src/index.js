require("dotenv").config();

const http = require("http");
const express = require("express");
const socketio = require("socket.io");

const config = require("./config");
const store = require("./store");
const { getRequestBaseUrl } = require("./lib/baseUrl");
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

app.set("trust proxy", true);
app.use(express.json({ limit: config.REQUEST_JSON_LIMIT }));
app.use(express.static(config.PUBLIC_DIR));

const requireAuth = createRequireAuth({
  sessionCookie: config.SESSION_COOKIE,
  parseCookies,
  getSessionUser: store.getSessionUser,
  touchSession: store.touchSession,
  clearSessionCookie: res => clearSessionCookie(res, config.SESSION_COOKIE),
  authenticateBotToken: store.authenticateBotToken
});

const realtime = setupRealtime({
  io,
  sessionCookie: config.SESSION_COOKIE,
  parseCookies,
  getSessionUser: store.getSessionUser,
  touchSession: store.touchSession,
  authenticateBotToken: store.authenticateBotToken,
  listRoomsForUser: store.listRoomsForUser,
  getRoomUserIds: store.getRoomUserIds,
  getRoomById: store.getRoomById,
  getRoomMembers: store.getRoomMembers,
  getRoomPendingUsers: store.getRoomPendingUsers,
  getRoomAccessForUser: store.getRoomAccessForUser,
  getMessagesPageForRoom: store.getMessagesPageForRoom,
  addMessage: store.addMessage,
  editMessage: store.editMessage
});

registerRoutes({
  app,
  io,
  requireAuth,
  fetchSignupUrl: req => {
    const requestBaseUrl = getRequestBaseUrl({
      req,
      appBaseUrl: config.APP_BASE_URL,
      port: config.PORT
    });

    return fetchSignupUrl({
      oauthBase: config.OAUTH_BASE,
      oauthAppId: config.OAUTH_APP_ID,
      redirectUrl: `${requestBaseUrl}/auth/callback`,
      oauthProviders: config.OAUTH_PROVIDERS
    });
  },
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
    const baseUrl = config.APP_BASE_URL || `http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}`;
    console.log(`[INFO] Running on ${baseUrl}`);
  });
};

start().catch(error => {
  console.error("[ERROR] Failed to start server", error);
  process.exit(1);
});
