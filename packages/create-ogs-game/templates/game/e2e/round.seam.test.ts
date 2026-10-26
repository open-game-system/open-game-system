import { createActorKitClient } from "actor-kit/browser";
import { describe, expect, inject, it } from "vitest";
import { TIMING } from "../src/game/rules";
import type { roomMachine } from "../src/room.machine";
import { BootSchema } from "../src/room.schemas";
import type { Boot, PublicView } from "../src/room.types";

const origin = inject("origin");

/** Follows redirects by hand (to see each Location) and returns the final page's boot payload. */
async function open(path: string): Promise<{ boot: Boot; url: URL; headers: Headers }> {
  let url = new URL(path, origin);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, { redirect: "manual" });
    const location = res.headers.get("Location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    expect(res.status).toBe(200);
    const html = await res.text();
    const json = /<script id="boot" type="application\/json">(.*?)<\/script>/s.exec(html)?.[1];
    if (!json) throw new Error(`no boot payload at ${url.pathname}`);
    return { boot: BootSchema.parse(JSON.parse(json)), url, headers: res.headers };
  }
  throw new Error("too many redirects");
}

function connect(boot: Boot) {
  const client = createActorKitClient<typeof roomMachine>({
    host: boot.host,
    actorType: "room",
    actorId: boot.roomCode,
    accessToken: boot.accessToken,
    checksum: boot.checksum,
    initialSnapshot: boot.snapshot,
  });
  const until = (ok: (v: PublicView) => boolean, ms = 20_000) =>
    new Promise<PublicView>((resolve, reject) => {
      const check = () => {
        const view = client.getState().public;
        if (ok(view)) {
          clearTimeout(timer);
          stop();
          resolve(view);
        }
      };
      const timer = setTimeout(() => {
        stop();
        reject(new Error(`timed out; last view ${JSON.stringify(client.getState().public)}`));
      }, ms);
      const stop = client.subscribe(check);
      check();
    });
  return { client, until };
}

describe(`a round over real WebSockets (${origin})`, () => {
  it("answers its health check", async () => {
    const res = await fetch(`${origin}/healthz`);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("host phone, a second phone and the TV play a round", async () => {
    const host = await open("/host");
    expect(host.boot.tvUrl).toContain(`/tv/${host.boot.roomCode}?t=`);
    const tv = await open(new URL(host.boot.tvUrl).pathname + new URL(host.boot.tvUrl).search);
    // The OGS launcher frames the TV page: nothing may forbid it.
    expect(tv.headers.get("X-Frame-Options")).toBeNull();
    expect(tv.boot.snapshot.private).toEqual({ role: "tv" });
    const guest = await open(`/join/${host.boot.roomCode}`);

    const [a, b, t] = [connect(host.boot), connect(guest.boot), connect(tv.boot)];
    await Promise.all([a.client.connect(), b.client.connect(), t.client.connect()]);
    // One at a time: over a real network Bo's join can land first, and the first seat hosts.
    a.client.send({ type: "JOIN", name: "Ana" });
    await t.until((v) => v.players.length === 1);
    b.client.send({ type: "JOIN", name: "Bo" });
    await t.until((v) => v.players.length === 2);
    a.client.send({ type: "START" });
    const show = await t.until((v) => v.phase === "show");
    expect(show.shapes.length).toBeGreaterThan(0);
    await a.until((v) => v.phase === "answer", TIMING.showMs + 5000);
    a.client.send({ type: "PICK", color: "coral" });
    b.client.send({ type: "PICK", color: "sky" });
    const reveal = await t.until((v) => v.phase === "reveal");
    expect(reveal.reveal?.answer).toBeDefined();
    expect(reveal.players.map((p) => p.score).reduce((x, y) => x + y)).toBe(
      ["coral", "sky"].filter((c) => c === reveal.reveal?.answer).length,
    );
    for (const c of [a, b, t]) c.client.disconnect();
  });

  it("a refreshed phone keeps its seat (same token, same caller)", async () => {
    const host = await open("/host");
    const first = connect(host.boot);
    await first.client.connect();
    first.client.send({ type: "JOIN", name: "Cy" });
    await first.until((v) => v.players.length === 1);
    first.client.disconnect();
    // The same URL again (a refresh): the same seat, from the first snapshot on.
    const again = await open(host.url.pathname + host.url.search);
    expect(again.boot.snapshot.private).toMatchObject({ role: "player", seat: "p1", host: true });
  });

  it("takes client logs and refuses junk", async () => {
    const ok = await fetch(`${origin}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [{ name: "seam.test", page: "tv" }] }),
    });
    expect(ok.status).toBe(204);
    const bad = await fetch(`${origin}/events`, { method: "POST", body: "{}" });
    expect(bad.status).toBe(400);
  });
});
