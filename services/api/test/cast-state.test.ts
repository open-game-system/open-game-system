import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { openTestD1, type TestD1 } from "./support/d1";

/** POST /api/v1/cast/sessions/:id/state against a real local D1: which sessions take state. */
let d1: TestD1;
let containerBodies: unknown[];
let containerDown: boolean;

beforeAll(async () => {
  d1 = await openTestD1();
});
afterAll(() => d1.dispose());
beforeEach(async () => {
  await d1.reset();
  containerBodies = [];
  containerDown = false;
  const session = (id: string, game: string, status: string) =>
    d1.db
      .prepare(
        "INSERT INTO cast_sessions (session_id, game_id, device_id, view_url, stream_session_id, status) VALUES (?, ?, 'tv', 'https://g/tv', ?, ?)",
      )
      .bind(id, game, `stream-${id}`, status);
  await d1.db.batch([
    d1.db.prepare(
      "INSERT INTO api_keys (key, game_id, game_name) VALUES ('k1', 'trivia', 'Trivia')",
    ),
    session("active", "trivia", "active"),
    session("idle", "trivia", "idle"),
    session("pending", "trivia", "pending"),
    session("ended", "trivia", "ended"),
    session("theirs", "other-game", "active"),
  ]);
});

const env = () => ({
  DB: d1.db,
  STREAM_CONTAINER: {
    idFromName: (name: string) => ({ name }),
    get: () => ({
      fetch: async (_url: string, init: RequestInit) => {
        if (containerDown) throw new Error("container asleep");
        containerBodies.push(JSON.parse(String(init.body)));
        return new Response("ok");
      },
    }),
  },
});

async function pushState(sessionId: string, body: unknown = { state: { round: 2 } }) {
  const res = await app.request(
    `/api/v1/cast/sessions/${sessionId}/state`,
    {
      method: "POST",
      headers: { Authorization: "Bearer k1", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env(),
  );
  return { status: res.status, body: await res.json() };
}
const statusOf = async (id: string) =>
  (await d1.db.prepare("SELECT status FROM cast_sessions WHERE session_id = ?").bind(id).first())
    ?.status;

describe("cast state push", () => {
  it("forwards state for an active session", async () => {
    expect(await pushState("active")).toEqual({ status: 200, body: { status: "ok" } });
    expect(containerBodies).toEqual([{ state: { round: 2 } }]);
  });

  it("wakes an idle session", async () => {
    expect((await pushState("idle")).status).toBe(200);
    expect(await statusOf("idle")).toBe("active");
  });

  it("answers ok even when the container can't take it (best effort)", async () => {
    containerDown = true;
    expect(await pushState("active")).toEqual({ status: 200, body: { status: "ok" } });
  });

  it.each(["pending", "ended", "theirs", "missing"])("refuses the %s session", async (id) => {
    const r = await pushState(id);
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ error: { code: "session_not_found" } });
    expect(containerBodies).toEqual([]);
  });
});
