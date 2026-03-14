import { expect, test } from "@playwright/test";

const previewUrl = process.env.E2E_API_PREVIEW_URL;
const apiKey = process.env.E2E_API_KEY || "test-api-key";

test.describe("Cast API E2E", () => {
  test.skip(
    !previewUrl,
    "E2E_API_PREVIEW_URL is required for preview API tests"
  );

  test("health check returns ok", async ({ request }) => {
    const res = await request.get(`${previewUrl}/api/v1/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("rejects cast session creation without auth", async ({ request }) => {
    const res = await request.post(`${previewUrl}/api/v1/cast/sessions`, {
      data: { deviceId: "tv-1", viewUrl: "https://example.com/tv" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("missing_auth");
  });

  test("rejects cast session creation with invalid API key", async ({ request }) => {
    const res = await request.post(`${previewUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: "Bearer invalid-key-that-does-not-exist" },
      data: { deviceId: "tv-1", viewUrl: "https://example.com/tv" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_api_key");
  });

  test("rejects cast session with missing fields", async ({ request }) => {
    const res = await request.post(`${previewUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { deviceId: "tv-1" }, // missing viewUrl
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("missing_fields");
  });

  test("rejects cast session with non-HTTPS viewUrl", async ({ request }) => {
    const res = await request.post(`${previewUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { deviceId: "tv-1", viewUrl: "http://example.com/tv" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_view_url");
  });

  test("returns 404 for nonexistent session", async ({ request }) => {
    const res = await request.get(
      `${previewUrl}/api/v1/cast/sessions/does-not-exist`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("session_not_found");
  });

  test("returns 404 for state update on nonexistent session", async ({ request }) => {
    const res = await request.post(
      `${previewUrl}/api/v1/cast/sessions/does-not-exist/state`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        data: { state: { round: 1 } },
      }
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("session_not_found");
  });

  test("returns 404 for deleting nonexistent session", async ({ request }) => {
    const res = await request.delete(
      `${previewUrl}/api/v1/cast/sessions/does-not-exist`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("session_not_found");
  });
});
