const getBearerToken = authorizationHeader => {
  const raw = String(authorizationHeader || "").trim();
  if (!raw) {
    return "";
  }

  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
};

const createRequireAuth = ({
  sessionCookie,
  parseCookies,
  getSessionUser,
  touchSession,
  clearSessionCookie,
  authenticateBotToken
}) => {
  return async (req, res, next) => {
    const sessionId = parseCookies(req.headers.cookie)[sessionCookie];
    if (!sessionId) {
      const bearerToken = getBearerToken(req.headers.authorization);
      if (bearerToken && typeof authenticateBotToken === "function") {
        const botUser = await authenticateBotToken(bearerToken);
        if (botUser) {
          req.sessionId = null;
          req.user = botUser;
          req.authType = "bot";
          req.isBotUser = true;
          return next();
        }
      }

      return res.status(401).json({ error: "Authentication required" });
    }

    const sessionUser = getSessionUser(sessionId);
    if (!sessionUser) {
      clearSessionCookie(res);
      const bearerToken = getBearerToken(req.headers.authorization);
      if (bearerToken && typeof authenticateBotToken === "function") {
        const botUser = await authenticateBotToken(bearerToken);
        if (botUser) {
          req.sessionId = null;
          req.user = botUser;
          req.authType = "bot";
          req.isBotUser = true;
          return next();
        }
      }

      return res.status(401).json({ error: "Invalid session" });
    }

    await touchSession(sessionId);
    req.sessionId = sessionId;
    req.user = sessionUser.user;
    req.authType = "session";
    req.isBotUser = Boolean(sessionUser.user?.isBot);
    next();
  };
};

module.exports = {
  createRequireAuth
};
