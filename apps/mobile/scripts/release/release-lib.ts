import { z } from "zod";

/**
 * CI's beta release decisions (docs/adrs/2026-10-07-beta-distribution.md), used by release.mjs in
 * .github/workflows/mobile-release.yml: build when the native fingerprint differs from the
 * recorded release, otherwise ship over the air; record a TestFlight build only once it is VALID.
 */

export type Recorded = { build: number; fingerprint: string } | null;

export function needsBuild(fingerprint: string, recorded: Recorded): boolean {
  return recorded === null || recorded.fingerprint !== fingerprint;
}

const RecordedSchema = z.object({ build: z.number().int().positive(), fingerprint: z.string() });

/** GET /api/v1/app-release/:platform → the recorded release (404: none). Throws on anything else. */
export function parseRecorded(status: number, body: unknown): Recorded {
  if (status === 404) return null;
  if (status !== 200) throw new Error(`app-release answered ${status}`);
  const { build, fingerprint } = RecordedSchema.parse(body);
  return { build, fingerprint };
}

const BuildsSchema = z.object({
  data: z.array(
    z.object({
      attributes: z.object({
        processingState: z.enum(["PROCESSING", "FAILED", "INVALID", "VALID"]),
      }),
    }),
  ),
});

export type TestflightState = "missing" | "processing" | "ready" | "failed";

/** App Store Connect GET /v1/builds?filter[version]=<build> → where that build is. */
export function testflightState(body: unknown): TestflightState {
  const [build] = BuildsSchema.parse(body).data;
  if (!build) return "missing";
  switch (build.attributes.processingState) {
    case "PROCESSING":
      return "processing";
    case "VALID":
      return "ready";
    default:
      return "failed";
  }
}
