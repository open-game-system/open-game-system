/** The warm dusk palette and Fraunces display from the design prototype (console concept). */
export const colors = {
  dusk0: "#120f22",
  dusk1: "#1b1733",
  dusk2: "#272148",
  dusk3: "#352c5e",
  cream: "#fbf2e4",
  cream2: "#e6dacb",
  cream3: "#bdb2c9",
  hair: "rgba(251, 242, 228, 0.14)",
  lamp: "#ffc861",
  ember: "#ff7a52",
  lilac: "#c9b8ff",
  peach: "#f7c6a3",
  mint: "#9fe3bf",
  ink: "#1b1733",
  // The remote (TV tab): a lit dome, a dark groove around OK, soft glows for pressed and live.
  padTop: "#2e2756",
  padBottom: "#1c1836",
  padEdge: "rgba(251, 242, 228, 0.12)",
  groove: "#0d0b1a",
  peachLit: "#ffe0c8",
  peachPressed: "#e8ad86",
  lampGlow: "rgba(255, 200, 97, 0.16)",
  emberGlow: "rgba(255, 122, 82, 0.28)",
  // The remote, round 2: a flat clickpad face with seams; one lit style for every pressed key.
  padFace: "#221c41",
  padSeam: "rgba(251, 242, 228, 0.07)",
  keyLit: "rgba(255, 200, 97, 0.2)",
  keyLitSolid: "#4e3e47",
  keyLitEdge: "rgba(255, 200, 97, 0.45)",
  keyGlow: "rgba(255, 200, 97, 0.22)",
  peachDeep: "#d9946c",
} as const;

export const fonts = {
  display: "Fraunces-Display",
} as const;

/** Minimum touch target (pt). */
export const TARGET = 44;
