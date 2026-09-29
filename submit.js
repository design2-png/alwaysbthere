/* POST /api/submit
   mode:"check"  → 上傳照片前先檢查 Email／手機／照片是否已投稿過（省得白傳）
   mode:"submit" → 驗證 → 確認照片在 Cloudinary → 再查一次重複 → 寫進 Airtable（預設公開） */
const {
  F, airtable, findDuplicates, getResource, destroyResource, imgUrl,
  validate, isOpen, send, readJson, ipHash, rateLimited, verifyTurnstile
} = require("../lib/core");

const DUP_MSG = { email: "這組 Email 已經投稿過了", phone: "這支手機已經投稿過了", photo: "這張照片已經投稿過了" };

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  if (!isOpen()) return send(res, 403, { error: "closed", message: "目前不在徵件期間" });

  let b;
  try { b = await readJson(req); } catch (e) { return send(res, e.status || 400, { error: "bad_request" }); }

  /* 機器人：隱藏欄位有填、或從開啟表單到送出不到 4 秒 */
  if (b.hp || (b.t && Date.now() - Number(b.t) < 4000)) return send(res, 400, { error: "bot" });

  const ip = ipHash(req);
  const { d, err } = validate(b);
  if (Object.keys(err).length) return send(res, 422, { error: "invalid", fields: err });

  try {
    if (b.mode === "check") {
      if (rateLimited("check:" + ip, 20)) return send(res, 429, { error: "rate", message: "操作太頻繁，請稍後再試" });
      const dup = await findDuplicates(d);
      const fields = Object.fromEntries(Object.entries(dup).filter(([, v]) => v).map(([k]) => [k, DUP_MSG[k]]));
      return Object.keys(fields).length ? send(res, 409, { error: "duplicate", fields }) : send(res, 200, { ok: true });
    }

    if (rateLimited("submit:" + ip, 6)) return send(res, 429, { error: "rate", message: "操作太頻繁，請稍後再試" });
    if (!(await verifyTurnstile(b.turnstile, req))) return send(res, 400, { error: "captcha", message: "請再驗證一次" });

    const photo = await getResource(String(b.publicId || ""));
    if (!photo) return send(res, 422, { error: "invalid", fields: { photo: "請上傳一張照片" } });

    /* 照片指紋：前端算的原檔 SHA-256 + Cloudinary 的 etag，兩個都查 */
    const dup = await findDuplicates({ ...d, hashes: [d.hash, photo.etag] });
    if (dup.email || dup.phone || dup.photo) {
      await destroyResource(photo.public_id);
      const fields = Object.fromEntries(Object.entries(dup).filter(([, v]) => v).map(([k]) => [k, DUP_MSG[k]]));
      return send(res, 409, { error: "duplicate", fields });
    }

    const rec = await airtable("", {
      method: "POST",
      body: JSON.stringify({
        typecast: true,
        records: [{
          fields: {
            [F.name]: d.name, [F.since]: d.since, [F.product]: d.product,
            [F.story]: d.story, [F.title]: d.title, [F.email]: d.email, [F.phone]: d.phone,
            [F.photo]: [{ url: imgUrl(photo.public_id), filename: `${photo.public_id.split("/").pop()}.jpg` }],
            [F.photoId]: photo.public_id, [F.photoW]: photo.width, [F.photoH]: photo.height,
            [F.photoHash]: [d.hash, photo.etag].filter(Boolean).join(" "),
            [F.isPublic]: true, [F.agree]: true, [F.ipHash]: ip
          }
        }]
      })
    });
    const f = rec.records[0].fields;
    send(res, 200, { ok: true, no: f[F.no], id: rec.records[0].id }, { "Cache-Control": "no-store" });
  } catch (e) {
    send(res, e.status || 500, { error: "server", message: "系統忙碌中，請稍後再試一次" });
  }
};
