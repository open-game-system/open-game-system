import { SELF } from "cloudflare:test";
import { z } from "zod";
import { BASE } from "./helpers";

/** Loose view of server frames; tests assert on the fields they care about. */
const FrameSchema = z.looseObject({ type: z.string() });
export type Frame = z.infer<typeof FrameSchema>;

const StateFrameSchema = z.object({
  type: z.literal("state"),
  state: z.looseObject({
    sessionId: z.string(),
    hostProfileId: z.string(),
    members: z.array(z.object({ profileId: z.string(), name: z.string(), sticker: z.string() })),
    cast: z.boolean(),
    casts: z.number(),
    screen: z.enum(["home", "game-page", "game"]),
    focus: z.string().nullable(),
    page: z.string().nullable(),
    remote: z.string().nullable(),
    current: z
      .looseObject({
        appId: z.string(),
        instanceId: z.string(),
        label: z.string(),
        viewUrl: z.string().nullable(),
        hostDeviceId: z.string().nullable(),
      })
      .nullable(),
    suspended: z.array(
      z.object({ appId: z.string(), instanceId: z.string(), label: z.string(), at: z.number() }),
    ),
    devices: z.array(
      z.looseObject({ deviceId: z.string(), kind: z.string(), online: z.boolean() }),
    ),
    tvName: z.string().optional(),
  }),
});
export type StateFrame = z.infer<typeof StateFrameSchema>;
export type SessionView = StateFrame["state"];

export const couchUrl = (token: string, session?: string) =>
  `${BASE}/couch/ws?token=${encodeURIComponent(token)}${
    session ? `&session=${encodeURIComponent(session)}` : ""
  }`;

/** A real WebSocket to the couch session, buffering every frame it receives. */
export class CouchClient {
  readonly frames: Frame[] = [];
  private waiters: Array<() => void> = [];
  closed = false;

  private constructor(readonly ws: WebSocket) {
    ws.addEventListener("message", (e) => {
      if (typeof e.data !== "string") return;
      this.frames.push(FrameSchema.parse(JSON.parse(e.data)));
      for (const w of this.waiters.splice(0)) w();
    });
    ws.addEventListener("close", () => {
      this.closed = true;
      for (const w of this.waiters.splice(0)) w();
    });
  }

  static async connect(token: string, session?: string): Promise<CouchClient> {
    const res = await SELF.fetch(couchUrl(token, session), {
      headers: { Upgrade: "websocket" },
    });
    const ws = res.webSocket;
    if (res.status !== 101 || !ws)
      throw new Error(`couch connect: ${res.status} ${await res.text()}`);
    ws.accept();
    return new CouchClient(ws);
  }

  send(msg: unknown): void {
    this.ws.send(JSON.stringify(msg));
  }

  /** Resolves with the first frame (from `from` on) matching the predicate. */
  async next(match: (f: Frame) => boolean, from = 0, timeoutMs = 2000): Promise<Frame> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = this.frames.slice(from).find(match);
      if (hit) return hit;
      if (Date.now() > deadline)
        throw new Error(`timed out; frames: ${JSON.stringify(this.frames)}`);
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
        setTimeout(resolve, 50);
      });
    }
  }

  /** The first state frame (after the frames seen so far) whose state satisfies `when`. */
  async state(when: (s: SessionView) => boolean = () => true, from = 0): Promise<SessionView> {
    const f = await this.next((x) => {
      const p = StateFrameSchema.safeParse(x);
      return p.success && when(p.data.state);
    }, from);
    return StateFrameSchema.parse(f).state;
  }

  /** Latest state received. */
  get latest(): SessionView | null {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const p = StateFrameSchema.safeParse(this.frames[i]);
      if (p.success) return p.data.state;
    }
    return null;
  }

  mark(): number {
    return this.frames.length;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.ws.close(1000, "done");
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** A follow into a game (tablets also get "follow launcher" when they connect). */
export const isGameFollow = (f: Frame) =>
  f.type === "follow" &&
  z.object({ target: z.object({ kind: z.literal("game") }) }).safeParse(f).success;
