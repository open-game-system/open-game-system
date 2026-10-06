import { expect, test } from "@playwright/test";

/** Smoke test against a deployed PR preview (CI: ci-api-preview.yml, E2E_API_PREVIEW_URL). */
const previewUrl = process.env.E2E_API_PREVIEW_URL;

test.describe("API preview", () => {
  test.skip(!previewUrl, "E2E_API_PREVIEW_URL is required for preview API tests");

  test("health check returns ok", async ({ request }) => {
    const res = await request.get(`${previewUrl}/api/v1/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
