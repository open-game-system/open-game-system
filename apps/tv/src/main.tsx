import { createRoot } from "react-dom/client";
import { boot } from "./boot";
import { parseParams } from "./params";
import { App } from "./ui/App";
import { BadUrl } from "./ui/BadUrl";
import "./ui/styles.css";

const root = document.getElementById("root");
const parsed = parseParams(window.location.search);
if (root) {
  createRoot(root).render(
    parsed.ok ? <App boot={boot(parsed.params, window.location.search)} /> : <BadUrl />,
  );
}
