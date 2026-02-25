const path = require("path");

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
const SESSION_COOKIE_MAX_AGE_DAYS = Math.max(1, Number(process.env.SESSION_COOKIE_MAX_AGE_DAYS || 30));
const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
const PUBLIC_DIR = path.join(__dirname, "../public");

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
  PUBLIC_DIR
};
