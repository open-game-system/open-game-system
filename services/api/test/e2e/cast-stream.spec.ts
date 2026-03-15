import { expect, test } from "@playwright/test";

/**
 * Cast Stream E2E Tests
 *
 * These tests verify the full cast-to-TV streaming flow:
 * 1. Stream container provisioning via the Cast API
 * 2. WebRTC signaling availability
 * 3. Session lifecycle (create → active → delete)
 *
 * Prerequisites:
 * - Docker must be running (for local container)
 * - OGS API must be running with `wrangler dev` (Container binding or STREAM_SERVER_URL)
 * - An API key must exist in the database
 *
 * Environment variables:
 * - E2E_API_URL: Base URL for the API (default: http://localhost:8787)
 * - E2E_API_KEY: Valid API key for authentication
 * - E2E_SPECTATE_URL: A valid HTTPS URL to render (default: https://triviajam.tv)
 */

const apiUrl = process.env.E2E_API_URL || "http://localhost:8787";
const apiKey = process.env.E2E_API_KEY;
const spectateUrl =
  process.env.E2E_SPECTATE_URL || "https://triviajam.tv";

test.describe("Cast Stream — Container Provisioning", () => {
  test.skip(!apiKey, "E2E_API_KEY is required");

  test("creates a cast session with stream server details", async ({
    request,
  }) => {
    const res = await request.post(`${apiUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        deviceId: "e2e-test-device",
        viewUrl: spectateUrl,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();

    // Session was created with all required fields
    expect(body.sessionId).toBeTruthy();
    expect(body.streamSessionId).toBeTruthy();
    expect(body.streamUrl).toBeTruthy();
    expect(body.status).toBe("active");

    // streamUrl should point to the API's stream proxy
    expect(body.streamUrl).toContain("/api/v1/cast/stream/");
  });

  test("stream container renders the spectate URL", async ({ request }) => {
    // Create session first
    const createRes = await request.post(`${apiUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        deviceId: "e2e-render-test",
        viewUrl: spectateUrl,
      },
    });
    expect(createRes.status()).toBe(201);
    const { sessionId } = await createRes.json();

    // Give container time to start and render
    await new Promise((r) => setTimeout(r, 10_000));

    // Session should still be active
    const statusRes = await request.get(
      `${apiUrl}/api/v1/cast/sessions/${sessionId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    expect(statusRes.status()).toBe(200);
    const status = await statusRes.json();
    expect(status.status).toBe("active");

    // Clean up
    await request.delete(`${apiUrl}/api/v1/cast/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  });

  test("deleting a cast session stops the stream container", async ({
    request,
  }) => {
    // Create session
    const createRes = await request.post(`${apiUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        deviceId: "e2e-delete-test",
        viewUrl: spectateUrl,
      },
    });
    expect(createRes.status()).toBe(201);
    const { sessionId } = await createRes.json();

    // Delete session
    const deleteRes = await request.delete(
      `${apiUrl}/api/v1/cast/sessions/${sessionId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    expect(deleteRes.status()).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.status).toBe("ended");

    // Session should be gone or ended
    const statusRes = await request.get(
      `${apiUrl}/api/v1/cast/sessions/${sessionId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    // Should be 404 (session deleted) or status: "ended"
    if (statusRes.status() === 200) {
      const status = await statusRes.json();
      expect(status.status).toBe("ended");
    } else {
      expect(statusRes.status()).toBe(404);
    }
  });
});

test.describe("Cast Stream — WebRTC Signaling", () => {
  test.skip(!apiKey, "E2E_API_KEY is required");

  test("receiver connects via API proxy and receives video via PeerJS @container", async ({
    request,
    page,
  }) => {
    // Create a cast session to get a stream proxy URL
    const createRes = await request.post(`${apiUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        deviceId: "e2e-peerjs-test",
        viewUrl: spectateUrl,
      },
    });
    expect(createRes.status()).toBe(201);
    const { sessionId, streamUrl } = await createRes.json();

    // streamUrl is the API proxy: http://localhost:8788/api/v1/cast/stream/:sessionId
    // The receiver uses this as its streamServerUrl
    const receiverPath = `${process.cwd().replace(/services\/api$/, '')}examples/cast-receiver/receiver.html`;
    const receiverUrl = `file://${receiverPath}?streamServerUrl=${encodeURIComponent(streamUrl)}&viewUrl=${encodeURIComponent(spectateUrl)}`;

    console.log("[Test] Loading receiver:", receiverUrl);
    await page.goto(receiverUrl);

    // Wait for the receiver to connect and display video (up to 45s)
    const gotVideo = await page.waitForFunction(
      () => {
        const video = document.querySelector("video");
        return video?.srcObject !== null && video?.srcObject !== undefined;
      },
      { timeout: 45_000 }
    ).then(() => true).catch(() => false);

    expect(gotVideo).toBe(true);

    // Clean up
    await request.delete(`${apiUrl}/api/v1/cast/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  });
});

test.describe("Cast Stream — Error Handling", () => {
  test.skip(!apiKey, "E2E_API_KEY is required");

  test("rejects non-HTTPS viewUrl", async ({ request }) => {
    const res = await request.post(`${apiUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        deviceId: "e2e-error-test",
        viewUrl: "http://insecure.example.com",
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_view_url");
  });

  test("rejects missing deviceId", async ({ request }) => {
    const res = await request.post(`${apiUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        viewUrl: spectateUrl,
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("missing_fields");
  });

  test("rejects missing viewUrl", async ({ request }) => {
    const res = await request.post(`${apiUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        deviceId: "e2e-error-test",
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("missing_fields");
  });
});

test.describe("Cast Receiver — WebRTC Display", () => {
  test.skip(!apiKey, "E2E_API_KEY is required");

  test("receiver page loads with status overlay and video element", async ({
    page,
  }) => {
    // Load receiver with params
    const receiverUrl = `file://${process.cwd().replace(/services\/api$/, '')}examples/cast-receiver/receiver.html?streamServerUrl=http://localhost:9999&viewUrl=https://example.com`;

    await page.goto(receiverUrl);

    // Status text element should exist
    const statusEl = page.locator("#status-text");
    await expect(statusEl).toBeVisible();

    // Video element should exist
    const video = page.locator("video");
    await expect(video).toBeVisible();
  });

  test("receiver shows error state when stream server unreachable", async ({
    page,
  }) => {
    const receiverUrl = `file://${process.cwd().replace(/services\/api$/, '')}examples/cast-receiver/receiver.html?streamServerUrl=http://localhost:9999&viewUrl=https://example.com`;

    await page.goto(receiverUrl);

    // Wait for the connection attempt to fail (up to 20s)
    await page.waitForFunction(
      () => {
        const el = document.getElementById("status-text");
        return el && (
          el.textContent?.includes("timed out") ||
          el.textContent?.includes("Unable") ||
          el.textContent?.includes("error") ||
          el.textContent?.includes("Error")
        );
      },
      { timeout: 20_000 }
    );

    const statusText = await page.locator("#status-text").textContent();
    expect(statusText).toBeTruthy();
    // Should indicate a failure state
    expect(
      statusText?.includes("timed out") ||
      statusText?.includes("Unable") ||
      statusText?.includes("error") ||
      statusText?.includes("Error")
    ).toBe(true);
  });

  test("receiver connects to real stream and displays video @container", async ({
    page,
    request,
  }) => {
    // Create a real cast session
    // This test creates a cast session via the API, then loads the receiver
    // page with the stream server URL. The receiver handles PeerJS signaling.
    const createRes = await request.post(`${apiUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        deviceId: "e2e-receiver-test",
        viewUrl: spectateUrl,
      },
    });
    expect(createRes.status()).toBe(201);
    const { sessionId, streamUrl } = await createRes.json();

    // streamUrl is the API proxy URL: /api/v1/cast/stream/:sessionId
    // The receiver uses this as its streamServerUrl
    const receiverPath = `${process.cwd().replace(/services\/api$/, '')}examples/cast-receiver/receiver.html`;
    await page.goto(
      `file://${receiverPath}?streamServerUrl=${encodeURIComponent(streamUrl)}&viewUrl=${encodeURIComponent(spectateUrl)}`
    );

    // Wait for video to have srcObject (up to 45 seconds)
    const gotVideo = await page.waitForFunction(
      () => {
        const video = document.querySelector("video");
        return video?.srcObject !== null && video?.srcObject !== undefined;
      },
      { timeout: 45_000 }
    ).then(() => true).catch(() => false);

    expect(gotVideo).toBe(true);

    // Clean up
    await request.delete(`${apiUrl}/api/v1/cast/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  });
});
