/* POST /api/sign — 發給前端一次性的 Cloudinary 上傳簽章（金鑰不離開伺服器） */
const { signUpload, isOpen, send, ipHash, rateLimited } = require("../lib/core");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  if (!isOpen()) return send(res, 403, { error: "closed" });
  if (rateLimited("sign:" + ipHash(req), 12)) return send(res, 429, { error: "rate" });
  try { send(res, 200, signUpload(), { "Cache-Control": "no-store" }); }
  catch (e) { send(res, e.status || 500, { error: "sign_failed" }); }
};
