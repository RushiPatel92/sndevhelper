/*
 * background.js — MV3 service worker.
 * Currently just wires the keyboard shortcut to the field-name toggle.
 * Good place to later add: context menus, cross-tab state, alarms, etc.
 */

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-field-names") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/\.service-now\.com/.test(tab.url || "")) return;
  postWindowMessageInAllFrames(tab.id, "TOGGLE_FIELD_NAMES");
});

function sendToTab(tabId, msg, options) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, msg, options).catch(() => {});
}

function togglePaletteInTopFrame(tabId) {
  if (!tabId) return;
  sendToTab(tabId, { type: "TOGGLE_PALETTE" }, { frameId: 0 });
  chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: () => {
      window.postMessage(
        { source: "SN_DEV_HELPER_FRAME_COMMAND", type: "TOGGLE_PALETTE" },
        location.origin
      );
    },
  }).catch(() => {});
}

function postWindowMessageInAllFrames(tabId, type) {
  if (!tabId) return;
  chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: (messageType) => {
      window.postMessage(
        { source: "SN_DEV_HELPER_FRAME_COMMAND", type: messageType },
        location.origin
      );
    },
    args: [type],
  }).catch(() => {});
}

function extractSysId() {
  const fromText = (text) => {
    if (!text) return null;
    let value = String(text);
    for (let i = 0; i < 3; i++) {
      const workspaceMatch = value.match(
        /\/now\/(?:[^/?#]+\/)*record\/[^/?#]+\/([0-9a-f]{32})(?:[/?#]|$)/i
      );
      if (workspaceMatch) return workspaceMatch[1];

      const match = value.match(/(?:[?&]sys_id=|sys_id=)([0-9a-f]{32})/i);
      if (match) return match[1];
      try {
        const decoded = decodeURIComponent(value);
        if (decoded === value) break;
        value = decoded;
      } catch (e) {
        break;
      }
    }
    return null;
  };

  try {
    if (typeof g_form !== "undefined" && g_form) {
      const id = g_form.getUniqueValue && g_form.getUniqueValue();
      if (id && /^[0-9a-f]{32}$/i.test(id)) return id;
    }
  } catch (e) {}

  return fromText(location.href);
}

// Content scripts can't call chrome.tabs.create; they ask us via OPEN_URL.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "OPEN_URL" && msg.url) {
    chrome.tabs.create({ url: msg.url });
  }
  if (
    msg &&
    sender.tab &&
    (msg.type === "TOGGLE_FIELD_NAMES" || msg.type === "TOGGLE_TRANSLATIONS")
  ) {
    postWindowMessageInAllFrames(sender.tab.id, msg.type);
  }
  if (msg && msg.type === "GET_SYS_ID" && sender.tab) {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, allFrames: true },
      world: "MAIN",
      func: extractSysId,
    }).then((results) => {
      const found = results
        .map((item) => item && item.result)
        .find((id) => id && /^[0-9a-f]{32}$/i.test(id));
      sendResponse({ ok: Boolean(found), sysId: found || null });
    }).catch((error) => {
      sendResponse({ ok: false, error: String(error) });
    });
    return true;
  }
  // A sub-frame (e.g. gsft_main) pressed the shortcut; relay to the whole
  // tab so the top frame's content script can toggle the palette.
  if (msg && msg.type === "TOGGLE_PALETTE" && sender.tab) {
    togglePaletteInTopFrame(sender.tab.id);
  }
});
