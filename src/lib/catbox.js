const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

let catboxConstructorPromise = null;
let catboxImportFailed = false;

const sanitizeFilename = value => {
  const normalized = String(value || "attachment.bin")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .trim();

  return normalized || "attachment.bin";
};

const getCatboxConstructor = async () => {
  if (!catboxConstructorPromise) {
    catboxConstructorPromise = import("node-catbox")
      .then(module => module.Catbox || module.default?.Catbox || module.default)
      .catch(() => {
        catboxImportFailed = true;
        return null;
      });
  }

  return catboxConstructorPromise;
};

const createCatboxClient = async userHash => {
  const Catbox = await getCatboxConstructor();
  if (!Catbox) {
    return null;
  }
  return userHash ? new Catbox(userHash) : new Catbox();
};

const uploadBufferToCatbox = async ({ buffer, filename, userHash = "", maxFileBytes }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("File payload is empty");
  }

  const safeFilename = sanitizeFilename(filename);
  const tempPath = path.join(os.tmpdir(), `achat-upload-${crypto.randomUUID()}-${safeFilename}`);

  await fs.writeFile(tempPath, buffer);

  try {
    const catbox = await createCatboxClient(userHash);
    if (catbox) {
      return await catbox.uploadFile({
        path: tempPath,
        maxFileBytes
      });
    }

    const form = new FormData();
    form.append("reqtype", "fileupload");
    if (userHash) {
      form.append("userhash", userHash);
    }
    form.append("fileToUpload", new Blob([buffer]), safeFilename);

    const response = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: form
    });

    const text = (await response.text()).trim();
    if (!response.ok || !/^https?:\/\//i.test(text)) {
      const fallbackMessage = catboxImportFailed
        ? "node-catbox not installed and direct upload failed"
        : "Catbox upload failed";
      throw new Error(text || fallbackMessage);
    }

    return text;
  } finally {
    fs.unlink(tempPath).catch(() => {});
  }
};

module.exports = {
  uploadBufferToCatbox
};
