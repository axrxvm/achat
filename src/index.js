require("dotenv").config();

const http = require("http");
const express = require("express");
const socketio = require("socket.io");

const config = require("./config");
const store = require("./store");
const { parseCookies, setSessionCookie, clearSessionCookie } = require("./lib/cookies");
const { createRateLimiter } = require("./middleware/rateLimit");
const { createRequireAuth } = require("./middleware/requireAuth");
const { applySecurityHeaders } = require("./middleware/securityHeaders");
const { setupRealtime } = require("./realtime");
const { registerRoutes } = require("./routes");

const app = express();
const server = http.createServer(app);
let isShuttingDown = false;
let isStoreReady = false;
let lastStoreInitError = null;
const io = socketio(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

app.disable("x-powered-by");
app.set("trust proxy", config.TRUST_PROXY);
app.use(applySecurityHeaders);
app.use(express.json({ limit: config.REQUEST_JSON_LIMIT }));

const authRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 40,
  keyGenerator: req => req.ip || req.headers["x-forwarded-for"] || "unknown"
});
app.use("/auth", authRateLimiter);

app.get("/healthz", (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ ok: false, status: "shutting_down" });
  }

  return res.json({ ok: true, status: "healthy" });
});

app.get("/readyz", (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ ok: false, status: "shutting_down" });
  }

  if (!isStoreReady) {
    return res.status(503).json({
      ok: false,
      status: "initializing_store",
      error: lastStoreInitError ? String(lastStoreInitError.message || "store init failed") : null
    });
  }

  return res.json({ ok: true, status: "ready" });
});

app.use((req, res, next) => {
  const pathname = String(req.path || "");
  const allowWithoutStore = pathname === "/healthz" || pathname === "/readyz";
  if (allowWithoutStore || isStoreReady) {
    return next();
  }

  return res.status(503).json({ error: "Service is starting. Please retry shortly." });
});

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
  setSessionCookie: (res, value) =>
    setSessionCookie(res, config.SESSION_COOKIE, value, config.SESSION_COOKIE_MAX_AGE_SECONDS),
  clearSessionCookie: res => clearSessionCookie(res, config.SESSION_COOKIE),
  realtime,
  store
});

const wait = ms =>
  new Promise(resolve => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });

const initializeStoreLoop = async () => {
  while (!isShuttingDown && !isStoreReady) {
    try {
      await store.ensureStore();
      isStoreReady = true;
      lastStoreInitError = null;
      console.log("[INFO] Store initialized successfully");
      return;
    } catch (error) {
      lastStoreInitError = error;
      console.error("[ERROR] Store initialization failed. Retrying in 5s...", error);
      await wait(5000);
    }
  }
};

const start = async () => {
  server.listen(config.PORT, config.HOST, () => {
    const baseUrl = config.APP_BASE_URL || `http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}`;
    console.log(`[INFO] Running on ${baseUrl}`);
  });

  void initializeStoreLoop();
};

const shutdown = signal => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`[INFO] Received ${signal}. Shutting down gracefully...`);

  server.close(error => {
    if (error) {
      console.error("[ERROR] Failed to close server cleanly", error);
      process.exit(1);
      return;
    }

    process.exit(0);
  });

  setTimeout(() => {
    console.error("[ERROR] Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("uncaughtException", error => {
  console.error("[ERROR] Uncaught exception", error);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", reason => {
  console.error("[ERROR] Unhandled promise rejection", reason);
  shutdown("unhandledRejection");
});

start().catch(error => {
  console.error("[ERROR] Failed to start server", error);
  process.exit(1);
});
