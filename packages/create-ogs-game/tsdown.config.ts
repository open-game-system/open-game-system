import { defineConfig } from "tsdown";

// One ESM bin; templates/ and vendor/ ship next to dist/ as plain files. create-ogs-app stays a
// runtime dependency (its template folder is read from its own package).
export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  platform: "node",
  dts: false,
  clean: true,
  deps: { neverBundle: ["zod", "create-ogs-app", "create-ogs-app/lib"] },
});
