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
    // Multiple matches happen when the app is open both as a regular tab
    // and as an installed desktop app window -- pick whichever one was
    // actually used most recently instead of an arbitrary match, so text
    // doesn't land in a window the user isn't looking at.
    const tab = tabs.reduce((a, b) => (b.lastAccessed ?? 0) > (a.lastAccessed ?? 0) ? b : a);
    let delivered = false;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "rsvp4dingus-paste", mode, text });
      delivered = true;
    } catch (err) {
      // No listener on the other end -- most commonly because this tab was
      // already open *before* the extension was installed/enabled, so it
      // never got the content script injected (Chrome doesn't retroactively
      // inject into already-open tabs). Reloading with ?text= reuses the
      // page-load path instead, which always works. This does mean Append
      // degrades to Replace in this one fallback case, since a fresh page
      // load has nothing to append to.
    }
    if (!delivered) {
      await chrome.tabs.update(tab.id, {
        url: APP_BASE_URL + "?text=" + encodeURIComponent(text),
        active: true,
      });
    } else {
      await chrome.tabs.update(tab.id, { active: true });
    }
    if (tab.windowId != null) {
      // state:"normal" is needed on top of focused:true -- a minimized
      // window can be marked focused without actually being restored to
      // the screen, so this forces it back into view too.
      await chrome.windows.update(tab.windowId, { focused: true, state: "normal" });
    }
  } else {
    const url = APP_BASE_URL + "?text=" + encodeURIComponent(text);
    await chrome.tabs.create({ url });
  }
});
