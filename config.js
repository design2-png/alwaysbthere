/* ============================================================
   Always B There — 活動設定（前台與後端共用）
   改日期、獎項、產品清單、連結，只要改這一個檔案。
   ============================================================ */
(function (cfg) {
  if (typeof module !== "undefined" && module.exports) module.exports = cfg;
  else window.ABT_CONFIG = cfg;
})({
  /* 活動期間（台北時間）。期間外前台會關閉投稿，後端也會擋。 */
  start: "2026-11-06T00:00:00+08:00",
  end: "2026-12-31T23:59:59+08:00",

  /* 公布與兌獎日期（顯示用） */
  announceDate: "2027/1/11（一）",
  claimDeadline: "2027/1/22（五）",

  /* 社群 */
  igHandle: "@backbone.tw",
  igUrl: "https://www.instagram.com/backbone.tw/",
  igPostUrl: "", /* 活動貼文網址，上線後填入；留空就不顯示「前往活動貼文」 */
  hashtag: "#AlwaysBThere",

  /* 連結 */
  mainSite: "https://design2-png.github.io/10THanniversary/",
  shopUrl: "https://www.backbone.tw/",

  /* Cloudflare Turnstile 防機器人（選用）：填 site key 即啟用，後端要同時設 TURNSTILE_SECRET */
  turnstileSiteKey: "",

  /* 產品下拉選單（行銷部定稿 21 項） */
  products: [
    "Kabuto™", "Kabuto NASA 限定版", "Kangaroo™", "Mild Chair 米迪椅", "Eagle™",
    "Mamba™", "Peacock™", "Gull", "Orca", "Beaver", "Kerno Chair 殼若椅",
    "Viking™ 樂手椅", "Voyager 樂手椅", "Headquarter 編曲工作桌", "Roundy Desk 圓氣桌",
    "Allround Desk 電動升降桌", "Dyback 04 電動升降桌", "Clip 可立小桌", "Edgee 萬用邊桌",
    "City Desk® 國民升降桌", "其他"
  ],

  /* 開始使用年份 */
  years: ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026", "忘記了"],

  /* 欄位上限 */
  limits: { name: 12, story: 50, title: 10, photoMB: 10 }
});
