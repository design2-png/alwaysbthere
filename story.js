/* GET /s/:no — 單則故事分享頁：給 FB / LINE / IG 抓預覽圖，真人會被帶回故事牆並打開那一則 */
const { getPublicByNo, imgUrl } = require("../lib/core");

const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = async (req, res) => {
  const no = parseInt(String(req.query?.no || "").replace(/\D/g, ""), 10);
  let s = null;
  try { if (no) s = await getPublicByNo(no); } catch {}
  const site = `https://${req.headers.host}`;
  const target = s ? `${site}/?s=${s.no}#stories` : `${site}/`;
  const title = s ? `「${s.title}」— ${s.name} · Always B There` : "Always B There — Backbone 十週年故事牆";
  const desc = s ? s.story : "這十年，你和 Backbone 的故事。上傳一張有 Backbone 相伴的空間照片與故事。";
  const img = s && s.img ? imgUrl(s.img, "c_fill,g_auto,w_1200,h_630,q_auto,f_jpg") : `${site}/assets/og.jpg`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  res.statusCode = s || !no ? 200 : 404;
  res.end(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${esc(s ? `${site}/s/${s.no}` : site)}"><meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(target)}"><meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body style="font-family:sans-serif;background:#F1F1F1;color:#171917;padding:40px">
<a href="${esc(target)}">前往 Always B There 故事牆 →</a><script>location.replace(${JSON.stringify(target)})</script></body></html>`);
};
