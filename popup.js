/*
 * popup.js — extension page (ISOLATED from the SN page).
 * Reads SN page globals via chrome.scripting.executeScript with world:"MAIN",
 * targeting ALL frames so we catch the gsft_main iframe in the classic UI.
 */

const $ = (id) => document.getElementById(id);
let ORIGIN = null; // e.g. https://dev12345.service-now.com
let ACTIVE_TAB_ID = null;

function toast(msg, isError) {
  const t = $("toast");
  t.textContent = msg;
  t.style.color = isError ? "#ff8b8b" : "var(--accent)";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.textContent = ""), 2500);
}

/* ---- runs in the SN page MAIN world; must be self-contained ---- */
function probe() {
  const out = { found: false, href: location.href };
  try {
    if (typeof g_user !== "undefined" && g_user) {
      out.found = true;
      out.userName = g_user.userName;
      out.fullName = [g_user.firstName, g_user.lastName].filter(Boolean).join(" ");
      out.userID = g_user.userID;
      try { out.roles = g_user.userRoles || (g_user.getRoles && g_user.getRoles()); } catch (e) {}
    }
    if (typeof g_ck !== "undefined") out.token = g_ck;
    if (typeof window.NOW !== "undefined" && window.NOW) {
      out.found = true;
      out.node = window.NOW.node || window.NOW.nodeName || null;
      out.version =
        (window.NOW.glide && window.NOW.glide.version) ||
        window.NOW.glideVersion || null;
    }
    if (typeof g_form !== "undefined" && g_form) {
      out.found = true;
      try { out.table = g_form.getTableName(); } catch (e) {}
      try { out.sysId = g_form.getUniqueValue(); } catch (e) {}
    }
  } catch (e) { out.error = String(e); }
  return out;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function runInPage(func, args, options) {
  const tab = (options && options.tab) || await getActiveTab();
  if (!tab) return { tab: null, results: [] };
  let results = [];
  const timeoutMs = (options && options.timeoutMs) || 2500;
  const injection = chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: "MAIN",
      func,
      args: args || [],
    }).catch(() => []);
  results = await withTimeout(injection, timeoutMs, []);
  return { tab, results };
}

function pickFrame(results) {
  // Prefer a frame that actually found SN context (and ideally has a form).
  const found = results.map((r) => r.result).filter((r) => r && r.found);
  return found.find((r) => r.sysId) || found[0] || null;
}

function setStatus(text, cls) {
  const s = $("status");
  s.textContent = text;
  s.className = "status" + (cls ? " " + cls : "");
}

function renderInfo(data) {
  const el = $("info");
  if (!data) {
    el.innerHTML = '<div class="muted">No ServiceNow context found on this tab.</div>';
    return;
  }
  const rows = [];
  const add = (k, v, mono) => {
    if (!v) return;
    rows.push(
      `<div class="k">${k}</div><div class="v${mono ? " mono" : ""}">${v}</div>`
    );
  };
  const instance = ORIGIN ? ORIGIN.replace(/^https?:\/\//, "") : "";
  add("Instance", instance);
  add("User", data.fullName ? `${data.fullName} (${data.userName})` : data.userName);
  add("Node", data.node);
  add("Version", data.version);
  add("Table", data.table, true);
  add("sys_id", data.sysId, true);
  el.innerHTML = rows.length
    ? `<div class="kv">${rows.join("")}</div>`
    : '<div class="muted">Connected, but no extra context available here.</div>';
}

/* ---- best-effort node/version via /stats.do (authenticated, same host) ---- */
async function fetchStats(data) {
  if (!ORIGIN) return;
  try {
    const res = await fetch(ORIGIN + "/stats.do", { credentials: "include" });
    if (!res.ok) return;
    const txt = await res.text();
    const m = (re) => { const x = txt.match(re); return x ? x[1].trim() : null; };
    data.version = data.version || m(/Build name:\s*([^\n<]+)/i);
    data.node = data.node || m(/Instance name:\s*([^\n<]+)/i) || m(/node:\s*([^\n<]+)/i);
    renderInfo(data);
  } catch (e) { /* ignore */ }
}

const DEV_LINKS = [
  ["Background Scripts", "/sys.scripts.do"],
  ["Script Includes", "/sys_script_include_list.do"],
  ["Business Rules", "/sys_script_list.do"],
  ["Client Scripts", "/sys_script_client_list.do"],
  ["UI Actions", "/sys_ui_action_list.do"],
  ["System Logs", "/syslog_list.do?sysparm_query=ORDERBYDESCsys_created_on"],
  ["Update Sets", "/sys_update_set_list.do"],
  ["Scheduled Jobs", "/sysauto_script_list.do"],
  ["Fix Scripts", "/sys_script_fix_list.do"],
  ["Sys Properties", "/sys_properties_list.do"],
  ["REST Explorer", "/$restapi.do"],
  ["Flow Designer", "/$flow-designer.do"],
];

function renderLinks() {
  const box = $("links");
  box.innerHTML = "";
  DEV_LINKS.forEach(([label, path]) => {
    const a = document.createElement("a");
    a.textContent = label;
    a.href = "#";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (!ORIGIN) return toast("No instance detected", true);
      chrome.tabs.create({ url: ORIGIN + path });
    });
    box.appendChild(a);
  });
}

