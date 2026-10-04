// Friends at the API boundary with two (and three) real profiles (no screen, no model).
// Acceptance: docs/acceptance/2026-10-04-ogs-friends.feature.
import { describe, expect, test } from "e2e";
import { z } from "zod";
import { API, cast, couch, ErrorSchema, type Profile, profile } from "./profile";

const codeOf = (json: unknown) => ErrorSchema.parse(json).error.code;

/** Like profile.ts `api`, but a 204 has no body. */
async function call(path: string, init: { method?: string; body?: unknown; token: string }) {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json", authorization: `Bearer ${init.token}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json: unknown = res.status === 204 ? null : await res.json();
  return { status: res.status, json };
}

const Pub = z.object({ id: z.string(), handle: z.string(), name: z.string(), sticker: z.string() });
const Friend = Pub.extend({ presence: z.object({ kind: z.string() }).passthrough(), since: z.number() });
const Invite = z.object({ code: z.string(), link: z.string(), qr: z.string(), expiresAt: z.number() });
const Request = z.object({ id: z.string(), from: Pub, to: Pub, via: z.string() });
const Requested = z.object({ status: z.literal("requested"), request: Request });
const Requests = z.object({ incoming: z.array(Request), outgoing: z.array(Request) });
const Casting = z.array(z.object({ sessionId: z.string(), tvName: z.string(), host: Pub, joined: z.boolean() }));

const friendsOf = async (p: Profile) => z.array(Friend).parse((await call("/api/v1/friends", { token: p.token })).json);
const invite = async (p: Profile) =>
  Invite.parse((await call("/api/v1/friends/invites", { method: "POST", token: p.token })).json);
const tokenOf = (url: string) => url.slice(url.lastIndexOf("/") + 1);

async function poll<T>(read: () => Promise<T>, ok: (v: T) => boolean, what: string): Promise<T> {
  const t0 = Date.now();
  while (Date.now() - t0 < 10_000) {
    const v = await read();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out waiting for ${what}`);
}

describe("API friends", { tags: ["api"], requires: ["browser"] }, () => {
  test("Max types Jonathan's code → Jonathan accepts → both are friends", async () => {
    const jonathan = await profile("Jonathan", "bear");
    const max = await profile("Max", "firefly");
    const inv = await invite(jonathan);
    expect(inv.code).toMatch(/^[A-Z]{4}-[2-9]{2}$/);
    const sent = await call("/api/v1/friends/invites/redeem", { body: { code: inv.code.toLowerCase() }, token: max.token });
    expect(sent.status).toBe(201);
    const { request } = Requested.parse(sent.json);
    const mine = Requests.parse((await call("/api/v1/friends/requests", { token: jonathan.token })).json);
    expect(mine.incoming.map((r) => r.from.name)).toEqual(["Max"]);
    const ok = await call(`/api/v1/friends/requests/${request.id}/accept`, { method: "POST", token: jonathan.token });
    expect(ok.status).toBe(200);
    expect((await friendsOf(max)).map((f) => f.name)).toEqual(["Jonathan"]);
    expect((await friendsOf(jonathan)).map((f) => f.name)).toEqual(["Max"]);
  });

  test("a QR scan in person makes friends at once; the invite then is used", async () => {
    const jonathan = await profile("Jonathan", "bear");
    const mom = await profile("Mom", "owl");
    const max = await profile("Max", "firefly");
    const inv = await invite(jonathan);
    const scanned = await call("/api/v1/friends/invites/redeem", { body: { token: tokenOf(inv.qr) }, token: mom.token });
    expect(scanned.status).toBe(200);
    expect((await friendsOf(jonathan)).map((f) => f.name)).toEqual(["Mom"]);
    const late = await call("/api/v1/friends/invites/redeem", { body: { token: tokenOf(inv.link) }, token: max.token });
    expect(late.status).toBe(410);
    expect(codeOf(late.json)).toBe("invite_used");
  });

  test("find by @id, then decline", async () => {
    const jonathan = await profile("Jonathan", "bear");
    const max = await profile("Max", "firefly");
    const sent = await call("/api/v1/friends/requests", { body: { handle: `@${jonathan.handle}` }, token: max.token });
    expect(sent.status).toBe(201);
    const { request } = Requested.parse(sent.json);
    const no = await call(`/api/v1/friends/requests/${request.id}/decline`, { method: "POST", token: jonathan.token });
    expect(no.status).toBe(204);
    expect(await friendsOf(jonathan)).toEqual([]);
  });

  test("Mom casts → Jonathan (friend) sees a Join card and joins; Max (not a friend) is refused but has the TV code", async () => {
    const jonathan = await profile("Jonathan", "bear");
    const mom = await profile("Mom", "owl");
    const max = await profile("Max", "firefly");
    const inv = await invite(mom);
    await call("/api/v1/friends/invites/redeem", { body: { token: tokenOf(inv.qr) }, token: jonathan.token });
    const tv = await cast(mom);
    const launcher = await couch(tv.launcherToken);
    const cards = await poll(
      async () => Casting.parse((await call("/api/v1/friends/casting", { token: jonathan.token })).json),
      (c) => c.length === 1,
      "Mom's Join card",
    );
    expect(cards[0]).toMatchObject({ sessionId: tv.sessionId, tvName: "Living room TV", joined: false });
    expect((await friendsOf(jonathan))[0].presence).toMatchObject({ kind: "casting", tvName: "Living room TV" });
    const join = await call(`/api/v1/sessions/${tv.sessionId}/join`, { method: "POST", token: jonathan.token });
    expect(join.status).toBe(200);
    const phone = await couch(jonathan.token, tv.sessionId);
    await launcher.until(() => launcher.state()?.members.some((m) => m.name === "Jonathan"), "Jonathan on the TV");
    const refused = await call(`/api/v1/sessions/${tv.sessionId}/join`, { method: "POST", token: max.token });
    expect(refused.status).toBe(403);
    expect(codeOf(refused.json)).toBe("not_a_friend");
    await tv.join(max);
    phone.close();
    launcher.close();
    await poll(
      async () => Casting.parse((await call("/api/v1/friends/casting", { token: jonathan.token })).json),
      (c) => c.length === 0,
      "the Join card to go",
    );
  });
});
