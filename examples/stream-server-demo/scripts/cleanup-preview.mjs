import { execFileSync } from "node:child_process";
import path from "node:path";

const workerName = process.env.STREAM_KIT_WORKER_NAME;
const containerName = process.env.STREAM_KIT_CONTAINER_NAME;
const configPath = process.env.STREAM_KIT_CONFIG_PATH;

if (!workerName || !containerName || !configPath) {
  throw new Error(
    "STREAM_KIT_WORKER_NAME, STREAM_KIT_CONTAINER_NAME, and STREAM_KIT_CONFIG_PATH are required"
  );
}

function runWrangler(args, options = {}) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: path.dirname(configPath),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function parseJsonFromOutput(output) {
  const match = output.match(/(\[\s*\{[\s\S]*\])\s*$/);
  if (!match) {
    throw new Error(`Could not find JSON payload in Wrangler output:\n${output}`);
  }

  return JSON.parse(match[1]);
}

try {
  runWrangler(["delete", workerName, "--config", configPath, "--force"]);
  console.log(`Deleted worker ${workerName}`);
} catch (error) {
  const output = `${error.stdout || ""}${error.stderr || ""}`;
  if (
    output.includes("There is currently no Worker published") ||
    output.includes("was not found") ||
    output.includes("No worker named") ||
    output.includes("This Worker does not exist on this account")
  ) {
    console.log(`Worker ${workerName} did not exist; skipping delete`);
  } else {
    throw error;
  }
}

const containers = parseJsonFromOutput(
  runWrangler(["containers", "list", "--config", configPath])
);
const matchingContainer = containers.find((container) => container.name === containerName);

if (!matchingContainer) {
  console.log(`Container ${containerName} did not exist; skipping delete`);
  process.exit(0);
}

runWrangler(["containers", "delete", matchingContainer.id, "--config", configPath], {
  input: "y\n",
});
console.log(`Deleted container ${containerName} (${matchingContainer.id})`);
