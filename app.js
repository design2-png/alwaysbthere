/* ============================================================
   Always B There — 前台
   有後台（/api）→ 正式模式；連不到 → DEMO 模式（範例故事，投稿只存在本機）
   ============================================================ */
(() => {
"use strict";
const CFG = window.ABT_CONFIG;
const $ = (id) => document.getElementById(id);
const pad = (n) => "#" + String(n).padStart(4, "0");
const len = (s) => [...String(s || "")].length;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ASSET = window.ABT_ASSETS || {};              /* 單檔預覽版會把圖片塞進這裡 */
const asset = (p) => ASSET[p] || p;
const store = {                                       /* localStorage 可能被擋，全部包 try */
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  sget(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  sset(k, v) { try { sessionStorage.setItem(k, v); } catch {} }
};

let toastT;
function toast(m, ms = 2800) { const t = $("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms); }

/* ---------- 設定套用 ---------- */
const fmtD = (iso) => { const d = new Date(iso); const p = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d); const g = (t) => p.find((x) => x.type === t)?.value; return { ymd: `${g("year")}/${g("month")}/${g("day")}`, md: `${g("month")}/${g("day")}`, hm: `${g("hour")}:${g("minute")}` }; };
const S = fmtD(CFG.start), E = fmtD(CFG.end);
const periodText = `${S.ymd} — ${E.ymd} ${E.hm}`;
$("period").textContent = periodText;
document.querySelectorAll("[data-cfg]").forEach((el) => { const k = el.dataset.cfg; el.textContent = k === "period" ? periodText : CFG[k] ?? el.textContent; });
$("ctaNote").textContent = `—— ${E.md} 前參與故事徵集，即有機會獲得萬元購物金。`;
$("announceLine").textContent = `Backbone 將於 ${CFG.announceDate.replace(/（.）/, "")} 於官方 FB／IG 公布得獎者`;
[["mainSiteLink", CFG.mainSite], ["fMain", CFG.mainSite], ["fShop", CFG.shopUrl], ["fIg", CFG.igUrl]].forEach(([id, u]) => { $(id).href = u; });
if (CFG.igPostUrl) $("igPostLink").href = CFG.igPostUrl; else $("igPostLink").replaceWith(document.createTextNode("活動貼文"));
$("since").insertAdjacentHTML("beforeend", CFG.years.map((y) => `<option value="${esc(y)}">${esc(y === "忘記了" ? y : y + " 年")}</option>`).join(""));
$("product").insertAdjacentHTML("beforeend", CFG.products.map((p) => `<option>${esc(p)}</option>`).join(""));
$("fProd").insertAdjacentHTML("beforeend", CFG.products.map((p) => `<option>${esc(p)}</option>`).join(""));
document.querySelectorAll('img[src^="/assets/"]').forEach((im) => { const p = im.getAttribute("src"); if (ASSET[p]) im.src = ASSET[p]; });

/* ---------- 資料 ---------- */
let MODE = "api", CLOUD = "", SERVER_OPEN = null, stories = [], mineNos = new Set(store.get("abt_mine") || []);
const DEMO = [
  { p: "Orca", title: "椅背調回來了", name: "林若安", since: "2019", img: "a", story: "陪我寫東西的晚上變長了。進門第一件事，是把椅背調回我的角度。" },
  { p: "Kabuto™", title: "三坪的一半是它", name: "周子豪", since: "2021", img: "b", story: "搬了兩次家，桌子螢幕都換了，只有它一直跟著。" },
  { p: "Allround Desk 電動升降桌", title: "站著開會", name: "陳映竹", since: "2022", img: "c", story: "開會時站著，寫程式時坐下，身體終於知道現在是哪一種時間。" },
  { p: "Orca", title: "爸爸的椅子", name: "黃品睿", since: "2017", img: "d", story: "爸爸退休後，椅子留給了我。坐上去會想到他看報紙的樣子。" },
  { p: "Viking™ 樂手椅", title: "唯一不出聲的", name: "張祐誠", since: "2020", img: "e", story: "剪了一百多集 podcast，沒有一集要處理椅子的聲音。" },
  { p: "Kangaroo™", title: "考研那一年", name: "吳芷萱", since: "2023", img: "f", story: "放榜之後它沒有退休，繼續陪我寫論文。" },
  { p: "Dyback 04 電動升降桌", title: "一人一組高度", name: "李承翰", since: "2024", img: "g", story: "兩組記憶高度剛好一人一組，按一下就是換班的鈴聲。" },
  { p: "Mamba™", title: "它才八歲", name: "郭欣妤", since: "忘記了", img: "h", story: "搬家師傅問要不要換新的，我說不用，它才八歲。" }
];
const DEMO_SIZE = { a: [560, 373], b: [560, 373], c: [560, 373], d: [520, 347], e: [520, 416], f: [520, 293], g: [293, 520], h: [293, 520] };

function imgSrc(s, w = 640) {
  if (s._local) return s._local;
  if (MODE === "demo") return asset(`/assets/demo/${s.img}.jpg`);
  return `https://res.cloudinary.com/${CLOUD}/image/upload/c_limit,w_${w},q_auto,f_auto/${s.img}`;
}

async function loadStories() {
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch("/api/stories", { signal: ctl.signal, headers: { Accept: "application/json" } });
    clearTimeout(to);
    if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) throw new Error(r.status);
    const j = await r.json();
    CLOUD = j.cloud || ""; SERVER_OPEN = typeof j.open === "boolean" ? j.open : null; stories = j.stories || [];
  } catch {
    MODE = "demo";
    $("demoTag").hidden = false;
    const local = store.get("abt_demo") || [];
    stories = local.concat(DEMO.map((s, i) => ({ ...s, no: 128 - i, w: DEMO_SIZE[s.img][0], h: DEMO_SIZE[s.img][1] })));
  }
}

/* ---------- 故事牆 ---------- */
const PAGE = 12;
let view = [], shownN = PAGE, fProd = "", query = "";
function applyFilter() {
  const qq = query.trim().replace(/^#/, "");
  const num = /^\d+$/.test(qq) ? parseInt(qq, 10) : null;
  view = stories.filter((s) => (!fProd || s.p === fProd) && (!qq || (num !== null ? s.no === num : (s.name + s.title).toLowerCase().includes(qq.toLowerCase()))));
  shownN = PAGE; renderWall();
}
function ratio(s) { const r = s.w && s.h ? s.w / s.h : 4 / 3; return Math.min(4 / 3, Math.max(3 / 4, r)).toFixed(3); }
function renderWall() {
  const list = view.slice(0, shownN);
  $("wall").innerHTML = list.map((s, i) => `<button class="card${query ? " hit" : ""}" type="button" data-i="${i}">
    <div class="ph" style="--ar:${ratio(s)}"><img loading="lazy" decoding="async" src="${esc(imgSrc(s))}" alt="" onload="this.classList.add('ld')"></div>
    <div class="meta"><span class="mono">${esc(shortP(s.p))} · ${pad(s.no)}</span><span>${esc(s.name)}</span></div>
    <h3>${esc(s.title)}${mineNos.has(s.no) ? '<span class="mine">你的故事</span>' : ""}</h3></button>`).join("");
  $("empty").hidden = view.length > 0;
  $("more").style.display = view.length > shownN ? "" : "none";
  const n = stories.length;
  $("count").textContent = n; $("countMono").textContent = `${n} STORIES`;
}
const shortP = (p) => String(p || "").replace(/[™®]/g, "").split(" ")[0].toUpperCase();
$("fProd").addEventListener("change", (e) => { fProd = e.target.value; applyFilter(); });
let qT; $("q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { query = e.target.value; applyFilter(); }, 180); });
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); query = $("q").value; applyFilter(); if (view.length === 1) openLb(0); });
$("more").addEventListener("click", () => { shownN += PAGE; renderWall(); });
$("wall").addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) openLb(+c.dataset.i); });

