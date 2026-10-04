// Every code sample on the developer pages, with real values from the fake world.
// Grounded in docs/specification.md (the .well-known file, api.opengame.org, GAME_API_KEY,
// /auth/verify-token) and cast-kit-react (useCastViewUrl). New surfaces are flagged where shown.
import { COUCH, gameById, type GameManifest } from "../../../world";

const q = (s: string) => JSON.stringify(s);

/** A game's Tier 0 manifest as the file it hosts. Built from the library data, so it can't drift. */
export function manifestJson(g: GameManifest, icon = true): string {
  const roles = g.roles
    .map((r, i) => `    { "id": ${q(r.id)}, "audience": ${q(r.audience)}, "label": ${q(r.label)} }${i < g.roles.length - 1 ? "," : ""}`)
    .join("\n");
  const origin = new URL(g.startUrl).origin;
  return [
    "{",
    `  "appId": ${q(g.id)},`,
    `  "name": ${q(g.name)},`,
    `  "apiVersion": "v1",`,
    ...(icon ? [`  "icon": ${q(`${origin}/icon.png`)},`] : []),
    `  "shape": ${q(g.shape)},`,
    `  "minutes": [${g.minutes[0]}, ${g.minutes[1]}],`,
    `  "startUrl": ${q(g.startUrl)},`,
    `  "tvUrl": ${q(g.tvUrl ?? "")},`,
    `  "roles": [`,
    roles,
    "  ]",
    "}",
  ].join("\n");
}

const PEEK = gameById("peekaboo-garden");
export const PEEK_ORIGIN = new URL(PEEK.startUrl).origin;
export const PEEK_MANIFEST = manifestJson(PEEK);
export const MANIFEST_PATH = "/.well-known/opengame-association.json";

/** The manifest a developer pastes in the Console with two mistakes: a LAN dev TV URL and a role with no audience. */
export const PEEK_MANIFEST_BROKEN = PEEK_MANIFEST.replace(PEEK.tvUrl ?? "", "http://192.168.1.20:5173/tv").replace(
  `{ "id": "little", "audience": "little", "label": "Little sister" }`,
  `{ "id": "little", "label": "Little sister" }`,
);

export const TOKEN_URL = `${new URL(gameById("bake-shop").startUrl).origin}/?ogs=eyJhbGciOiJFZERTQSIs…`;

export const TOKEN_CLAIMS = `{
  "iss": "https://api.opengame.org",
  "aud": "bake-shop",
  "household": "hh-mumm",
  "person": "juneau",
  "name": "Juneau",
  "band": "kid",
  "device": "dev-juneau-ipad",
  "role": "baker",
  "room": "couch-hh-mumm-1003",
  "exp": 1791089400
}`;

export const READ_TOKEN = `// Bake Shop · src/start.ts — in the browser, no server
const token = new URL(location.href).searchParams.get("ogs");
const me = await fetch("https://api.opengame.org/api/v1/me", {
  headers: { Authorization: \`Bearer \${token}\` },
}).then((r) => r.json());

// Juneau's iPad opens straight into his seat. No picker.
if (me.role === "baker") showBaker(me.name);`;

const BAKE = COUCH.find((i) => i.gameId === "bake-shop");
const BAKE_SAVE = BAKE?.save;

export const SAVE_GET = `GET /api/v1/saves/bake-shop HTTP/1.1
Host: api.opengame.org
Authorization: Bearer <ogs token>

HTTP/1.1 200 OK
ETag: "${BAKE_SAVE?.version ?? 2}"
{
  "version": ${BAKE_SAVE?.version ?? 2},
  "resume": "${BAKE?.title ?? ""}",
  "data": { "day": 4, "baked": 3, "recipes": 11 }
}`;

export const SAVE_PUT = `PUT /api/v1/saves/bake-shop HTTP/1.1
Authorization: Bearer <ogs token>
If-Match: "${BAKE_SAVE?.version ?? 2}"
{
  "resume": "Day 4 · 4 of 5 orders baked",
  "data": { "day": 4, "baked": 4, "recipes": 11 }
}

HTTP/1.1 200 OK
ETag: "${(BAKE_SAVE?.version ?? 2) + 1}"`;

const RC = COUCH.find((i) => i.gameId === "rocket-crew");

export const INSTANCE_POST = `POST /api/v1/instances HTTP/1.1
Host: api.opengame.org
Authorization: Bearer GAME_API_KEY
{
  "id": "${RC?.id ?? "rc-1"}",
  "household": "hh-mumm",
  "status": "suspended",
  "title": "${RC?.title ?? ""}",
  "detail": "Paused at 7:14 pm · Bake Shop is on now",
  "seats": [
    { "label": "Captain", "person": "dad" },
    { "label": "Fixer", "person": "juneau" }
  ],
  "turn": null,
  "url": "${RC?.resumeUrl ?? ""}"
}

HTTP/1.1 202 Accepted`;

export const INSTANCE_WORKER = `// Rocket Crew · src/room.ts (the room's Durable Object)
async webSocketClose() {
  if (this.connected() > 0) return;
  const card = { ...this.card(), status: "suspended" };
  await reportInstance(this.env, card); // the POST above
}`;

export const TURN_SNIPPET = `{ "status": "waiting", "turn": { "person": "dad" },
  "title": "Your move · QUILT for 34" }`;

export const CAST_SNIPPET = `// Rocket Crew · src/host/HostPanel.tsx
import { useCastViewUrl } from "@open-game-system/cast-kit-react";

// Optional. Without it, OGS casts the manifest's tvUrl as-is.
useCastViewUrl(\`\${TV_URL}?room=\${room.id}&stream=1\`);`;

export const STREAM_SNIPPET = `// src/tv/main.ts
const streamed = new URL(location.href).searchParams.has("stream");
if (streamed) music.play(); // autoplay is allowed: nobody can tap the TV`;
