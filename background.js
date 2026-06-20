/*
 * background.js — MV3 service worker.
 * Currently just wires the keyboard shortcut to the field-name toggle.
 * Good place to later add: context menus, cross-tab state, alarms, etc.
 */

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-field-names") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/\.service-now\.com/.test(tab.url || "")) return;
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FIELD_NAMES" }).catch(() => {});
});

// Content scripts can't call chrome.tabs.create; they ask us via OPEN_URL.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "OPEN_URL" && msg.url) {
    chrome.tabs.create({ url: msg.url });
  }
});
