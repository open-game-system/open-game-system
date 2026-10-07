import { relative } from "node:path";
import { buildSite } from "./build";
import { DIST_DIR } from "./paths";

const built = buildSite();
console.log(
  `docs: ${built.length} pages → ${relative(process.cwd(), DIST_DIR) || "."} (${built.map((b) => b.page.slug).join(", ")})`,
);
