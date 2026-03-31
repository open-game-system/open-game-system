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

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "ccf4d9a0a3b76ffae0b6ee048de66f07";

// main path must be relative to the config file location (.wrangler/)
const main = "../src/index.ts";
const compatDate = "2024-12-01";

// Write preview JSONC
const outputPath = path.join(projectRoot, ".wrangler", "preview-wrangler.jsonc");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const config = {
  name: `opengame-api-pr-${prNumber}`,
  main,
  compatibility_date: compatDate,
  compatibility_flags: [
    "nodejs_compat",
    "nodejs_compat_populate_process_env",
  ],
  account_id: accountId,
  d1_databases: [
    {
      binding: "DB",
      database_name: `opengame-api-pr-${prNumber}-db`,
      database_id: dbId,
    },
  ],
  containers: [
    {
      name: `codeflare-containers-pr-${prNumber}`,
      image: "../container/Dockerfile",
      class_name: "StreamContainer",
      max_instances: 2,
      instance_type: "standard",
    },
  ],
  durable_objects: {
    bindings: [
      {
        name: "STREAM_CONTAINER",
        class_name: "StreamContainer",
      },
    ],
  },
  migrations: [
    {
      tag: "v1",
      new_sqlite_classes: ["StreamContainer"],
    },
  ],
  observability: {
    enabled: true,
    head_sampling_rate: 1,
  },
};

fs.writeFileSync(outputPath, JSON.stringify(config, null, "\t"), "utf8");
console.log(`Preview wrangler config written to ${outputPath}`);
