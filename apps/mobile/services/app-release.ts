import { z } from "zod";

/**
 * The forced update (docs/adrs/2026-10-07-beta-distribution.md): CI records each platform's
 * latest build with the API; a build older than that shows "Update OGS" and opens the release's
 * update URL (TestFlight, Firebase App Tester). The check never blocks on its own failure, and
 * builds without a native build number (development, simulators) are never blocked.
 */

export type UpdateGate = { kind: "ok" } | { kind: "update"; url: string };

const ReleaseSchema = z.object({
  build: z.number().int().positive(),
  updateUrl: z.url({ protocol: /^https$/ }),
});
export type Release = z.infer<typeof ReleaseSchema>;

const OK: UpdateGate = { kind: "ok" };

const wholeNumber = (value: string | null): number | null =>
  value !== null && /^\d+$/.test(value) ? Number(value) : null;

export function gateFor(installedBuild: string | null, release: Release | null): UpdateGate {
  const installed = wholeNumber(installedBuild);
  if (installed === null || !release) return OK;
  return installed < release.build ? { kind: "update", url: release.updateUrl } : OK;
}

export async function checkRelease(opts: {
  apiBase: string;
  /** Platform.OS: only ios and android have releases. */
  platform: string;
  /** expo-application's nativeBuildVersion (null in development). */
  installedBuild: string | null;
  fetch: (url: string) => Promise<Response>;
}): Promise<UpdateGate> {
  if (opts.platform !== "ios" && opts.platform !== "android") return OK;
  if (wholeNumber(opts.installedBuild) === null) return OK;
  try {
    const res = await opts.fetch(`${opts.apiBase}/api/v1/app-release/${opts.platform}`);
    if (!res.ok) return OK;
    const release = ReleaseSchema.safeParse(await res.json());
    return release.success ? gateFor(opts.installedBuild, release.data) : OK;
  } catch {
    return OK;
  }
}
