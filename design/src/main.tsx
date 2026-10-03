import { createRoot } from "react-dom/client";
import { App } from "./harness/App";

// Shot mode: no motion, so a shot is never caught mid-transition.
const freeze = document.createElement("style");
freeze.textContent = `html.shot *, html.shot *::before, html.shot *::after {
  animation-duration: 0s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important;
  transition-duration: 0s !important; transition-delay: 0s !important; caret-color: transparent !important; }
html, body { margin: 0; }`;
document.head.appendChild(freeze);

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);

// The shooter and flow bot read the registry from here (scenario ids, devices, flows).
import { CONCEPTS } from "./harness/registry";
declare global {
  interface Window {
    __ogsRegistry?: unknown;
  }
}
window.__ogsRegistry = CONCEPTS.map(({ session: _session, css: _css, ...meta }) => meta);
