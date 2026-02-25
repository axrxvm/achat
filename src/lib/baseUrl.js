const firstHeaderValue = value =>
  String(value || "")
    .split(",")[0]
    .trim();

const normalizeProto = value => {
  const lowered = String(value || "").trim().toLowerCase();
  return lowered === "https" ? "https" : "http";
};

const getRequestBaseUrl = ({ req, appBaseUrl, port }) => {
  if (appBaseUrl) {
    return String(appBaseUrl).trim().replace(/\/+$/, "");
  }

  const forwardedProto = firstHeaderValue(req.headers["x-forwarded-proto"]);
  const forwardedHost = firstHeaderValue(req.headers["x-forwarded-host"]);
  const directHost = firstHeaderValue(req.headers.host);

  const proto = normalizeProto(forwardedProto || (req.secure ? "https" : "http"));
  const host = forwardedHost || directHost || `localhost:${Number(port) || 80}`;

  return `${proto}://${host}`;
};

module.exports = {
  getRequestBaseUrl
};
