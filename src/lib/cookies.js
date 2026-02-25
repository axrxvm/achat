const parseCookies = cookieHeader => {
  const result = {};
  const raw = String(cookieHeader || "");

  for (const item of raw.split(";")) {
    const [key, ...parts] = item.trim().split("=");
    if (!key) {
      continue;
    }

    result[key] = decodeURIComponent(parts.join("=") || "");
  }

  return result;
};

const setSessionCookie = (res, cookieName, value, maxAgeSeconds) => {
  const normalizedMaxAgeSeconds = Math.max(1, Number(maxAgeSeconds) || 0);
  const expiresAt = new Date(Date.now() + normalizedMaxAgeSeconds * 1000).toUTCString();
  const cookieParts = [
    `${cookieName}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${normalizedMaxAgeSeconds}`,
    `Expires=${expiresAt}`
  ];
  if (process.env.NODE_ENV === "production") {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
};

const clearSessionCookie = (res, cookieName) => {
  const cookieParts = [
    `${cookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  ];

  if (process.env.NODE_ENV === "production") {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
};

module.exports = {
  parseCookies,
  setSessionCookie,
  clearSessionCookie
};
