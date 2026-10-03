import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// virtual:ogs-concepts imports every concept, or only those in OGS_CONCEPTS (comma list), so a
// shoot of one concept can't be broken by another agent's half-finished folder.
function concepts(): Plugin {
  const id = "virtual:ogs-concepts";
  return {
    name: "ogs-concepts",
    resolveId: (s) => (s === id ? "\0" + id : undefined),
    load(s) {
      if (s !== "\0" + id) return;
      const dir = join(import.meta.dirname, "src", "concepts");
      const only = process.env.OGS_CONCEPTS?.split(",").filter(Boolean);
      const names = readdirSync(dir).filter((n) => existsSync(join(dir, n, "index.tsx")) && (!only || only.includes(n)));
      return names.map((n, i) => `import { concept as c${i} } from ${JSON.stringify(join(dir, n, "index.tsx"))};`).join("\n") + `\nexport default [${names.map((_, i) => `c${i}`).join(", ")}];`;
    },
  };
}

export default defineConfig({ plugins: [react(), concepts()], server: { port: 4316 } });
