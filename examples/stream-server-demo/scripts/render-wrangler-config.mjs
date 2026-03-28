import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

const workerName = process.env.STREAM_KIT_WORKER_NAME || "bun-stream-server";
const containerName = process.env.STREAM_KIT_CONTAINER_NAME || "codeflare-containers";
const containerScriptName = process.env.STREAM_KIT_CONTAINER_SCRIPT_NAME || "";
const outputPath =
  process.env.STREAM_KIT_CONFIG_PATH ||
  path.resolve(projectRoot, ".wrangler/preview-wrangler.json");
const configDir = path.dirname(outputPath);
const mainPath = path.relative(configDir, path.join(projectRoot, "src/index.ts"));
const dockerfilePath = path.relative(configDir, path.join(projectRoot, "container/Dockerfile"));
const imagePath = process.env.STREAM_KIT_CONTAINER_IMAGE || dockerfilePath;

const durableObjectBinding = {
  name: "STREAM_CONTAINER",
  class_name: "StreamContainer",
  ...(containerScriptName ? { script_name: containerScriptName } : {}),
};

const config = {
  name: workerName,
  main: mainPath,
  compatibility_date: "2025-04-10",
  compatibility_flags: ["nodejs_compat", "nodejs_compat_populate_process_env"],
  durable_objects: {
    bindings: [durableObjectBinding],
  },
  observability: {
    enabled: true,
    head_sampling_rate: 1,
  },
};

if (!containerScriptName) {
  config.containers = [
    {
      name: containerName,
      image: imagePath,
      class_name: "StreamContainer",
      max_instances: 2,
      instance_type: "standard",
    },
  ];
  config.migrations = [
    {
      tag: "v1",
      new_sqlite_classes: ["MyContainer"],
    },
    {
      tag: "v2",
      new_sqlite_classes: ["StreamContainer"],
      deleted_classes: ["MyContainer"],
    },
  ];
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(outputPath);