function openTable(mode) {
  if (!ORIGIN) return toast("No instance detected", true);
  const raw = $("jump").value.trim();
  if (!raw) return;
  // "table sysid" -> open that record; otherwise list/new form for the table.
  const parts = raw.split(/\s+/);
  const table = parts[0].replace(/_list\.do$|\.do$/i, "");
  const maybeId = parts[1];
  let url;
  if (maybeId && /^[0-9a-f]{32}$/i.test(maybeId)) {
    url = `${ORIGIN}/${table}.do?sys_id=${maybeId}`;
  } else if (mode === "new") {
    url = `${ORIGIN}/${table}.do?sys_id=-1`;
  } else {
    url = `${ORIGIN}/${table}_list.do`;
  }
  chrome.tabs.create({ url });
}

async function init() {
  const tab = await getActiveTab();
  if (tab && tab.url) {
    try { ORIGIN = new URL(tab.url).origin; } catch (e) {}
    ACTIVE_TAB_ID = tab.id;
  }
  const isSN = ORIGIN && /\.service-now\.com$/.test(new URL(ORIGIN).hostname);
  renderLinks();

  if (!isSN) {
    setStatus("not SN", "bad");
    renderInfo(null);
    return;
  }

  setStatus("connected", "ok");
  renderInfo({ found: true });

  const { results } = await runInPage(probe, [], { tab, timeoutMs: 2500 });
  const data = pickFrame(results) || { found: true };
  renderInfo(data);
  if (!data.version || !data.node) fetchStats(data);

  // sys_id
  $("copySysId").addEventListener("click", async () => {
    const { results: r } = await runInPage(probe);
    const d = pickFrame(r);
    if (d && d.sysId) {
      try {
        await navigator.clipboard.writeText(d.sysId);
        toast("Copied " + d.sysId);
      } catch (e) { toast("Copy failed", true); }
    } else {
      toast("No record form open", true);
    }
  });

  // field-name toggle (message goes to all frames; gsft_main handles it)
  $("toggleFields").addEventListener("click", async () => {
    chrome.tabs.sendMessage(ACTIVE_TAB_ID, { type: "TOGGLE_FIELD_NAMES" }, (resp) => {
      if (chrome.runtime.lastError) return; // some frames have no listener
      if (resp && resp.ok) toast(resp.on ? `Showing ${resp.count} field names` : "Field names hidden");
    });
  });

  // translation-icons toggle
  $("toggleTranslations").addEventListener("click", () => {
    chrome.tabs.sendMessage(ACTIVE_TAB_ID, { type: "TOGGLE_TRANSLATIONS" }, (resp) => {
      if (chrome.runtime.lastError) return;
      if (resp && resp.ok)
        toast(resp.on ? `Translation icons on (${resp.count})` : "Translation icons hidden");
    });
  });
}

$("jumpList").addEventListener("click", () => openTable("list"));
$("jumpNew").addEventListener("click", () => openTable("new"));
$("jump").addEventListener("keydown", (e) => { if (e.key === "Enter") openTable("list"); });

document.addEventListener("DOMContentLoaded", init);
