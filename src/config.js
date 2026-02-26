const path = require("path");

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const PORT = Number(process.env.PORT || 8070);
const HOST = process.env.HOST || "0.0.0.0";
const APP_BASE_URL = process.env.APP_BASE_URL
  ? String(process.env.APP_BASE_URL).trim().replace(/\/+$/, "")
  : "";
const OAUTH_BASE = process.env.ALABS_WORKER_BASE || "https://oauth2.axrxvm.workers.dev";
const OAUTH_APP_ID = process.env.ALABS_APP_ID || "AChat";
const OAUTH_PROVIDERS = (process.env.ALABS_PROVIDERS || "discord,google,github")
  .split(",")
  .map(provider => provider.trim())
  .filter(Boolean);
const SESSION_COOKIE = "achat_session";
const SESSION_COOKIE_MAX_AGE_DAYS = Math.max(1, toPositiveNumber(process.env.SESSION_COOKIE_MAX_AGE_DAYS, 30));
const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
const REQUEST_JSON_LIMIT = String(process.env.REQUEST_JSON_LIMIT || "80mb").trim() || "80mb";
const PUBLIC_DIR = path.join(__dirname, "../public");
const MONGODB_MAIN_DB_URL = String(process.env.MONGODB_MAIN_DB_URL || "").trim();
const MONGODB_MESSAGE_DB_URL = String(
  process.env.MONGODB_MESSAGE_DB_URL || process.env.MONGODB_MESSAGES_DB_URL || ""
).trim();
const MONGODB_MAIN_DB_NAME = String(process.env.MONGODB_MAIN_DB_NAME || "").trim();
const MONGODB_MESSAGE_DB_NAME = String(process.env.MONGODB_MESSAGE_DB_NAME || "").trim();
const CATBOX_USER_HASH = String(process.env.CATBOX_USER_HASH || "").trim();
const CATBOX_MAX_FILE_BYTES = Math.max(1024, toPositiveNumber(process.env.CATBOX_MAX_FILE_BYTES, 12 * 1024 * 1024));
const CATBOX_MAX_FILES_PER_UPLOAD = Math.max(1, toPositiveNumber(process.env.CATBOX_MAX_FILES_PER_UPLOAD, 4));

module.exports = {
  PORT,
  HOST,
  APP_BASE_URL,
  OAUTH_BASE,
  OAUTH_APP_ID,
  OAUTH_PROVIDERS,
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE_DAYS,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  REQUEST_JSON_LIMIT,
  PUBLIC_DIR,
  MONGODB_MAIN_DB_URL,
  MONGODB_MESSAGE_DB_URL,
  MONGODB_MAIN_DB_NAME,
  MONGODB_MESSAGE_DB_NAME,
  CATBOX_USER_HASH,
  CATBOX_MAX_FILE_BYTES,
  CATBOX_MAX_FILES_PER_UPLOAD
};
