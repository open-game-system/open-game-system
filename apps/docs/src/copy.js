// The Copy markdown button: copies this page's Markdown twin (/<slug>.md) whole. Served as /copy.js.
// The button is `hidden` in the HTML and shown here, so without JavaScript the Markdown link stays.

export const LABEL = "Copy markdown";

/**
 * Wires one button. The Markdown is fetched up front, so a click can write it while the browser
 * still counts the click as a user gesture (iOS Safari drops the gesture across an await). A click
 * before it arrives hands the clipboard a ClipboardItem whose blob is a promise, which Safari and
 * Chrome both accept within the gesture.
 */
export function wireCopy(button, status, deps) {
  const { fetchText, clipboard, ClipboardItem, setTimer } = deps;
  let text = null;
  const ready = fetchText(button.dataset.copyMd).then(
    (t) => {
      text = t;
      return t;
    },
    () => null,
  );
  const show = (label, message) => {
    button.textContent = label;
    status.textContent = message;
    setTimer(() => {
      button.textContent = LABEL;
    }, 2000);
  };
  const markdown = () =>
    ready.then((t) => {
      if (t === null) throw new Error("no markdown");
      return t;
    });
  const write = () => {
    if (text !== null) return clipboard.writeText(text);
    if (ClipboardItem && clipboard.write) {
      const blob = markdown().then((t) => new Blob([t], { type: "text/plain" }));
      return clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    }
    return markdown().then((t) => clipboard.writeText(t));
  };
  button.addEventListener("click", () =>
    write().then(
      () => show("Copied", "Copied"),
      () => show("Not copied", "Couldn't copy. Use the Markdown link."),
    ),
  );
  button.hidden = false;
  return ready;
}

if (typeof document !== "undefined") {
  const button = document.querySelector("button[data-copy-md]");
  const status = document.getElementById("copy-status");
  if (button && status && navigator.clipboard) {
    wireCopy(button, status, {
      fetchText: (url) => fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status))))),
      clipboard: navigator.clipboard,
      ClipboardItem: window.ClipboardItem,
      setTimer: (fn, ms) => setTimeout(fn, ms),
    });
  }
}
