const APP_URL_PATTERN = "https://dingus-droid.github.io/brotherboard/*";
const APP_BASE_URL = "https://dingus-droid.github.io/brotherboard/";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "rsvp4dingus-parent",
    title: "Paste to RSVP4Dingus",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "rsvp4dingus-replace",
    parentId: "rsvp4dingus-parent",
    title: "Replace",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "rsvp4dingus-append",
    parentId: "rsvp4dingus-parent",
    title: "Append",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  const mode =
    info.menuItemId === "rsvp4dingus-append" ? "append" :
    info.menuItemId === "rsvp4dingus-replace" ? "replace" :
    null;
  if (!mode) return;

  const text = info.selectionText || "";
  if (!text) return;

  const tabs = await chrome.tabs.query({ url: APP_URL_PATTERN });

  if (tabs.length > 0) {
    const tab = tabs[0];
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "rsvp4dingus-paste", mode, text });
    } catch (err) {
      // Content script may not be ready yet (tab still loading); nothing
      // more we can do for this click without a much heavier retry/reload
      // flow, so just leave the tab focused below and let the user retry.
    }
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId != null) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  } else {
    const url = APP_BASE_URL + "?text=" + encodeURIComponent(text);
    await chrome.tabs.create({ url });
  }
});
