// Friends on one simulator; the other people are profiles made through the API (E2E_OGS_API, the
// same API the app was built against). Acceptance: docs/acceptance/2026-10-04-ogs-friends.feature.
import { by, device, element, expect, waitFor } from "detox";
import { skipOnboarding } from "./helpers";

const API = process.env.E2E_OGS_API ?? "http://localhost:8788";

interface Person {
  id: string;
  handle: string;
  name: string;
  token: string;
}

async function call(path: string, token?: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${API}/api/v1${path}`, {
    method: body === undefined && !path.endsWith("/accept") ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const field = (o: unknown, key: string): unknown =>
  typeof o === "object" && o !== null && key in o
    ? Object.getOwnPropertyDescriptor(o, key)?.value
    : undefined;
const str = (o: unknown, key: string): string => {
  const v = field(o, key);
  if (typeof v !== "string") throw new Error(`expected ${key}`);
  return v;
};

let seq = 0;
async function person(name: string, sticker: string): Promise<Person> {
  const tag = `${Date.now().toString(36)}${++seq}`;
  const made = await call("/profiles", undefined, {
    name,
    handle: `${name.toLowerCase()}.${tag}`.slice(0, 24),
    sticker,
    device: { deviceId: `detox-${tag}`, kind: "phone", name: `${name}'s phone` },
  });
  const profile = field(made, "profile");
  return {
    id: str(profile, "id"),
    handle: str(profile, "handle"),
    name,
    token: str(made, "token"),
  };
}

/** Accepts every request waiting for `who`. */
async function acceptAll(who: Person) {
  const incoming = field(await call("/friends/requests", who.token), "incoming");
  for (const r of Array.isArray(incoming) ? incoming : [])
    await call(`/friends/requests/${str(r, "id")}/accept`, who.token);
}

/** Leaves and re-enters the Friends tab (it refreshes when shown). */
async function showFriends() {
  await element(by.id("tabProfile")).tap();
  await element(by.id("tabFriends")).tap();
  await waitFor(element(by.id("friendsScreen")))
    .toExist()
    .withTimeout(3000);
}

describe("Friends", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await skipOnboarding("Tester");
  });

  it("starts empty, with Add a friend", async () => {
    await element(by.id("tabFriends")).tap();
    await waitFor(element(by.id("friendsEmpty")))
      .toExist()
      .withTimeout(5000);
    await expect(element(by.id("addFriend"))).toBeVisible();
  });

  it("Add a friend shows my QR and code; Mom types the code; I accept", async () => {
    const mom = await person("Mom", "owl");
    await showFriends();
    await element(by.id("addFriend")).tap();
    // The QR is absolutely positioned Views on white: Detox's pixel visibility can't judge it.
    await waitFor(element(by.id("inviteQr")))
      .toExist()
      .withTimeout(10000);
    const attrs = await element(by.id("inviteCode")).getAttributes();
    const code = "text" in attrs && typeof attrs.text === "string" ? attrs.text : "";
    if (!/^[A-Z]{4}-[2-9]{2}$/.test(code)) throw new Error(`no invite code on screen: ${code}`);
    await call("/friends/invites/redeem", mom.token, { code });
    await element(by.id("addFriendClose")).tap();
    await showFriends();
    await waitFor(element(by.id(`accept-${mom.handle}`)))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id(`accept-${mom.handle}`)).tap();
    await waitFor(element(by.id(`friend-${mom.handle}`)))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id(`friendPresence-${mom.handle}`))).toHaveText(
      `@${mom.handle} · Online`,
    );

    // Mom casts and her TV connects: her row says so and offers Join; Join puts me on her couch.
    const session = await call("/sessions", mom.token, { tvName: "Living room TV" });
    const ws = new WebSocket(
      `${API.replace(/^http/, "ws")}/api/v1/couch/ws?token=${encodeURIComponent(str(session, "token"))}`,
    );
    let members: string[] = [];
    ws.onmessage = (e) => {
      const state = field(JSON.parse(String(e.data)), "state");
      const list = field(state, "members");
      if (Array.isArray(list)) members = list.map((m) => str(m, "name"));
    };
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("launcher socket failed"));
    });
    try {
      await new Promise((r) => setTimeout(r, 500));
      await showFriends();
      await waitFor(element(by.id(`friendPresence-${mom.handle}`)))
        .toHaveText(`@${mom.handle} · Casting on Living room TV`)
        .withTimeout(5000);
      await element(by.id(`friendJoin-${mom.handle}`)).tap();
      // Mom's TV is live, so I land on its remote; the TV's session now lists me.
      await waitFor(element(by.id("remoteNowOn")))
        .toExist()
        .withTimeout(10000);
      const t0 = Date.now();
      while (!members.includes("Tester") && Date.now() - t0 < 10_000)
        await new Promise((r) => setTimeout(r, 200));
      if (!members.includes("Tester")) throw new Error(`Mom's couch: ${members.join(", ")}`);
    } finally {
      ws.close();
    }
  });

  it("Find by @id sends a request; once Max accepts he is a friend", async () => {
    const max = await person("Max", "firefly");
    await showFriends();
    await element(by.id("addFriend")).tap();
    await waitFor(element(by.id("friendHandleInput")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("friendHandleInput")).typeText(`@${max.handle}`);
    await element(by.id("friendHandleInput")).tapReturnKey();
    await element(by.id("friendHandleSend")).tap();
    await waitFor(element(by.id("addFriendDone")))
      .toHaveText("Sent. Max will see your request in Friends.")
      .withTimeout(5000);
    await acceptAll(max);
    await element(by.id("addFriendClose")).tap();
    await showFriends();
    await waitFor(element(by.id(`friend-${max.handle}`)))
      .toBeVisible()
      .withTimeout(5000);
  });
});
