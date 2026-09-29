/* 後端共用：Airtable、Cloudinary、驗證工具。不需額外套件（Node 18+ 內建 fetch / crypto）。 */
const crypto = require("crypto");
const CFG = require("../public/config.js");

const env = (k, d) => process.env[k] ?? d;

/* ---------- Airtable 欄位名稱（和 base 裡的欄位名稱一字不差） ---------- */
const F = {
  no: "投稿編號",        // Autonumber
  name: "暱稱",
  since: "開始使用年份",
  product: "產品",
  story: "故事",
  title: "一句話",
  email: "Email",
  phone: "手機",
  photo: "照片",          // Attachment（後台可直接看、下載）
  photoId: "照片 ID",     // Cloudinary public_id
  photoW: "照片寬",
  photoH: "照片高",
  photoHash: "照片指紋",   // 防同一張照片重複投稿
  isPublic: "公開",        // Checkbox，投稿時預設勾選
  agree: "同意條款",       // Checkbox
  ipHash: "來源指紋",
  created: "投稿時間"      // Created time
};

const AT = () => ({
  base: env("AIRTABLE_BASE_ID"),
  table: env("AIRTABLE_TABLE", "投稿"),
  token: env("AIRTABLE_TOKEN")
});

async function airtable(path, opts = {}) {
  const { base, table, token } = AT();
  if (!base || !token) throw Object.assign(new Error("Airtable 尚未設定"), { status: 503 });
  const url = `https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}${path}`;
  const r = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || `Airtable ${r.status}`), { status: 502, detail: j });
  return j;
}

/* 公式裡的字串要跳脫 */
const q = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

async function findDuplicates({ email, phone, hash, hashes }) {
  const hs = [...new Set([hash, ...(hashes || [])].filter(Boolean))];
  const ors = [`LOWER({${F.email}})=${q(email.toLowerCase())}`, `{${F.phone}}=${q(phone)}`];
  for (const h of hs) ors.push(`FIND(${q(h)},{${F.photoHash}})`);
  const formula = `OR(${ors.join(",")})`;
  const j = await airtable(`?maxRecords=5&filterByFormula=${encodeURIComponent(formula)}&fields%5B%5D=${encodeURIComponent(F.email)}&fields%5B%5D=${encodeURIComponent(F.phone)}&fields%5B%5D=${encodeURIComponent(F.photoHash)}`);
  const dup = { email: false, phone: false, photo: false };
  for (const r of j.records || []) {
    const f = r.fields || {};
    if ((f[F.email] || "").toLowerCase() === email.toLowerCase()) dup.email = true;
    if (f[F.phone] === phone) dup.phone = true;
    if (hs.some((h) => String(f[F.photoHash] || "").includes(h))) dup.photo = true;
  }
  return dup;
}

/* 公開的故事（只回傳可公開欄位；Email、手機永遠不出後端） */
async function listPublic() {
  const out = [];
  let offset = "";
  const fields = [F.no, F.name, F.since, F.product, F.story, F.title, F.photoId, F.photoW, F.photoH, F.created]
    .map((f) => `fields%5B%5D=${encodeURIComponent(f)}`).join("&");
  const formula = encodeURIComponent(`{${F.isPublic}}`);
  do {
    const j = await airtable(`?pageSize=100&filterByFormula=${formula}&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(F.no)}&sort%5B0%5D%5Bdirection%5D=desc&${fields}${offset ? `&offset=${offset}` : ""}`);
    for (const r of j.records) out.push(toPublic(r.fields));
    offset = j.offset || "";
  } while (offset && out.length < 3000);
  return out;
}

async function getPublicByNo(no) {
  const formula = encodeURIComponent(`AND({${F.isPublic}},{${F.no}}=${Number(no)})`);
  const j = await airtable(`?maxRecords=1&filterByFormula=${formula}`);
  return j.records?.[0] ? toPublic(j.records[0].fields) : null;
}

function toPublic(f) {
  return {
    no: f[F.no], name: f[F.name] || "", since: f[F.since] || "", p: f[F.product] || "",
    story: f[F.story] || "", title: f[F.title] || "", img: f[F.photoId] || "",
    w: f[F.photoW] || 0, h: f[F.photoH] || 0, at: f[F.created] || ""
  };
}