/* ---------- 燈箱 ---------- */
let cur = 0, lastFocus = null;
function openLb(i) {
  cur = i; const s = view[i]; if (!s) return;
  lastFocus = lastFocus || document.activeElement;
  $("lbImg").src = imgSrc(s, 1600); $("lbImg").alt = s.title;
  $("lbMeta").textContent = `${s.p} · ${pad(s.no)}`;
  $("lbTitle").textContent = s.title; $("lbName").textContent = s.name;
  $("lbSince").textContent = s.since === "忘記了" ? "用了好多年" : `${s.since} 起使用`;
  $("lbText").textContent = `這十年，它${s.story}`;
  $("lbPrev").disabled = i === 0; $("lbNext").disabled = i >= view.length - 1;
  openOv("lbov", $("lbX"));
  history.replaceState(null, "", `?s=${s.no}${location.hash}`);
}
function openOv(id, focusEl) { $(id).classList.add("on"); document.body.classList.add("locked"); focusEl?.focus(); }
function closeAll() {
  document.querySelectorAll(".ov").forEach((o) => o.classList.remove("on"));
  document.body.classList.remove("locked");
  if (location.search) history.replaceState(null, "", location.pathname + location.hash);
  lastFocus?.focus?.(); lastFocus = null;
  if (pendingDrop) { const d = pendingDrop; pendingDrop = null; $("top").scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); setTimeout(() => dropBubble(d, "k"), 700); }
}
$("lbX").onclick = closeAll; $("doneX").onclick = closeAll;
$("lbGo").onclick = () => { closeAll(); };
$("doneGo").onclick = (e) => { e.preventDefault(); closeAll(); $("stories").scrollIntoView({ behavior: "smooth" }); };
$("lbPrev").onclick = () => openLb(cur - 1); $("lbNext").onclick = () => openLb(cur + 1);
document.querySelectorAll(".ov").forEach((o) => o.addEventListener("click", (e) => { if (e.target === o) closeAll(); }));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAll();
  if ($("lbov").classList.contains("on")) { if (e.key === "ArrowLeft" && cur > 0) openLb(cur - 1); if (e.key === "ArrowRight" && cur < view.length - 1) openLb(cur + 1); }
});
$("lbShare").onclick = async () => {
  const s = view[cur]; const url = MODE === "api" ? `${location.origin}/s/${s.no}` : `${location.origin}${location.pathname}?s=${s.no}`;
  try { if (navigator.share) { await navigator.share({ title: `「${s.title}」— Always B There`, url }); return; } } catch (e) { if (e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(url); toast("連結已複製"); } catch { prompt("複製這個連結", url); }
};
document.querySelectorAll('a[href="#privacy"]').forEach((a) => a.addEventListener("click", () => { $("privacy").open = true; }));

/* ---------- INTRO（滿版，播完才進主頁） ---------- */
const INTRO_IMGS = [1, 2, 3, 4, 5].map((n) => asset(`/assets/intro/p${n}.jpg`));
let introT = [];
function playIntro() {
  if (reduce) { endIntro(true); return; }
  introT.forEach(clearTimeout); introT = [];
  const at = (ms, fn) => introT.push(setTimeout(fn, ms));
  const it = $("intro"); it.classList.remove("out"); it.classList.add("on"); document.body.classList.add("locked"); scrollTo(0, 0);
  hmTitleOff(); clearPile();
  const W = innerWidth, sc = W < 640 ? .42 : Math.min(1, W / 1440);
  const XL = [-180, -160, -140, -98, 20, 410], XE = [-600, -360, -120, 120, 360, 600];
  $("fanStage").innerHTML = XL.map((x, i) => `<img src="${INTRO_IMGS[i % 5]}" alt="" style="--x:${Math.round(x * sc)}px;--xe:${Math.round(XE[i] * sc)}px;--d:${(i * .06).toFixed(2)}s;z-index:${10 - i}">`).join("");
  $("rows").className = "rows"; $("introSec").textContent = "01 / 線 → 面";
  requestAnimationFrame(() => $("fan").classList.add("on"));
  at(3400, () => {
    $("introSec").textContent = "02 / 字 × 線";
    const mk = (txt, cls, imgs) => { let h = ""; for (let i = 0; i < 6; i++) h += `<span>${txt}</span><i class="cell" style="background-image:url(${imgs[i % imgs.length]});--i:${(i * .12).toFixed(2)}s"></i>`; return `<div class="row ${cls}">${h}</div>`; };
    const P = INTRO_IMGS;
    $("rows").innerHTML = mk("挺好的", "", [P[0], P[2], P[4]]) + mk("10 YEARS", "en", [P[1], P[3], P[0]]) + mk("十年", "", [P[3], P[0], P[2]]) + mk("挺好的", "", [P[2], P[1], P[4]]) + '<div class="veil"></div>';
    $("rows").classList.add("on"); $("fan").classList.remove("on");
  });
  at(5000, () => { $("introSec").textContent = "03 / 線 → 照片"; $("rows").classList.add("open"); });
  at(6500, () => endIntro());
}
function endIntro(instant) {
  introT.forEach(clearTimeout); introT = [];
  const it = $("intro");
  if (instant) it.classList.remove("on"); else { it.classList.add("out"); setTimeout(() => { it.classList.remove("on", "out"); $("fan").classList.remove("on"); $("rows").className = "rows"; }, 700); }
  document.body.classList.remove("locked");
  store.sset("abt_intro", "1");
  setTimeout(() => { startPile(); setTimeout(hmTitleOn, reduce ? 0 : 900); }, instant ? 0 : 250);
}
$("introSkip").onclick = () => endIntro();
$("replay").onclick = playIntro;
const hmTitleOn = () => $("hmTitle").classList.add("on");
const hmTitleOff = () => $("hmTitle").classList.remove("on");

/* ---------- HERO 泡泡（物理引擎，可拖拉） ---------- */
const BASE = [
  ["坐起來挺好的", "k"], ["這張椅子挺好的", ""], ["腰終於不痛了", ""], ["十年了還在用", ""], [":)", "m"], ["挺好的", "k"],
  ["10 YEARS", "t"], ["2016 — 2026", "m"], ["<3", "m"], ["挺好的椅子", "k"], ["挺好的設計", "g"], ["挺好的故事", ""],
  ["未來有你也挺好的", "k"], ["=)", "m"], ["#AlwaysBThere", "m"], ["因為有你，這十年挺好的", "k"], ["安靜。", "o"],
  ["^_^", "m"], ["@backbone.tw", "m"], ["ORCA", "t"], ["KABUTO", "t"], ["挺好的品牌", ""], ["一整晚", "o"], [":O", "m"]
];
let engine = null, runner = null, bodies = [], walls = [], pendingDrop = null;
function phrases() {
  const fromWall = stories.slice(0, 18).map((s) => [s.title, mineNos.has(s.no) ? "k" : ""]);
  const all = []; const a = BASE.slice(), b = fromWall.slice();
  while (a.length || b.length) { if (a.length) all.push(a.shift()); if (b.length) all.push(b.shift()); }
  return all;
}
function clearPile() {
  if (runner && window.Matter) Matter.Runner.stop(runner);
  if (engine && window.Matter) { Matter.World.clear(engine.world); Matter.Engine.clear(engine); }
  engine = runner = null; bodies = []; $("pile").innerHTML = "";
}
function startPile() {
  clearPile();
  const M = window.Matter, el = $("pile"), W = el.clientWidth, H = el.clientHeight;
  const list = phrases().slice(0, W < 640 ? 18 : 40);
  if (!M || reduce) {
    el.innerHTML = list.map(([t, c], i) => `<span class="bub ${c}" style="transform:translate(${(i * 97) % Math.max(60, W - 160)}px,${H - 56 - (i % 5) * 40}px) rotate(${(i % 7 - 3) * 4}deg)">${esc(t)}</span>`).join("");
    return;
  }
  engine = M.Engine.create({ gravity: { y: 1.15 } });
  const wall = { isStatic: true };
  walls = [M.Bodies.rectangle(W / 2, H + 30, W * 2, 60, wall), M.Bodies.rectangle(-30, H / 2, 60, H * 4, wall), M.Bodies.rectangle(W + 30, H / 2, 60, H * 4, wall)];
  M.World.add(engine.world, walls);
  list.forEach(([t, c], i) => setTimeout(() => { if (engine) addBody(t, c, 60 + Math.random() * (W - 120), -40 - Math.random() * 200); }, i * 70));
  const mouse = M.Mouse.create(el);
  const mc = M.MouseConstraint.create(engine, { mouse, constraint: { stiffness: .15, render: { visible: false } } });
  /* 讓頁面照常捲動：拿掉 Matter 的滾輪與觸控攔截 */
  ["mousewheel", "DOMMouseScroll", "wheel"].forEach((ev) => mouse.element.removeEventListener(ev, mouse.mousewheel));
  if (matchMedia("(pointer:coarse)").matches) { mouse.element.removeEventListener("touchmove", mouse.mousemove); mouse.element.removeEventListener("touchstart", mouse.mousedown); mouse.element.removeEventListener("touchend", mouse.mouseup); }
  M.World.add(engine.world, mc);
  runner = M.Runner.create(); M.Runner.run(runner, engine);
  M.Events.on(engine, "afterUpdate", () => { for (const b of bodies) b.el.style.transform = `translate(${(b.position.x - b.bw / 2).toFixed(1)}px,${(b.position.y - b.bh / 2).toFixed(1)}px) rotate(${b.angle.toFixed(3)}rad)`; });
}
function addBody(text, cls, x, y, vy) {
  const M = window.Matter; const d = document.createElement("span");
  d.className = "bub " + (cls || ""); d.textContent = text; $("pile").appendChild(d);
  const bw = d.offsetWidth, bh = d.offsetHeight;
  const b = M.Bodies.rectangle(x, y, bw, bh, { chamfer: { radius: Math.min(bh / 2, 18) }, restitution: .2, friction: .6, frictionAir: .012, angle: (Math.random() - .5) * .8, density: .002 });
  b.el = d; b.bw = bw; b.bh = bh; bodies.push(b); M.World.add(engine.world, b);
  if (vy) M.Body.setVelocity(b, { x: (Math.random() - .5) * 4, y: vy });
  return d;
}
function dropBubble(text, cls) {
  if (!engine) { startPile(); }
  if (!engine) return;
  const d = addBody(text, cls, $("pile").clientWidth / 2, -60, 3); d.classList.add("new"); setTimeout(() => d.classList.remove("new"), 1800);
  hmTitleOn(); toast("你的那一句，掉進牆裡了");
}
addEventListener("resize", () => {
  if (!engine || !window.Matter) return; const M = window.Matter, P = $("pile"), W = P.clientWidth, H = P.clientHeight;
  M.Body.setPosition(walls[0], { x: W / 2, y: H + 30 }); M.Body.setPosition(walls[2], { x: W + 30, y: H / 2 });
  bodies.forEach((b) => { if (b.position.x > W - 20) M.Body.setPosition(b, { x: W - 40, y: Math.min(b.position.y, H - 40) }); });
});

/* ---------- sticky CTA ---------- */
let heroVis = true, subVis = false;
const upd = () => $("sticky").classList.toggle("on", !heroVis && !subVis && isOpen());
new IntersectionObserver(([e]) => { heroVis = e.isIntersecting; upd(); }).observe($("top"));
new IntersectionObserver(([e]) => { subVis = e.isIntersecting; upd(); }, { threshold: .1 }).observe($("submit"));

/* ---------- 徵件期間 ---------- */
function isOpen() { if (MODE === "demo") return true; if (SERVER_OPEN !== null) return SERVER_OPEN; const n = Date.now(); return n >= Date.parse(CFG.start) && n <= Date.parse(CFG.end); }
function applyPeriod() {
  const n = Date.now(), note = $("closedNote");
  if (isOpen()) { note.hidden = MODE !== "demo"; $("sendBtn").disabled = false; }
  if (MODE === "demo") { note.hidden = false; note.innerHTML = `預覽模式：尚未連線後台，送出的故事只會存在你的瀏覽器。正式徵件期間 <b>${periodText}</b>`; return; }
  if (isOpen()) return;
  if (n < Date.parse(CFG.start)) { note.hidden = false; note.innerHTML = `徵件將於 <b>${S.ymd}</b> 開始，敬請期待。`; $("sendBtn").disabled = true; $("heroCta").innerHTML = `${S.md} 開始徵件 <i>→</i>`; }
  else if (n > Date.parse(CFG.end)) { note.hidden = false; note.innerHTML = `徵件已於 ${E.ymd} ${E.hm} 截止，感謝參與！得獎名單將於 <b>${esc(CFG.announceDate)}</b> 公布。`; $("sendBtn").disabled = true; $("heroCta").innerHTML = `看大家的故事 <i>→</i>`; $("heroCta").href = "#stories"; $("ctaNote").textContent = `—— 徵件已截止，得獎名單 ${CFG.announceDate.replace(/（.）/, "")} 公布。`; }
}

/* ---------- 表單 ---------- */
const openedAt = Date.now();
let photo = null;
const drop = $("drop");
$("photo").addEventListener("change", (e) => loadPhoto(e.target.files[0]));
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => loadPhoto(e.dataTransfer.files[0]));

