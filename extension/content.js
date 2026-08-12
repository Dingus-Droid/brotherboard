chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "rsvp4dingus-paste") return;

  const input = document.getElementById("textInput");
  if (!input) return;

  const { mode, text } = message;
  const isAppend = mode === "append" && input.value.trim().length > 0;
  input.value = isAppend ? input.value + "\n\n" + text : text;

  // Reuses the app's own paste-detection: an "insertFromPaste" input event
  // makes it reset to word 1 like a normal paste (what Replace wants); a
  // plain input event does not, which is what Append wants -- it shouldn't
  // disturb wherever the reader currently is.
  const evt = isAppend
    ? new Event("input", { bubbles: true })
    : new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" });
  input.dispatchEvent(evt);
});
