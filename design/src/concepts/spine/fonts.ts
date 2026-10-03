// Fonts start loading the moment the concept module is imported (before the first render), not
// when the harness injects concept.css after the scenario has already acknowledged; otherwise a
// shot can be taken before the per-game type voices arrive.
const HREF = "https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&family=Lilita+One&family=Baloo+2:wght@500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Libre+Franklin:wght@400;500;600;700;800;900&display=swap";
const FAMILIES = ["Familjen Grotesk", "Lilita One", "Baloo 2", "Fraunces", "Libre Franklin"];
const WEIGHTS = ["400", "600", "700", "800"];

export function warmFonts() {
  if (typeof document === "undefined" || document.querySelector("link[data-spine-fonts]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = HREF;
  link.dataset.spineFonts = "1";
  link.onload = () => {
    for (const f of FAMILIES) for (const w of WEIGHTS) void document.fonts.load(`${w} 16px '${f}'`);
  };
  document.head.appendChild(link);
}
