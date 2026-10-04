// Fonts are vendored (OFL) and declared inline, so a shot never races a remote @import.
import schibsted from "./fonts/schibsted.woff2?url";
import lilita from "./fonts/lilita.woff2?url";
import fredoka from "./fonts/fredoka.woff2?url";
import fraunces from "./fonts/fraunces.woff2?url";

export const fontFaces = `
@font-face { font-family: "Schibsted Grotesk"; src: url(${schibsted}) format("woff2"); font-weight: 400 900; font-display: block; }
@font-face { font-family: "Lilita One"; src: url(${lilita}) format("woff2"); font-weight: 400; font-display: block; }
@font-face { font-family: "OGS Fraunces"; src: url(${fraunces}) format("woff2"); font-weight: 100 900; font-display: block; }
@font-face { font-family: "Fredoka"; src: url(${fredoka}) format("woff2"); font-weight: 300 700; font-display: block; }
`;
