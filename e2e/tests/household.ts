// A fresh household on the local API per test, and Node WebSocket clients that stand in for the
// phones and iPads (the framework drives one surface per test; the others speak the real protocol).
import WebSocket from "ws";

export const API = process.env.OGS_API ?? "http://localhost:8788";
export const GAME = process.env.FIXTURE_GAME ?? "http://localhost:5190";

export const tvPage = (game: string, label: string) =>
  `${GAME}/tv?game=${encodeURIComponent(game)}&label=${encodeURIComponent(label)}`;

export async function api(path: string, init: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

export interface Household {
  hid: string;
  phoneToken: string;
  launcherToken: string;
  people: { id: string; name: string }[];
  launcherPath: string;
}

export async function household(): Promise<Household> {
  const created = await api("/api/v1/households", {
    body: {
      name: "The Mumms",
      people: [
        { name: "Jonathan", band: "grownup", sticker: "bear" },
        { name: "Mom", band: "grownup", sticker: "owl" },
        { name: "Juneau", band: "kid", sticker: "dragon" },
        { name: "Ava", band: "little", sticker: "dinosaur" },
      ],
      device: { deviceId: `e2e-phone-${Date.now()}`, kind: "phone", name: "Jonathan's iPhone", personIndex: 0 },
    },
  });
  if (created.status !== 201 && created.status !== 200) throw new Error(`household: ${JSON.stringify(created)}`);
  const hid = String(created.json.householdId);
  const phoneToken = String(created.json.token);
  const people = created.json.people as { id: string; name: string }[];
  const lt = await api(`/api/v1/households/${hid}/launcher-token`, { body: {}, token: phoneToken });
  const launcherToken = String(lt.json.token);
  return {
    hid,
    phoneToken,
    launcherToken,
    people,
    launcherPath: `/?api=${encodeURIComponent(API)}&token=${encodeURIComponent(launcherToken)}`,
  };
}

export interface Couch {
  state: () => Record<string, any> | null;
  msgs: Record<string, any>[];
  send: (m: unknown) => void;
  close: () => void;
  until: <T>(fn: () => T, what: string, ms?: number) => Promise<NonNullable<T>>;
}

export async function couch(token: string): Promise<Couch> {
  const ws = new WebSocket(`${API.replace(/^http/, "ws")}/api/v1/couch/ws?token=${encodeURIComponent(token)}`);
  const msgs: Record<string, any>[] = [];
  let state: Record<string, any> | null = null;
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw));
    msgs.push(m);
    if (m.type === "state") state = m.state;
  });
  await new Promise((r, j) => {
    ws.on("open", r);
    ws.on("error", j);
  });
  return {
    state: () => state,
    msgs,
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
    async until(fn, what, ms = 10_000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const v = fn();
        if (v) return v as NonNullable<typeof v>;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`timed out waiting for ${what}`);
    },
  };
}