async function sha256(buf) { try { const h = await crypto.subtle.digest("SHA-256", buf); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join(""); } catch { return ""; } }
async function decode(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch {} }
  return new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; });
}
async function loadPhoto(f) {
  if (!f) return;
  if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) { toast("請上傳照片檔（JPG／PNG／HEIC）"); return; }
  if (f.size > CFG.limits.photoMB * 1024 * 1024) { toast(`照片超過 ${CFG.limits.photoMB}MB，請換一張`); return; }
  let bmp;
  try { bmp = await decode(f); } catch { toast("這個格式在你的瀏覽器讀不出來，請改用 JPG 或 PNG", 4000); return; }
  const hash = await sha256(await f.arrayBuffer());
  const max = 2400, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * sc), h = Math.round(bmp.height * sc);
  const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", .88));
  if (photo?.url) URL.revokeObjectURL(photo.url);
  photo = { blob, url: URL.createObjectURL(blob), w, h, hash, canvas: c };
  $("prev").src = photo.url; drop.classList.add("has"); bad("fPhoto", false);
}

const counters = [["story", "cStory", CFG.limits.story], ["title", "cTitle", CFG.limits.title]];
counters.forEach(([id, cid, max]) => $(id).addEventListener("input", (e) => {
  let v = e.target.value; if (len(v) > max) { v = [...v].slice(0, max).join(""); e.target.value = v; }
  $(cid).textContent = len(v); $(cid).parentElement.classList.toggle("full", len(v) >= max);
}));
$("phone").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10); });
["since", "product"].forEach((id) => { const s = $(id); const f = () => s.classList.toggle("empty", !s.value); s.addEventListener("change", f); f(); });

