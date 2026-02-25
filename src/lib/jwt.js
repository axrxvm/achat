const decodeJwtPayload = token => {
  const parts = String(token || "").split(".");
  if (parts.length < 2) {
    throw new Error("Invalid token format");
  }

  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const normalizedPayload = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  const json = Buffer.from(normalizedPayload, "base64").toString("utf8");
  return JSON.parse(json);
};

module.exports = {
  decodeJwtPayload
};
