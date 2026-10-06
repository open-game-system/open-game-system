// The post-deploy stream readiness check, without starting a render (scripts/stream-ready.mjs runs
// it). Reports results and reasons only: never a URL, id or credential from a response.
import { z } from "zod";

export type FetchJson = (url: string) => Promise<{ status: number; json: unknown }>;

/** The renderer service as Cloud Run's control plane describes it (no instance starts), or null. */
export type RendererService = { ready: boolean; url: string | null; minInstances: number } | null;

export interface ReadyDeps {
  fetchJson: FetchJson;
  describeRenderer: () => Promise<RendererService>;
}

export interface Check {
  name: string;
  result: "ok" | "fail" | "skip";
  detail: string;
}

const IceServers = z.object({
  iceServers: z.array(z.object({ urls: z.union([z.string(), z.array(z.string())]) })),
});
const ReadyBody = z.object({
  ready: z.boolean(),
  renderer: z.object({ url: z.boolean() }),
  realtime: z.boolean(),
  turn: z.boolean(),
});

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function streamRoute(api: string, fetchJson: FetchJson): Promise<Check> {
  const name = "stream route";
  const res = await fetchJson(`${api}/api/v1/stream/ice-servers`);
  const body = IceServers.safeParse(res.json);
  if (res.status !== 200 || !body.success)
    return { name, result: "fail", detail: `GET /stream/ice-servers answered ${res.status}` };
  const urls = body.data.iceServers.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
  const turn = urls.filter((u) => u.startsWith("turn:") || u.startsWith("turns:")).length;
  if (turn === 0)
    return { name, result: "fail", detail: "answers, but with no TURN server (STUN fallback)" };
  return { name, result: "ok", detail: `answers with ${turn} TURN url(s)` };
}

async function apiConfig(api: string, fetchJson: FetchJson): Promise<Check> {
  const name = "api config";
  const res = await fetchJson(`${api}/api/v1/stream/ready`);
  if (res.status === 404)
    return {
      name,
      result: "fail",
      detail: "GET /stream/ready not deployed (deploy the API to check its config)",
    };
  const body = ReadyBody.safeParse(res.json);
  if (!body.success)
    return { name, result: "fail", detail: `GET /stream/ready answered ${res.status}` };
  const { renderer, realtime, turn } = body.data;
  const parts: [string, boolean][] = [
    ["renderer (STREAM_SERVER_URL)", renderer.url],
    ["Realtime", realtime],
    ["TURN", turn],
  ];
  const missing = parts.filter(([, set]) => !set).map(([part]) => part);
  if (missing.length > 0) return { name, result: "fail", detail: `missing: ${missing.join(", ")}` };
  return { name, result: "ok", detail: parts.map(([part]) => part).join(", ") };
}

function rendererService(service: RendererService): Check {
  const name = "renderer service";
  if (service === null)
    return { name, result: "skip", detail: "Cloud Run not reachable from here (gcloud)" };
  if (!service.ready)
    return { name, result: "fail", detail: "Cloud Run says the service is not Ready" };
  return { name, result: "ok", detail: `Cloud Run Ready (min instances ${service.minInstances})` };
}

async function rendererHealth(
  service: RendererService,
  fetchJson: FetchJson,
  probe: boolean,
): Promise<Check> {
  const name = "renderer health";
  if (!probe)
    return {
      name,
      result: "skip",
      detail:
        "not probed: /health on a scaled-to-zero GPU service would cold-start (and bill) an instance; --probe-renderer to run it",
    };
  if (!service?.url) return { name, result: "skip", detail: "no renderer URL from Cloud Run" };
  const res = await fetchJson(`${service.url}/health`);
  return res.status === 200
    ? { name, result: "ok", detail: "/health answers 200 (no browser launched)" }
    : { name, result: "fail", detail: `/health answered ${res.status}` };
}

/** Each check in order; a check that throws (timeout, DNS) is a failure, not a crash. */
export async function checkStreamReady(
  apiBase: string,
  deps: ReadyDeps,
  { probeRenderer = false }: { probeRenderer?: boolean } = {},
): Promise<{ ok: boolean; checks: Check[] }> {
  const api = apiBase.replace(/\/+$/, "");
  const guard = async (name: string, run: () => Promise<Check>): Promise<Check> => {
    try {
      return await run();
    } catch (error) {
      return { name, result: "fail", detail: reason(error) };
    }
  };
  let service: RendererService = null;
  const checks = [
    await guard("stream route", () => streamRoute(api, deps.fetchJson)),
    await guard("api config", () => apiConfig(api, deps.fetchJson)),
    await guard("renderer service", async () => {
      service = await deps.describeRenderer();
      return rendererService(service);
    }),
    await guard("renderer health", () => rendererHealth(service, deps.fetchJson, probeRenderer)),
  ];
  return { ok: checks.every((c) => c.result !== "fail"), checks };
}