function bad(id, on, msg) { const f = $(id); f.classList.toggle("bad", !!on); if (msg) { const e = f.querySelector(".err"); if (e) e.textContent = msg; } return !!on; }
const V = {
  name: () => bad("fName", !$("name").value.trim(), "請填寫"),
  since: () => bad("fSince", !$("since").value, "請選取"),
  product: () => bad("fProduct", !$("product").value, "請選取"),
  story: () => bad("fStory", !$("story").value.trim(), "請填入你的故事"),
  title: () => bad("fTitle", !$("title").value.trim(), "請填入一句標語"),
  email: () => bad("fEmail", !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($("email").value.trim()), "Email格式錯誤"),
  phone: () => bad("fPhone", !/^09\d{8}$/.test($("phone").value), "手機號碼格式錯誤"),
  agree: () => bad("fAgree", !$("agree").checked, "請勾選"),
  photo: () => bad("fPhoto", !photo, "請上傳一張照片")
};
/* 離開欄位才檢查；已經紅了的，改對就立刻消失 */
Object.keys(V).forEach((k) => { const el = $(k); if (!el || k === "photo") return;
  el.addEventListener("blur", () => { if (el.value || k === "agree") V[k](); });
  el.addEventListener(el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input", () => { if (el.closest(".field").classList.contains("bad")) V[k](); });
});

function payload(mode, extra = {}) {
  return { mode, name: $("name").value.trim(), since: $("since").value, product: $("product").value, story: $("story").value.trim(), title: $("title").value.trim(), email: $("email").value.trim(), phone: $("phone").value, agree: $("agree").checked, hash: photo?.hash || "", hp: $("hp").value, t: openedAt, ...extra };
}
async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j };
}
const FIELD_ID = { name: "fName", since: "fSince", product: "fProduct", story: "fStory", title: "fTitle", email: "fEmail", phone: "fPhone", agree: "fAgree", photo: "fPhoto" };
function showServerErrors(fields) { Object.entries(fields || {}).forEach(([k, m]) => FIELD_ID[k] && bad(FIELD_ID[k], true, m)); focusFirstBad(); }
function focusFirstBad() { const f = document.querySelector(".story-form .field.bad"); if (f) { f.scrollIntoView({ behavior: "smooth", block: "center" }); f.querySelector("input,select,textarea")?.focus({ preventScroll: true }); } }
function uploadPhoto(sig) {
  return new Promise((res, rej) => {
    const fd = new FormData(); fd.append("file", photo.blob, "photo.jpg"); fd.append("api_key", sig.apiKey); fd.append("timestamp", sig.timestamp); fd.append("signature", sig.signature); fd.append("folder", sig.folder);
    const x = new XMLHttpRequest(); x.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);
    x.upload.onprogress = (e) => { if (e.lengthComputable) state(`照片上傳中 ${Math.round(e.loaded / e.total * 100)}%`); };
    x.onload = () => { try { const j = JSON.parse(x.responseText); x.status < 300 ? res(j) : rej(new Error(j.error?.message || "upload")); } catch (e) { rej(e); } };
    x.onerror = () => rej(new Error("network")); x.send(fd);
  });
}
const state = (m) => { $("sendState").textContent = m; };
let sending = false;
$("form").addEventListener("submit", async (e) => {
  e.preventDefault(); if (sending) return;
  if (!isOpen()) { applyPeriod(); return; }
  const errs = Object.values(V).map((f) => f()).filter(Boolean).length;
  if (errs) { toast("還有欄位沒填好"); focusFirstBad(); return; }
  sending = true; $("sendBtn").disabled = true;
  try {
    let no;
    if (MODE === "demo") {
      state("送出中…"); await new Promise((r) => setTimeout(r, 700));
      const em = $("email").value.trim().toLowerCase(), ph = $("phone").value, used = store.get("abt_used") || [];
      const dup = {}; if (used.some((u) => u.e === em)) dup.email = "這組 Email 已經投稿過了"; if (used.some((u) => u.p === ph)) dup.phone = "這支手機已經投稿過了"; if (photo.hash && used.some((u) => u.h === photo.hash)) dup.photo = "這張照片已經投稿過了";
      if (Object.keys(dup).length) { showServerErrors(dup); throw new Error("dup"); }
      no = Math.max(128, ...stories.map((s) => s.no)) + 1;
      used.push({ e: em, p: ph, h: photo.hash }); store.set("abt_used", used);
    } else {
      state("檢查中…");
      const tsToken = window.turnstile?.getResponse?.() || "";
      const chk = await post("/api/submit", payload("check"));
      if (!chk.ok) { if (chk.j.fields) showServerErrors(chk.j.fields); else toast(chk.j.message || "送出失敗，請再試一次"); throw new Error("check"); }
      const sg = await post("/api/sign", {});
      if (!sg.ok) { toast(sg.status === 403 ? "目前不在徵件期間" : "系統忙碌中，請稍後再試"); throw new Error("sign"); }
      const up = await uploadPhoto(sg.j);
      state("寫入故事牆…");
      const sub = await post("/api/submit", payload("submit", { publicId: up.public_id, turnstile: tsToken }));
      if (!sub.ok) { if (sub.j.fields) showServerErrors(sub.j.fields); else toast(sub.j.message || "送出失敗，請再試一次"); window.turnstile?.reset?.(); throw new Error("submit"); }
      no = sub.j.no;
    }
    const s = { no, p: $("product").value, title: $("title").value.trim(), name: $("name").value.trim(), since: $("since").value, story: $("story").value.trim(), w: photo.w, h: photo.h, img: "", _local: photo.url };
    mineNos.add(no); store.set("abt_mine", [...mineNos]);
    if (MODE === "demo") { const keep = store.get("abt_demo") || []; keep.unshift({ ...s, _local: photo.canvas.toDataURL("image/jpeg", .7) }); store.set("abt_demo", keep.slice(0, 5)); }
    stories.unshift(s); fProd = ""; query = ""; $("fProd").value = ""; $("q").value = ""; applyFilter();
    done(s);
  } catch (err) {
    if (!["dup", "check", "sign", "submit"].includes(err.message)) toast("網路不穩，照片沒有傳上去，請再按一次送出");
  } finally { sending = false; $("sendBtn").disabled = !isOpen(); state(""); }
});

