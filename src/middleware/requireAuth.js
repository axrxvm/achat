const createRequireAuth = ({ sessionCookie, parseCookies, getSessionUser, touchSession, clearSessionCookie }) => {
  return async (req, res, next) => {
    const sessionId = parseCookies(req.headers.cookie)[sessionCookie];
    if (!sessionId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const sessionUser = getSessionUser(sessionId);
    if (!sessionUser) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Invalid session" });
    }

    await touchSession(sessionId);
    req.sessionId = sessionId;
    req.user = sessionUser.user;
    next();
  };
};

module.exports = {
  createRequireAuth
};
