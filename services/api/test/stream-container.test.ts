import { describe, expect, it } from "vitest";
import { createSfuState, handleSfuRequest } from "../src/stream-container";

describe("handleSfuRequest", () => {
  // ─── State retrieval ───

  describe("GET /sfu/state", () => {
    it("returns empty state initially", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/sfu/state", { method: "GET" });
      const res = await handleSfuRequest(req, state);
      expect(res).not.toBeNull();
      const body = await res!.json();
      expect(body).toEqual({
        publisherSessionId: null,
        publisherTracks: [],
        subscriberSessions: {},
      });
    });

    it("returns stored publisher state after PUT", async () => {
      const state = createSfuState();
      const putReq = new Request("http://localhost/sfu/publisher-session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publisherSessionId: "session-abc",
          tracks: [
            { location: "local", trackName: "cast-video" },
            { location: "local", trackName: "cast-audio" },
          ],
        }),
      });
      await handleSfuRequest(putReq, state);

      const getReq = new Request("http://localhost/sfu/state", { method: "GET" });
      const res = await handleSfuRequest(getReq, state);
      const body = (await res!.json()) as Record<string, unknown>;
      expect(body.publisherSessionId).toBe("session-abc");
      expect(body.publisherTracks).toEqual([
        { location: "local", trackName: "cast-video" },
        { location: "local", trackName: "cast-audio" },
      ]);
    });

    it("returns subscriber sessions after PUT", async () => {
      const state = createSfuState();
      const putReq = new Request("http://localhost/sfu/subscriber-sessions/sub-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "sub-1" }),
      });
      await handleSfuRequest(putReq, state);

      const getReq = new Request("http://localhost/sfu/state", { method: "GET" });
      const res = await handleSfuRequest(getReq, state);
      const body = (await res!.json()) as Record<string, unknown>;
      expect(body.subscriberSessions).toEqual({ "sub-1": "sub-1" });
    });
  });

  // ─── Publisher session storage ───

  describe("PUT /sfu/publisher-session", () => {
    it("stores publisherSessionId and tracks", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/sfu/publisher-session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publisherSessionId: "session-xyz",
          tracks: [{ location: "local", trackName: "cast-video", mid: "0" }],
        }),
      });
      const res = await handleSfuRequest(req, state);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(200);
      const body = (await res!.json()) as Record<string, unknown>;
      expect(body.status).toBe("ok");

      expect(state.publisherSessionId).toBe("session-xyz");
      expect(state.publisherTracks).toEqual([
        { location: "local", trackName: "cast-video", mid: "0" },
      ]);
    });

    it("returns 400 for missing publisherSessionId", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/sfu/publisher-session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: [] }),
      });
      const res = await handleSfuRequest(req, state);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(400);
    });

    it("returns 400 for missing tracks", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/sfu/publisher-session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publisherSessionId: "session-1" }),
      });
      const res = await handleSfuRequest(req, state);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(400);
    });

    it("overwrites previous publisher session", async () => {
      const state = createSfuState();
      const req1 = new Request("http://localhost/sfu/publisher-session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publisherSessionId: "session-1",
          tracks: [{ location: "local", trackName: "cast-video" }],
        }),
      });
      await handleSfuRequest(req1, state);

      const req2 = new Request("http://localhost/sfu/publisher-session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publisherSessionId: "session-2",
          tracks: [{ location: "local", trackName: "cast-audio" }],
        }),
      });
      await handleSfuRequest(req2, state);

      expect(state.publisherSessionId).toBe("session-2");
      expect(state.publisherTracks).toEqual([
        { location: "local", trackName: "cast-audio" },
      ]);
    });
  });

  // ─── Subscriber session management ───

  describe("PUT /sfu/subscriber-sessions/:id", () => {
    it("stores a subscriber session", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/sfu/subscriber-sessions/sub-abc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "sub-abc" }),
      });
      const res = await handleSfuRequest(req, state);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(200);

      expect(state.subscriberSessions.get("sub-abc")).toBe("sub-abc");
    });

    it("stores multiple subscriber sessions", async () => {
      const state = createSfuState();
      for (const id of ["sub-1", "sub-2", "sub-3"]) {
        const req = new Request(`http://localhost/sfu/subscriber-sessions/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: id }),
        });
        await handleSfuRequest(req, state);
      }

      expect(state.subscriberSessions.size).toBe(3);
      expect(state.subscriberSessions.get("sub-1")).toBe("sub-1");
      expect(state.subscriberSessions.get("sub-2")).toBe("sub-2");
      expect(state.subscriberSessions.get("sub-3")).toBe("sub-3");
    });

    it("returns 400 for missing sessionId", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/sfu/subscriber-sessions/sub-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await handleSfuRequest(req, state);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(400);
    });
  });

  describe("DELETE /sfu/subscriber-sessions/:id", () => {
    it("removes a subscriber session", async () => {
      const state = createSfuState();
      state.subscriberSessions.set("sub-1", "sub-1");

      const req = new Request("http://localhost/sfu/subscriber-sessions/sub-1", {
        method: "DELETE",
      });
      const res = await handleSfuRequest(req, state);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(200);
      expect(state.subscriberSessions.has("sub-1")).toBe(false);
    });

    it("returns 200 for nonexistent subscriber (idempotent)", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/sfu/subscriber-sessions/nonexistent", {
        method: "DELETE",
      });
      const res = await handleSfuRequest(req, state);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(200);
    });
  });

  // ─── Container-proxied paths (returns null) ───

  describe("container-proxied paths", () => {
    it("returns null for POST /publisher/prepare", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/publisher/prepare", { method: "POST" });
      const res = await handleSfuRequest(req, state);
      expect(res).toBeNull();
    });

    it("returns null for POST /publisher/answer", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/publisher/answer", { method: "POST" });
      const res = await handleSfuRequest(req, state);
      expect(res).toBeNull();
    });

    it("returns null for GET /publisher/state", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/publisher/state", { method: "GET" });
      const res = await handleSfuRequest(req, state);
      expect(res).toBeNull();
    });

    it("returns null for GET /health", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/health", { method: "GET" });
      const res = await handleSfuRequest(req, state);
      expect(res).toBeNull();
    });

    it("returns null for unknown paths", async () => {
      const state = createSfuState();
      const req = new Request("http://localhost/some-other-path", { method: "GET" });
      const res = await handleSfuRequest(req, state);
      expect(res).toBeNull();
    });
  });
});
