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

  test("creates a cast session that provisions a stream container", async ({
    request,
  }) => {
    // RED: This test should fail until the Container binding is wired up
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

    // streamUrl should be a WebSocket URL for WebRTC signaling
    expect(body.streamUrl).toMatch(/^wss?:\/\//);
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

  test.fixme("stream URL provides WebRTC signaling via WebSocket", async ({
    request,
    page,
  }) => {
    // FIXME: The stream-kit server uses PeerJS for signaling, not a custom WS endpoint.
    // Need to align the streamUrl format with the actual signaling protocol.
    // Create session
    const createRes = await request.post(`${apiUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        deviceId: "e2e-webrtc-test",
        viewUrl: spectateUrl,
      },
    });
    expect(createRes.status()).toBe(201);
    const { sessionId, streamUrl } = await createRes.json();

    // Give container time to start
    await new Promise((r) => setTimeout(r, 10_000));

    // Verify the WebSocket signaling endpoint is reachable
    // Navigate to a blank page first so we have a browser context for WebSocket
    await page.goto("about:blank");
    const wsConnected = await page.evaluate(async (url) => {
      return new Promise<boolean>((resolve) => {
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => { ws.close(); resolve(false); }, 10_000);
        ws.onopen = () => { clearTimeout(timeout); ws.close(); resolve(true); };
        ws.onerror = () => { clearTimeout(timeout); resolve(false); };
      });
    }, streamUrl);

    expect(wsConnected).toBe(true);

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
    // Load receiver with a dummy streamUrl
    const receiverUrl = `file://${process.cwd().replace(/services\/api$/, '')}examples/cast-receiver/receiver.html?streamUrl=ws://localhost:9999/fake`;

    await page.goto(receiverUrl);

    // Status text element should exist (may show "Connecting" or "Unable to connect")
    const statusEl = page.locator("#status-text");
    await expect(statusEl).toBeVisible();

    // Video element should exist
    const video = page.locator("video");
    await expect(video).toBeVisible();
  });

  test("receiver shows error state when connection fails", async ({
    page,
  }) => {
    const receiverUrl = `file://${process.cwd().replace(/services\/api$/, '')}examples/cast-receiver/receiver.html?streamUrl=ws://localhost:9999/fake`;

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

  test.fixme("receiver connects to real stream and displays video", async ({
    page,
    request,
  }) => {
    // FIXME: Depends on WebRTC signaling URL being correct (see WebRTC Signaling test above)
    // Create a real cast session
    const createRes = await request.post(`${apiUrl}/api/v1/cast/sessions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: {
        deviceId: "e2e-receiver-test",
        viewUrl: spectateUrl,
      },
    });
    expect(createRes.status()).toBe(201);
    const { sessionId, streamUrl } = await createRes.json();

    // Give container time to start rendering
    await new Promise((r) => setTimeout(r, 10_000));

    // Load receiver with the real streamUrl
    const receiverPath = `${process.cwd()}/../../examples/cast-receiver/receiver.html`;
    await page.goto(
      `file://${receiverPath}?streamUrl=${encodeURIComponent(streamUrl)}`
    );

    // Wait for video to appear (up to 30 seconds)
    const video = page.locator("video");
    await expect(video).toBeVisible({ timeout: 30_000 });

    // Check that video has a srcObject (stream attached)
    const hasStream = await page.evaluate(() => {
      const video = document.querySelector("video");
      return video?.srcObject !== null;
    });
    expect(hasStream).toBe(true);

    // Clean up
    await request.delete(`${apiUrl}/api/v1/cast/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  });
});