/* ---------- 投稿完成 ---------- */
let lastStory = null, cardStyle = "A";
function done(s) {
  lastStory = s; s._canvas = photo.canvas; $("doneNo").textContent = pad(s.no); $("pvNo").textContent = pad(s.no + 1);
  renderCards();
  const title = s.title;
  const finish = () => { openOv("doneov", $("save")); pendingDrop = title; };
  /* 那一句話先飛上去 */
  if (reduce) { finish(); } else { throwBubble(title, finish); }
  $("form").reset(); drop.classList.remove("has"); $("cStory").textContent = 0; $("cTitle").textContent = 0;
  ["since", "product"].forEach((id) => $(id).classList.add("empty"));
  photo = null;
}
function throwBubble(text, cb) {
  const r = $("sendBtn").getBoundingClientRect(); const c = document.createElement("span");
  c.className = "bub k fly"; c.textContent = text; document.body.appendChild(c);
  c.style.left = r.left + "px"; c.style.top = r.top + "px"; c.style.transform = "none";
  const tx = innerWidth / 2 - c.offsetWidth / 2 - r.left, ty = -c.offsetHeight - 40 - r.top;
  c.animate([{ transform: "translate(0,0) rotate(0) scale(1)" }, { transform: "translate(0,-14px) rotate(-3deg) scale(1.08)", offset: .15 }, { transform: `translate(${tx}px,${ty}px) rotate(-20deg) scale(1.1)` }], { duration: 1100, easing: "cubic-bezier(.3,.6,.25,1)", fill: "forwards" }).onfinish = () => { c.remove(); cb(); };
}
document.querySelectorAll("[data-style]").forEach((b) => b.addEventListener("click", () => { cardStyle = b.dataset.style; document.querySelectorAll("[data-style]").forEach((x) => x.setAttribute("aria-pressed", x === b)); renderCards(); }));