/* ---------- Cloudinary ---------- */
const CL = () => ({
  cloud: env("CLOUDINARY_CLOUD_NAME"),
  key: env("CLOUDINARY_API_KEY"),
  secret: env("CLOUDINARY_API_SECRET"),
  folder: env("CLOUDINARY_FOLDER", "always-b-there")
});

function signUpload() {
  const { cloud, key, secret, folder } = CL();
  if (!cloud || !key || !secret) throw Object.assign(new Error("Cloudinary 尚未設定"), { status: 503 });
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  const signature = crypto.createHash("sha1").update(toSign + secret).digest("hex");
  return { cloudName: cloud, apiKey: key, folder, timestamp, signature };
}

/* 確認照片真的在我們的資料夾裡，順便拿到尺寸與 etag（檔案指紋） */
async function getResource(publicId) {
  const { cloud, key, secret, folder } = CL();
  if (!publicId || !publicId.startsWith(folder + "/")) return null;
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload/${publicId.split("/").map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: "Basic " + Buffer.from(`${key}:${secret}`).toString("base64") }
  });
  if (!r.ok) return null;
  return r.json();
}

async function destroyResource(publicId) {
  const { cloud, key, secret } = CL();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}${secret}`).digest("hex");
  const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: key, signature });
  await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, { method: "POST", body }).catch(() => {});
}

const imgUrl = (publicId, t = "c_limit,w_1600,q_auto:good,f_jpg") =>
  `https://res.cloudinary.com/${CL().cloud}/image/upload/${t}/${publicId}`;

/* ---------- 驗證 ---------- */
const len = (s) => [...String(s || "")].length;
const clean = (s) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const cleanStory = (s) => String(s || "").replace(/\r/g, "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim();

function validate(b) {
  const L = CFG.limits;
  const d = {
    name: clean(b.name), since: clean(b.since), product: clean(b.product),
    story: cleanStory(b.story), title: clean(b.title),
    email: clean(b.email).toLowerCase(), phone: String(b.phone || "").replace(/\D/g, ""),
    agree: b.agree === true, hash: /^[a-f0-9]{64}$/.test(b.hash || "") ? b.hash : ""
  };
  const err = {};
  if (!d.name || len(d.name) > L.name) err.name = "請填寫";
  if (!CFG.years.includes(d.since)) err.since = "請選取";
  if (!CFG.products.includes(d.product)) err.product = "請選取";
  if (!d.story || len(d.story) > L.story) err.story = "請填入你的故事";
  if (!d.title || len(d.title) > L.title) err.title = "請填入一句標語";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email) || d.email.length > 120) err.email = "Email格式錯誤";
  if (!/^09\d{8}$/.test(d.phone)) err.phone = "手機號碼格式錯誤";
  if (!d.agree) err.agree = "請勾選";
  return { d, err };
}

function isOpen(now = Date.now()) {
  if (env("SUBMIT_ALWAYS_OPEN") === "1") return true;
  return now >= Date.parse(CFG.start) && now <= Date.parse(CFG.end);
}

/* ---------- HTTP ---------- */
function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 64 * 1024) throw Object.assign(new Error("too large"), { status: 413 }); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return {}; }
}

const ipOf = (req) => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
const ipHash = (req) => crypto.createHash("sha256").update(ipOf(req) + (env("IP_SALT", "abt"))).digest("hex").slice(0, 16);

/* 同一個 instance 的簡易節流（真正的防線是 Email／手機／照片不可重複 + Turnstile） */
const hits = new Map();
function rateLimited(key, max = 8, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}

async function verifyTurnstile(token, req) {
  const secret = env("TURNSTILE_SECRET");
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ipOf(req) });
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const j = await r.json().catch(() => ({}));
  return !!j.success;
}

module.exports = {
  CFG, F, airtable, findDuplicates, listPublic, getPublicByNo,
  signUpload, getResource, destroyResource, imgUrl,
  validate, isOpen, send, readJson, ipHash, rateLimited, verifyTurnstile
};
