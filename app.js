(() => {
  "use strict";

  const CFG = window.APP_CONFIG;
  const KEY = "pocket-ledger-v1";
  const FREE_GOALS = 1;

  const CATS = {
    out: [
      ["food", "🍚"], ["transport", "🚌"], ["home", "🏠"], ["health", "💊"],
      ["education", "📚"], ["family", "👪"], ["phone", "📱"], ["business", "🧰"],
      ["fun", "🎉"], ["other", "📦"],
    ],
    in: [["salary", "💼"], ["sales", "🛒"], ["gift", "🎁"], ["other", "📦"]],
  };
  const emojiOf = (type, cat) => (CATS[type].find((c) => c[0] === cat) || ["", "📦"])[1];

  // Best-guess currency from the device's region; users can change it in Settings.
  const REGION_CURRENCY = {
    US: "USD", GB: "GBP", NG: "NGN", KE: "KES", GH: "GHS", ZA: "ZAR", EG: "EGP", ET: "ETB",
    TZ: "TZS", UG: "UGX", IN: "INR", PK: "PKR", BD: "BDT", ID: "IDR", PH: "PHP", VN: "VND",
    CN: "CNY", JP: "JPY", KR: "KRW", BR: "BRL", MX: "MXN", AR: "ARS", CO: "COP", PE: "PEN",
    CL: "CLP", CA: "CAD", AU: "AUD", NZ: "NZD", TR: "TRY", SA: "SAR", AE: "AED", MA: "MAD",
    RU: "RUB", UA: "UAH", PL: "PLN", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", TH: "THB",
    MY: "MYR", SG: "SGD", FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", PT: "EUR", NL: "EUR",
    BE: "EUR", IE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", SN: "XOF", CI: "XOF", CM: "XAF",
  };

  function guessLang() {
    for (const l of navigator.languages || [navigator.language || "en"]) {
      const base = l.toLowerCase().split("-")[0];
      if (I18N[base]) return base;
    }
    return "en";
  }
  function guessCurrency() {
    const region = (navigator.language || "").split("-")[1];
    return REGION_CURRENCY[(region || "").toUpperCase()] || "USD";
  }

  // ---------- state ----------
  const defaults = () => ({
    tx: [], goals: [], budgets: {},
    lang: guessLang(), currency: guessCurrency(), pro: false,
  });
  let S;
  try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch { S = defaults(); }
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch { toast("⚠️ Storage full or blocked"); }
  };

  let tab = "home";
  let month = new Date(); month.setDate(1);

  // ---------- helpers ----------
  const t = (k) => (I18N[S.lang] && I18N[S.lang][k]) || I18N.en[k] || k;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const parseAmt = (v) => {
    let s = String(v).trim().replace(/\s/g, "");
    // Accept both 1,234.56 and 1.234,56 and 12,5
    if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else if (s.includes(",")) s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
    const n = Math.round(parseFloat(s) * 100) / 100;
    return isFinite(n) && n > 0 ? n : null;
  };
  let nf;
  const money = (n) => {
    if (!nf || nf._k !== S.lang + S.currency) {
      try { nf = new Intl.NumberFormat(S.lang, { style: "currency", currency: S.currency, currencyDisplay: "narrowSymbol" }); }
      catch { nf = new Intl.NumberFormat(S.lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
      nf._k = S.lang + S.currency;
    }
    return nf.format(n);
  };
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const monthTx = () => S.tx.filter((x) => x.date.startsWith(ym(month)));
  const sum = (list, type) => list.filter((x) => x.type === type).reduce((a, x) => a + x.amount, 0);

  // ---------- views ----------
  function render() {
    const dir = (I18N[S.lang] && I18N[S.lang]._dir) || "ltr";
    document.documentElement.lang = S.lang;
    document.documentElement.dir = dir;
    $("#proBadge").hidden = !S.pro;
    $("#fab").hidden = tab !== "home";

    const tabs = [["home", "🏠"], ["budgets", "📊"], ["goals", "🎯"], ["settings", "⚙️"]];
    $("#tabs").innerHTML = tabs.map(([k, e]) =>
      `<button data-tab="${k}" ${tab === k ? 'aria-current="page"' : ""}><span>${e}</span>${esc(t(k))}</button>`).join("");

    $("#view").innerHTML = ({ home: viewHome, budgets: viewBudgets, goals: viewGoals, settings: viewSettings })[tab]();
  }

  function monthNav() {
    const label = month.toLocaleDateString(S.lang, { month: "long", year: "numeric" });
    return `<div class="month-nav">
      <button class="icon-btn" data-act="prev" aria-label="previous">${document.documentElement.dir === "rtl" ? "›" : "‹"}</button>
      <strong>${esc(label)}</strong>
      <button class="icon-btn" data-act="next" aria-label="next">${document.documentElement.dir === "rtl" ? "‹" : "›"}</button>
    </div>`;
  }

  function viewHome() {
    const list = monthTx().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const inc = sum(list, "in"), out = sum(list, "out"), bal = inc - out;

    const byCat = {};
    list.filter((x) => x.type === "out").forEach((x) => (byCat[x.cat] = (byCat[x.cat] || 0) + x.amount));
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = cats.length ? cats[0][1] : 1;
    const breakdown = cats.length ? `<div class="card">
        <div class="row"><strong>${esc(t("proF4"))}</strong>${S.pro ? "" : `<span class="badge">PRO</span>`}</div>
        ${S.pro
          ? `<ul class="list">${cats.map(([c, v]) => `<li><span class="emoji">${emojiOf("out", c)}</span>
              <div class="grow"><div class="row"><span>${esc(t("c_" + c))}</span><span class="amt">${money(v)}</span></div>
              <div class="bar"><i style="width:${(v / max) * 100}%"></i></div></div></li>`).join("")}</ul>`
          : `<p class="muted small">${esc(t("proOnly"))}</p><button class="btn ghost" data-act="pro">${esc(t("buy"))} · ${esc(CFG.price)}</button>`}
      </div>` : "";

    return `${monthNav()}
      <section class="card">
        <div class="muted small">${esc(t("balance"))}</div>
        <div class="big ${bal < 0 ? "out" : ""}">${money(bal)}</div>
        <div class="split">
          <div><div class="muted small">${esc(t("income"))}</div><div class="amt in">+${money(inc)}</div></div>
          <div><div class="muted small">${esc(t("expenses"))}</div><div class="amt out">−${money(out)}</div></div>
        </div>
      </section>
      ${breakdown}
      <section class="card">
        ${list.length ? `<ul class="list">${list.map((x) => `
          <li data-edit="${x.id}" style="cursor:pointer">
            <span class="emoji">${emojiOf(x.type, x.cat)}</span>
            <div class="grow">
              <div class="ellipsis">${esc(x.note || t("c_" + x.cat))}</div>
              <div class="muted small">${esc(new Date(x.date + "T00:00").toLocaleDateString(S.lang, { day: "numeric", month: "short" }))} · ${esc(t("c_" + x.cat))}</div>
            </div>
            <span class="amt ${x.type}">${x.type === "in" ? "+" : "−"}${money(x.amount)}</span>
          </li>`).join("")}</ul>`
        : `<p class="empty muted">${esc(t("noTx"))}</p>`}
      </section>`;
  }

  function viewBudgets() {
    const list = monthTx();
    const rows = CATS.out.map(([c, e]) => {
      const spent = list.filter((x) => x.type === "out" && x.cat === c).reduce((a, x) => a + x.amount, 0);
      const b = S.budgets[c];
      const pct = b ? Math.min(100, (spent / b) * 100) : 0;
      const over = b && spent > b;
      return `<li data-budget="${c}" style="cursor:pointer">
        <span class="emoji">${e}</span>
        <div class="grow">
          <div class="row"><span>${esc(t("c_" + c))}</span>
            <span class="amt small">${money(spent)}${b ? ` / ${money(b)}` : ""}</span></div>
          ${b ? `<div class="bar ${over ? "over" : ""}"><i style="width:${pct}%"></i></div>
            <div class="small ${over ? "out" : "muted"}">${over ? `${money(spent - b)} ${esc(t("over"))}` : `${money(b - spent)} ${esc(t("left"))}`}</div>` : ""}
        </div></li>`;
    }).join("");
    return `${monthNav()}
      ${S.pro ? "" : proCard()}
      <p class="muted">${esc(t("budgetsIntro"))}</p>
      <section class="card"><ul class="list">${rows}</ul></section>`;
  }

  function viewGoals() {
    const g = S.goals.map((x) => {
      const pct = Math.min(100, (x.saved / x.target) * 100);
      return `<section class="card">
        <div class="row"><strong class="ellipsis">${esc(x.name)}</strong><span class="muted small">${Math.floor(pct)}%</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="row small" style="margin-top:6px"><span>${esc(t("saved"))}: <b class="amt">${money(x.saved)}</b></span><span class="muted">${esc(t("target"))}: ${money(x.target)}</span></div>
        <div class="split"><button class="btn ghost" data-goal-add="${x.id}">+ ${esc(t("addToGoal"))}</button>
        <button class="btn ghost" data-goal-edit="${x.id}">${esc(t("edit"))}</button></div>
      </section>`;
    }).join("");
    return `<p class="muted">${esc(t("goalsIntro"))}</p>
      ${g || `<p class="empty muted">${esc(t("noGoals"))}</p>`}
      <button class="btn" data-act="new-goal">+ ${esc(t("newGoal"))}</button>`;
  }

  function currencyOptions() {
    let list;
    try { list = Intl.supportedValuesOf("currency"); } catch { list = [...new Set(Object.values(REGION_CURRENCY))].sort(); }
    if (!list.includes(S.currency)) list.push(S.currency);
    let names;
    try { names = new Intl.DisplayNames([S.lang], { type: "currency" }); } catch { names = null; }
    return list.map((c) => `<option value="${c}" ${c === S.currency ? "selected" : ""}>${c}${names ? " — " + esc(names.of(c)) : ""}</option>`).join("");
  }

  function proCard() {
    return `<section class="card pro-card">
      <strong>${esc(t("proTitle"))} · ${esc(CFG.price)}</strong>
      <p class="muted small" style="margin:4px 0">${esc(t("proPitch"))}</p>
      <ul class="small">${["proF1", "proF2", "proF3", "proF4"].map((k) => `<li>${esc(t(k))}</li>`).join("")}</ul>
      <button class="btn" data-act="pro">${esc(t("buy"))}</button>
    </section>`;
  }

  function viewSettings() {
    return `${S.pro ? "" : proCard()}
      <section class="card">
        <label for="lang">${esc(t("language"))}</label>
        <select id="lang">${Object.entries(I18N).map(([k, v]) => `<option value="${k}" ${k === S.lang ? "selected" : ""}>${esc(v._name)}</option>`).join("")}</select>
        <label for="cur">${esc(t("currency"))}</label>
        <select id="cur">${currencyOptions()}</select>
      </section>
      <section class="card">
        <button class="btn ghost" data-act="csv">${esc(t("exportCsv"))}${S.pro ? "" : " 🔒"}</button>
        <button class="btn ghost" data-act="backup">${esc(t("backup"))}</button>
        <button class="btn ghost" data-act="restore">${esc(t("restore"))}</button>
        <input type="file" id="restoreFile" accept="application/json,.json" hidden>
        <button class="btn danger" data-act="reset">${esc(t("resetAll"))}</button>
      </section>
      <p class="muted small">🔒 ${esc(t("privacy"))}</p>
      <p class="muted small">📲 ${esc(t("install"))}</p>`;
  }

  // ---------- sheets ----------
  const sheet = $("#sheet");
  function open(html, onMount) {
    sheet.innerHTML = `<div class="sheet">${html}</div>`;
    sheet.showModal();
    onMount && onMount(sheet);
  }
  const close = () => sheet.close();
  sheet.addEventListener("click", (e) => { if (e.target === sheet) close(); });

  function txSheet(existing) {
    let type = existing ? existing.type : "out";
    let cat = existing ? existing.cat : "food";
    const draw = () => {
      if (!CATS[type].some((c) => c[0] === cat)) cat = CATS[type][0][0];
      open(`<form id="txf">
        <div class="seg">
          <button type="button" data-type="out" class="${type === "out" ? "on" : ""}">− ${esc(t("expense"))}</button>
          <button type="button" data-type="in" class="${type === "in" ? "on" : ""}">+ ${esc(t("income"))}</button>
        </div>
        <label for="amt">${esc(t("amount"))} (${esc(S.currency)})</label>
        <input id="amt" class="amount-input" inputmode="decimal" autocomplete="off" required value="${existing ? existing.amount : ""}" placeholder="0">
        <label>${esc(t("category"))}</label>
        <div class="cats">${CATS[type].map(([c, e]) => `<button type="button" data-cat="${c}" class="${c === cat ? "on" : ""}"><span>${e}</span>${esc(t("c_" + c))}</button>`).join("")}</div>
        <label for="note">${esc(t("note"))}</label>
        <input id="note" maxlength="80" value="${existing ? esc(existing.note || "") : ""}">
        <label for="dt">${esc(t("date"))}</label>
        <input id="dt" type="date" required value="${existing ? existing.date : today()}">
        <button class="btn" type="submit">${esc(t("save"))}</button>
        ${existing ? `<button class="btn danger" type="button" data-del>${esc(t("delete"))}</button>` : ""}
        <button class="btn ghost" type="button" data-close>${esc(t("cancel"))}</button>
      </form>`, (el) => {
        const keep = () => ({ amt: $("#amt", el).value, note: $("#note", el).value, dt: $("#dt", el).value });
        const restore = (v) => { $("#amt", el).value = v.amt; $("#note", el).value = v.note; $("#dt", el).value = v.dt; };
        el.querySelectorAll("[data-type]").forEach((b) => b.onclick = () => { const v = keep(); type = b.dataset.type; draw(); restore(v); });
        el.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => {
          cat = b.dataset.cat; el.querySelectorAll("[data-cat]").forEach((x) => x.classList.toggle("on", x === b));
        });
        $("[data-close]", el).onclick = close;
        const del = $("[data-del]", el);
        if (del) del.onclick = () => { S.tx = S.tx.filter((x) => x.id !== existing.id); persist(); close(); render(); };
        $("#txf", el).onsubmit = (e) => {
          e.preventDefault();
          const amount = parseAmt($("#amt", el).value);
          if (!amount) { $("#amt", el).focus(); return; }
          const rec = { id: existing ? existing.id : uid(), type, cat, amount, note: $("#note", el).value.trim(), date: $("#dt", el).value || today() };
          if (existing) S.tx = S.tx.map((x) => (x.id === rec.id ? rec : x)); else S.tx.push(rec);
          persist(); close();
          const [y, m] = rec.date.split("-").map(Number); month = new Date(y, m - 1, 1);
          render(); toast(t("savedMsg"));
        };
        if (!existing) setTimeout(() => $("#amt", el).focus(), 50);
      });
    };
    draw();
  }

  function budgetSheet(cat) {
    if (!S.pro) return proSheet();
    open(`<form id="bf">
      <h2>${emojiOf("out", cat)} ${esc(t("c_" + cat))}</h2>
      <label for="b">${esc(t("budget"))} (${esc(S.currency)})</label>
      <input id="b" class="amount-input" inputmode="decimal" value="${S.budgets[cat] || ""}" placeholder="0">
      <button class="btn" type="submit">${esc(t("save"))}</button>
      <button class="btn ghost" type="button" data-close>${esc(t("cancel"))}</button>
    </form>`, (el) => {
      $("[data-close]", el).onclick = close;
      $("#bf", el).onsubmit = (e) => {
        e.preventDefault();
        const v = parseAmt($("#b", el).value);
        if (v) S.budgets[cat] = v; else delete S.budgets[cat];
        persist(); close(); render();
      };
    });
  }

  function goalSheet(goal) {
    if (!goal && !S.pro && S.goals.length >= FREE_GOALS) return proSheet();
    open(`<form id="gf">
      <h2>${esc(goal ? goal.name : t("newGoal"))}</h2>
      <label for="gn">${esc(t("goalName"))}</label>
      <input id="gn" maxlength="40" required value="${goal ? esc(goal.name) : ""}">
      <label for="gt">${esc(t("target"))} (${esc(S.currency)})</label>
      <input id="gt" inputmode="decimal" required value="${goal ? goal.target : ""}">
      <label for="gs">${esc(t("saved"))}</label>
      <input id="gs" inputmode="decimal" value="${goal ? goal.saved : ""}" placeholder="0">
      <button class="btn" type="submit">${esc(t("save"))}</button>
      ${goal ? `<button class="btn danger" type="button" data-del>${esc(t("delete"))}</button>` : ""}
      <button class="btn ghost" type="button" data-close>${esc(t("cancel"))}</button>
    </form>`, (el) => {
      $("[data-close]", el).onclick = close;
      const del = $("[data-del]", el);
      if (del) del.onclick = () => { S.goals = S.goals.filter((g) => g.id !== goal.id); persist(); close(); render(); };
      $("#gf", el).onsubmit = (e) => {
        e.preventDefault();
        const target = parseAmt($("#gt", el).value);
        if (!target) return $("#gt", el).focus();
        const rec = { id: goal ? goal.id : uid(), name: $("#gn", el).value.trim(), target, saved: parseAmt($("#gs", el).value) || 0 };
        S.goals = goal ? S.goals.map((g) => (g.id === rec.id ? rec : g)) : [...S.goals, rec];
        persist(); close(); render();
      };
    });
  }

  function goalAddSheet(goal) {
    open(`<form id="ga">
      <h2>${esc(goal.name)}</h2>
      <label for="ga-amt">${esc(t("addToGoal"))} (${esc(S.currency)})</label>
      <input id="ga-amt" class="amount-input" inputmode="decimal" required placeholder="0">
      <button class="btn" type="submit">${esc(t("save"))}</button>
      <button class="btn ghost" type="button" data-close>${esc(t("cancel"))}</button>
    </form>`, (el) => {
      $("[data-close]", el).onclick = close;
      setTimeout(() => $("#ga-amt", el).focus(), 50);
      $("#ga", el).onsubmit = (e) => {
        e.preventDefault();
        const v = parseAmt($("#ga-amt", el).value);
        if (!v) return;
        goal.saved = Math.round((goal.saved + v) * 100) / 100;
        persist(); close(); render();
        if (goal.saved >= goal.target) toast("🎉 " + goal.name);
      };
    });
  }

  function proSheet() {
    open(`<h2>${esc(t("proTitle"))} · ${esc(CFG.price)}</h2>
      <p class="muted">${esc(t("proPitch"))}</p>
      <ul>${["proF1", "proF2", "proF3", "proF4"].map((k) => `<li>${esc(t(k))}</li>`).join("")}</ul>
      <a class="btn" href="${esc(CFG.checkoutUrl)}" target="_blank" rel="noopener">${esc(t("buy"))} · ${esc(CFG.price)}</a>
      <form id="kf">
        <label for="key">${esc(t("haveKey"))}</label>
        <input id="key" autocomplete="off" autocapitalize="characters" placeholder="${esc(t("licenseKey"))}" required>
        <button class="btn ghost" type="submit">${esc(t("unlock"))}</button>
      </form>
      <button class="btn ghost" type="button" data-close>${esc(t("cancel"))}</button>`, (el) => {
      $("[data-close]", el).onclick = close;
      $("#kf", el).onsubmit = async (e) => {
        e.preventDefault();
        const btn = $("#kf button", el);
        btn.disabled = true; btn.textContent = t("checking");
        const ok = await verifyLicense($("#key", el).value.trim());
        btn.disabled = false; btn.textContent = t("unlock");
        if (ok) { S.pro = true; persist(); close(); render(); toast("✨ " + t("unlocked")); }
        else toast(t("badKey"));
      };
    });
  }

  async function verifyLicense(key) {
    if (!key) return false;
    if (CFG.demoKey && key.toUpperCase() === CFG.demoKey.toUpperCase()) return true;
    if (!CFG.gumroadProductId) return false;
    try {
      const r = await fetch("https://api.gumroad.com/v2/licenses/verify", {
        method: "POST",
        body: new URLSearchParams({ product_id: CFG.gumroadProductId, license_key: key }),
      });
      const j = await r.json();
      return !!(j.success && !(j.purchase && (j.purchase.refunded || j.purchase.chargebacked)));
    } catch { return false; }
  }

  function exportCsv() {
    if (!S.pro) return proSheet();
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["date", "type", "category", "amount", "currency", "note"]]
      .concat([...S.tx].sort((a, b) => a.date.localeCompare(b.date))
        .map((x) => [x.date, x.type === "in" ? "income" : "expense", x.cat, x.amount, S.currency, x.note || ""]));
    download(`pocket-ledger-${today()}.csv`, "﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n"), "text/csv");
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-tab],[data-act],[data-edit],[data-budget],[data-goal-add],[data-goal-edit]");
    if (!el || sheet.contains(el)) return;
    const d = el.dataset;
    if (d.tab) { tab = d.tab; render(); window.scrollTo(0, 0); return; }
    if (d.edit) return txSheet(S.tx.find((x) => x.id === d.edit));
    if (d.budget) return budgetSheet(d.budget);
    if (d.goalAdd) return goalAddSheet(S.goals.find((g) => g.id === d.goalAdd));
    if (d.goalEdit) return goalSheet(S.goals.find((g) => g.id === d.goalEdit));
    switch (d.act) {
      case "prev": month.setMonth(month.getMonth() - 1); render(); break;
      case "next": month.setMonth(month.getMonth() + 1); render(); break;
      case "pro": proSheet(); break;
      case "new-goal": goalSheet(); break;
      case "csv": exportCsv(); break;
      case "backup": download(`pocket-ledger-backup-${today()}.json`, JSON.stringify(S), "application/json"); break;
      case "restore": $("#restoreFile").click(); break;
      case "reset":
        open(`<h2>${esc(t("resetAll"))}</h2><p>${esc(t("confirmReset"))}</p>
          <button class="btn danger" type="button" data-yes>${esc(t("delete"))}</button>
          <button class="btn ghost" type="button" data-close>${esc(t("cancel"))}</button>`, (el) => {
          $("[data-close]", el).onclick = close;
          $("[data-yes]", el).onclick = () => { const keepPro = S.pro; S = defaults(); S.pro = keepPro; persist(); close(); render(); };
        });
        break;
    }
  });
  document.addEventListener("change", async (e) => {
    if (e.target.id === "lang") { S.lang = e.target.value; persist(); render(); }
    if (e.target.id === "cur") { S.currency = e.target.value; persist(); render(); }
    if (e.target.id === "restoreFile" && e.target.files[0]) {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        if (!Array.isArray(data.tx)) throw new Error("bad file");
        S = Object.assign(defaults(), data, { pro: S.pro || !!data.pro });
        persist(); render(); toast(t("restored"));
      } catch { toast("⚠️ " + t("restore") + " ✗"); }
    }
  });
  $("#fab").onclick = () => txSheet();

  render();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