/* 品牌向量給 canvas 用（白／黑兩色） */
const svgCache = {};
async function brandImg(path, color) {
  const key = path + color; if (svgCache[key]) return svgCache[key];
  const txt = await (await fetch(asset(path))).text();
  const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(txt.replace(/currentColor/g, color));
  return (svgCache[key] = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
}
async function renderCards() {
  if (!lastStory) return;
  try { await Promise.all([document.fonts.load("700 60px 'Noto Sans TC'"), document.fonts.load("400 40px 'Noto Sans TC'"), document.fonts.load("700 30px Sora"), document.fonts.load("500 24px 'JetBrains Mono'")]); } catch {}
  const src = lastStory._canvas || photo?.canvas; if (!src) return;
  const brand = { wmW: await brandImg("/assets/wordmark.svg", "#FFFFFF"), wmB: await brandImg("/assets/wordmark.svg", "#171917"), mkW: await brandImg("/assets/mark-10th.svg", "#FFFFFF"), mkB: await brandImg("/assets/mark-10th.svg", "#171917") };
  lastStory._S = drawCard(src, lastStory, 1080, 1920, cardStyle, brand);
  lastStory._P = drawCard(src, lastStory, 1080, 1350, cardStyle, brand);
  $("cardS").src = lastStory._S.toDataURL("image/jpeg", .9); $("cardP").src = lastStory._P.toDataURL("image/jpeg", .9);
}
const K = { black: "#171917", silver: "#D9D9D9", yellow: "#E6F832", text: "#303030", off: "#F1F1F1" };
function cover(x, img, X, Y, w, h) { const r = Math.max(w / img.width, h / img.height), sw = w / r, sh = h / r; x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, X, Y, w, h); }
function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function lines(x, t, w, max) { const out = []; let l = ""; for (const ch of t) { if (x.measureText(l + ch).width > w && l) { out.push(l); l = ch; if (out.length === max) return out; } else l += ch; } if (l) out.push(l); return out.slice(0, max); }
/* 標語組合：「挺好的」粗體＋黃底線、「，十年。」常規；下排 10 YEARS 粗、其餘常規灰 */
function slogan(x, X, Y, size, fg, sub) {
  x.textBaseline = "alphabetic"; x.font = `700 ${size}px 'Noto Sans TC'`; const w1 = x.measureText("挺好的").width;
  x.fillStyle = K.yellow; x.fillRect(X, Y + size * .1, w1, size * .16);
  x.fillStyle = fg; x.fillText("挺好的", X, Y); x.font = `400 ${size}px 'Noto Sans TC'`; x.fillText("，十年。", X + w1 + size * .08, Y);
  const s2 = Math.round(size * .34); x.font = `700 ${s2}px Sora`; x.letterSpacing = "4px"; x.fillStyle = fg; x.fillText("10 YEARS", X, Y + size * .78);
  const w2 = x.measureText("10 YEARS ").width; x.font = `400 ${s2}px Sora`; x.fillStyle = sub; x.fillText("IN THE MAKING.", X + w2, Y + size * .78); x.letterSpacing = "0px";
}
function drawCard(img, s, W, H, style, B) {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const tall = H > 1500, M = 72; x.textBaseline = "top";
  const mono = (sz) => `500 ${sz}px 'JetBrains Mono', monospace`;
  const since = s.since === "忘記了" ? "" : ` · SINCE ${s.since}`;
  if (style === "A") {
    cover(x, img, 0, 0, W, H);
    let g = x.createLinearGradient(0, H * .38, 0, H); g.addColorStop(0, "rgba(23,25,23,0)"); g.addColorStop(1, "rgba(23,25,23,.94)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    g = x.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, "rgba(23,25,23,.6)"); g.addColorStop(1, "rgba(23,25,23,0)"); x.fillStyle = g; x.fillRect(0, 0, W, 260);
    if (B.wmW) x.drawImage(B.wmW, M, M, 200, 200 * 155 / 591);
    if (B.mkW) x.drawImage(B.mkW, W - M - 96, M - 6, 96, 96 * 500 / 468);
    const sz = tall ? 84 : 70, lh = sz * 1.32; x.font = `700 ${sz}px 'Noto Sans TC'`;
    const L = lines(x, s.title, W - M * 2, 2);
    let y = H - M - (tall ? 360 : 300) - L.length * lh;
    x.font = mono(24); x.fillStyle = K.yellow; x.fillText(pad(s.no), M, y - 50);
    x.fillStyle = "#fff"; x.font = `700 ${sz}px 'Noto Sans TC'`; L.forEach((l, i) => x.fillText(l, M, y + i * lh));
    y += L.length * lh + 16; x.font = mono(26); x.fillStyle = "rgba(255,255,255,.72)"; x.fillText(`${s.name} · ${shortP(s.p)}${since}`, M, y);
    slogan(x, M, H - M - (tall ? 150 : 120), 58, "#fff", "rgba(255,255,255,.6)");
    x.textBaseline = "top"; x.font = mono(22); x.fillStyle = "rgba(255,255,255,.6)"; x.textAlign = "right"; x.fillText(`${CFG.hashtag.toUpperCase()}  ·  ${CFG.igHandle}`, W - M, H - M - 18); x.textAlign = "left";
  }
  if (style === "B") {
    x.fillStyle = K.silver; x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(23,25,23,.07)"; x.lineWidth = 2; for (let i = 36; i < W; i += 108) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let i = 0; i < H; i += 108) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    if (B.wmB) x.drawImage(B.wmB, M, M, 200, 200 * 155 / 591);
    x.font = mono(22); x.fillStyle = K.black; x.textAlign = "right"; x.fillText("ALWAYS B THERE / " + pad(s.no), W - M, M + 12); x.textAlign = "left";
    const pw = W - M * 2 - 120, ph = tall ? 780 : 520, px = M + 60, py = M + 150;
    x.save(); x.translate(px + pw / 2, py + ph / 2); x.rotate(-.02); x.translate(-pw / 2, -ph / 2);
    x.shadowColor = "rgba(23,25,23,.35)"; x.shadowBlur = 60; x.shadowOffsetY = 30; x.fillStyle = "#fff"; x.fillRect(-16, -16, pw + 32, ph + 90); x.shadowColor = "transparent";
    cover(x, img, 0, 0, pw, ph); x.fillStyle = "#8F908E"; x.font = mono(20); x.fillText("SET UP / " + pad(s.no), 4, ph + 24); x.restore();
    const others = ["坐起來挺好的", "腰終於不痛了", "十年了還在用", ":)", "ORCA", "挺好的椅子", "<3", "未來有你也挺好的", "10 YEARS", "=)", "挺好的設計", "KABUTO", "安靜。", "^_^", "2016 — 2026", "挺好的故事"];
    const rnd = (a) => { const t = Math.sin(a * 12.9898 + 78.233) * 43758.5453; return t - Math.floor(t); };
    let yy = H - M - 40, k = 0; const rows = tall ? 5 : 3;
    for (let r = 0; r < rows; r++) { let xx = M - 40 + rnd(r + 1) * 60; const sc = 1 - r * .06;
      while (xx < W - M + 20) { const t = others[k % others.length]; const mn = /^[A-Za-z:<=)^_\s0-9—]+$/.test(t);
        const fs = Math.round((mn ? 28 : 34) * sc * (.9 + rnd(k + 3) * .3)); x.font = mn ? `700 ${fs}px 'JetBrains Mono'` : `500 ${fs}px 'Noto Sans TC'`;
        const w = x.measureText(t).width + fs * 1.6, h = fs * 2;
        x.save(); x.translate(xx + w / 2, yy - h / 2); x.rotate((rnd(k + 11) - .5) * .5); x.translate(-w / 2, -h / 2);
        x.fillStyle = rnd(k + 5) > .55 ? "#fff" : K.silver; x.strokeStyle = "rgba(23,25,23,.55)"; x.lineWidth = 2; rr(x, 0, 0, w, h, h / 2); x.fill(); x.stroke();
        x.fillStyle = K.text; x.fillText(t, fs * .8, h / 2 - fs * .55); x.restore(); k++; xx += w - fs * .6 + rnd(k + 9) * 16; }
      yy -= Math.round(62 * sc); }
    x.font = "700 58px 'Noto Sans TC'"; const L = lines(x, s.title, W - M * 2 - 100, 2), lh = 76, bh = L.length * lh + 44, bw = Math.min(W - M * 2, Math.max(...L.map((l) => x.measureText(l).width)) + 100);
    const bx = M + 30, by = yy - bh + 30;
    x.save(); x.translate(bx + bw / 2, by + bh / 2); x.rotate(-.04); x.translate(-bw / 2, -bh / 2); x.shadowColor = "rgba(23,25,23,.25)"; x.shadowBlur = 30; x.shadowOffsetY = 14;
    x.fillStyle = K.yellow; rr(x, 0, 0, bw, bh, bh / 2); x.fill(); x.shadowColor = "transparent"; x.fillStyle = K.black; L.forEach((l, i) => x.fillText(l, 50, 22 + i * lh)); x.restore();
    x.font = mono(24); x.fillStyle = K.text; x.fillText(`${s.name} · ${shortP(s.p)}`, bx + 50, by - 40);
  }
  if (style === "C") {
    x.fillStyle = K.black; x.fillRect(0, 0, W, H);
    if (B.wmW) x.drawImage(B.wmW, M, M, 200, 200 * 155 / 591);
    x.font = mono(22); x.fillStyle = "rgba(255,255,255,.55)"; x.textAlign = "right"; x.fillText(pad(s.no), W - M, M + 12); x.textAlign = "left";
    const pw = W - M * 2, ph = tall ? 900 : 540, py = M + 130;
    cover(x, img, M, py, pw, ph); x.strokeStyle = "rgba(255,255,255,.6)"; x.lineWidth = 2; x.strokeRect(M, py, pw, ph);
    let ty = py + ph + (tall ? 90 : 54);
    x.font = mono(24); x.fillStyle = "rgba(255,255,255,.55)"; x.fillText(`${s.name} · ${shortP(s.p)}${since}`, M, ty); ty += 56;
    const fs = tall ? 72 : 58, lh = fs * 1.4; x.font = `700 ${fs}px 'Noto Sans TC'`; const L = lines(x, s.title, pw - (tall ? 0 : 170), 2);
    x.fillStyle = "#fff"; L.forEach((l, i) => x.fillText(l, M, ty + i * lh));
    x.fillStyle = K.yellow; x.fillRect(M, ty + L.length * lh + 6, 64, 8);
    if (B.mkW) { const mw = tall ? 120 : 96; x.drawImage(B.mkW, W - M - mw, H - M - mw * 500 / 468 - (tall ? 0 : 4), mw, mw * 500 / 468); }
    slogan(x, M, H - M - (tall ? 90 : 70), tall ? 52 : 44, "#fff", "rgba(255,255,255,.55)");
  }
  return c;
}
async function cardFiles() {
  if (!lastStory?._S) await renderCards();
  const b = (cv) => new Promise((r) => cv.toBlob(r, "image/jpeg", .92));
  const n = String(lastStory.no).padStart(4, "0");
  return [new File([await b(lastStory._S)], `AlwaysBThere_${n}_story.jpg`, { type: "image/jpeg" }), new File([await b(lastStory._P)], `AlwaysBThere_${n}_post.jpg`, { type: "image/jpeg" })];
}
function download(file) { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
const isTouch = matchMedia("(pointer:coarse)").matches;
$("save").onclick = async () => {
  const files = await cardFiles();
  if (isTouch && navigator.canShare?.({ files })) { try { await navigator.share({ files }); toast("選「儲存影像」就能存進相簿"); return; } catch (e) { if (e.name === "AbortError") return; } }
  files.forEach((f, i) => setTimeout(() => download(f), i * 400)); toast("故事卡已下載（限動＋貼文兩張）");
};
$("shareIg").onclick = async () => {
  const [story] = await cardFiles();
  const text = `${lastStory.title}｜${CFG.hashtag} ${CFG.igHandle}`;
  try { await navigator.clipboard.writeText(text); } catch {}
  if (navigator.canShare?.({ files: [story] })) { try { await navigator.share({ files: [story], text }); return; } catch (e) { if (e.name === "AbortError") return; } }
  download(story); toast("故事卡已下載，打開 IG 發限動並 Tag @backbone.tw", 4200);
  setTimeout(() => window.open(CFG.igUrl, "_blank", "noopener"), 900);
};

/* ---------- Turnstile（有設定才載入） ---------- */
if (CFG.turnstileSiteKey) {
  window.onTs = () => window.turnstile.render("#turnstile", { sitekey: CFG.turnstileSiteKey, theme: "light", size: "flexible" });
  const sc = document.createElement("script"); sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTs"; sc.async = true; document.head.appendChild(sc);
}

/* ---------- 開場 ---------- */
(async function boot() {
  const introFirst = !store.sget("abt_intro") && !location.search.includes("s=") && !location.hash;
  if (introFirst) playIntro(); else { $("intro").classList.remove("on"); }
  await loadStories();
  applyFilter(); applyPeriod(); upd();
  $("pvNo").textContent = pad((stories[0]?.no || 0) + 1);
  const m = location.search.match(/[?&]s=(\d+)/);
  if (m) { const i = view.findIndex((s) => s.no === +m[1]); if (i >= 0) { if (i >= shownN) { shownN = i + 1; renderWall(); } $("stories").scrollIntoView(); setTimeout(() => openLb(i), 300); } }
  if (!introFirst) { const go = () => { startPile(); setTimeout(hmTitleOn, reduce ? 0 : 600); }; window.Matter ? go() : addEventListener("load", go, { once: true }); }
})();
})();
