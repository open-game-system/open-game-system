import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

const prNumber = process.env.PR_NUMBER;
if (!prNumber) {
  console.error("PR_NUMBER environment variable is required");
  process.exit(1);
}

const dbId = process.env.PREVIEW_D1_DATABASE_ID;
if (!dbId) {
  console.error("PREVIEW_D1_DATABASE_ID environment variable is required");
  process.exit(1);
}

const streamServerUrl = process.env.STREAM_SERVER_URL || "";

// Read the existing wrangler.toml to extract fields
const wranglerPath = path.join(projectRoot, "wrangler.toml");
const wranglerContent = fs.readFileSync(wranglerPath, "utf8");

function extractTomlValue(content, key) {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"));
  return match ? match[1] : null;
}

// main path must be relative to the config file location (.wrangler/)
const mainFromToml = extractTomlValue(wranglerContent, "main") || "src/index.ts";
const main = `../${mainFromToml}`;
const compatDate = extractTomlValue(wranglerContent, "compatibility_date") || "2024-12-01";
const accountId = extractTomlValue(wranglerContent, "account_id") || "";

// Write preview TOML
const outputPath = path.join(projectRoot, ".wrangler", "preview-wrangler.toml");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const lines = [
  `name = "opengame-api-pr-${prNumber}"`,
  `main = "${main}"`,
  `compatibility_date = "${compatDate}"`,
  `account_id = "${accountId}"`,
  "",
  "[vars]",
  `STREAM_SERVER_URL = "${streamServerUrl}"`,
  "",
  "[[d1_databases]]",
  `binding = "DB"`,
  `database_name = "opengame-api-pr-${prNumber}-db"`,
  `database_id = "${dbId}"`,
  "",
];

fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
console.log(`Preview wrangler config written to ${outputPath}`);
