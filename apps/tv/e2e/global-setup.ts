import { createServer, type ViteDevServer } from "vite";

export const E2E_PORT = 5190;

let server: ViteDevServer | undefined;

export async function setup() {
  server = await createServer({
    root: new URL("..", import.meta.url).pathname,
    configFile: new URL("../vite.config.ts", import.meta.url).pathname,
    server: { port: E2E_PORT, strictPort: true },
    logLevel: "warn",
  });
  await server.listen();
}

export async function teardown() {
  await server?.close();
}
