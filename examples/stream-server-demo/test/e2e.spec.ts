import { expect, test } from "@playwright/test";

const previewUrl = process.env.E2E_STREAM_SERVER_URL;

function buildTraceId() {
  return `ci-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

test.describe("Cloudflare preview stream", () => {
  test.skip(
    !previewUrl,
    "E2E_STREAM_SERVER_URL is required for real-infra streaming tests"
  );

  test("boots the deployed Worker stack and starts a real stream session", async ({
    request,
  }, testInfo) => {
    const traceId = buildTraceId();
    const sessionId = `ci-session-${Math.random().toString(36).slice(2, 10)}`;
    const targetUrl = process.env.E2E_TARGET_URL || "https://example.com";

    const healthResponse = await request.get(`${previewUrl}/health`);
    expect(healthResponse.ok()).toBeTruthy();

    const healthPayload = await healthResponse.json();
    expect(healthPayload.status).toBe("healthy");

    const iceResponse = await request.get(`${previewUrl}/ice-servers`, {
      headers: {
        "x-stream-trace-id": traceId,
        "x-stream-session-id": sessionId,
      },
    });
    expect(iceResponse.ok()).toBeTruthy();

    const icePayload = await iceResponse.json();
    expect(Array.isArray(icePayload.iceServers)).toBeTruthy();
    expect(icePayload.iceServers.length).toBeGreaterThan(0);
    expect(icePayload.traceId).toBe(traceId);

    const turnUrlSet = new Set(
      icePayload.iceServers.flatMap((server: { urls: string | string[] }) =>
        Array.isArray(server.urls) ? server.urls : [server.urls]
      )
    );
    expect([...turnUrlSet].some((url) => url.startsWith("stun:"))).toBeTruthy();
    expect([...turnUrlSet].some((url) => url.startsWith("turn:"))).toBeTruthy();

    const startResponse = await request.post(`${previewUrl}/start-stream`, {
      headers: {
        "Content-Type": "application/json",
        "x-stream-trace-id": traceId,
        "x-stream-session-id": sessionId,
      },
      data: {
        url: targetUrl,
        peerId: `ci-peer-${Math.random().toString(36).slice(2, 10)}`,
        iceServers: icePayload.iceServers,
      },
      timeout: 120_000,
    });
    expect(startResponse.ok()).toBeTruthy();

    const startPayload = await startResponse.json();
    expect(startPayload.status).toBe("success");
    expect(startPayload.traceId).toBe(traceId);
    expect(startPayload.srcPeerId).toBeTruthy();
    expect(startPayload.monitoringActive).toBeTruthy();

    const diagnostics = {
      traceId,
      sessionId,
      healthPayload,
      iceServerCount: icePayload.iceServers.length,
      srcPeerId: startPayload.srcPeerId,
      monitoringActive: startPayload.monitoringActive,
    };

    await testInfo.attach("preview-smoke", {
      body: Buffer.from(JSON.stringify(diagnostics, null, 2), "utf8"),
      contentType: "application/json",
    });
  });
});
