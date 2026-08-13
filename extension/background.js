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

/* Runs inside the page the user right-clicked on (injected on demand via
   chrome.scripting, not a declared content script -- works on any site,
   not just RSVP4Dingus) to build paragraph-aware plain text from the
   current selection, the same way the app's own Paste button does.
   Chrome's info.selectionText flattens paragraph structure with no way
   to recover it, which is why Replace/Append lost paragraph spacing
   that the Paste button (reading the clipboard's HTML) kept. */
function extractSelectionText() {
  const BLOCK_TAGS = new Set([
    "P", "DIV", "LI", "TR", "H1", "H2", "H3", "H4", "H5", "H6",
    "BLOCKQUOTE", "PRE", "SECTION", "ARTICLE", "HEADER", "FOOTER",
    "UL", "OL", "TABLE", "TBODY", "THEAD",
  ]);
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const container = document.createElement("div");
  for (let i = 0; i < sel.rangeCount; i++) {
    container.appendChild(sel.getRangeAt(i).cloneContents());
  }

  let out = "";
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent.replace(/\s+/g, " ");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === "SCRIPT" || node.tagName === "STYLE") return;
    if (node.tagName === "BR") {
      out += "\n";
      return;
    }
    const isBlock = BLOCK_TAGS.has(node.tagName);
    node.childNodes.forEach(walk);
    if (isBlock) out += "\n\n";
  };
  container.childNodes.forEach(walk);
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

chrome.contextMenus.onClicked.addListener(async (info, sourceTab) => {
  const mode =
    info.menuItemId === "rsvp4dingus-append" ? "append" :
    info.menuItemId === "rsvp4dingus-replace" ? "replace" :
    null;
  if (!mode) return;

  let text = info.selectionText || "";

  if (sourceTab && sourceTab.id != null) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: sourceTab.id },
        func: extractSelectionText,
      });
      const structured = results && results[0] && results[0].result;
      if (structured) text = structured;
    } catch (err) {
      // Falls back to info.selectionText above -- covers pages that
      // block script injection (chrome:// pages, the Web Store, etc.).
    }
  }

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
