import { describe, expect, it } from "vitest";
import { PrivateViewSchema, PublicViewSchema } from "../room.schemas";
import { advance, join, newRoom, pick, start } from "./room";
import { TIMING } from "./rules";
import { withViews } from "./views";

const T0 = 5_000;
function game() {
  let s = newRoom({ roomCode: "WXYZ", tvId: "tv-secret", seed: 3 });
  s = join(s, { callerId: "secret-1", name: "Ana", ogsId: null });
  s = join(s, { callerId: "secret-2", name: "Bo", ogsId: null });
  return s;
}

describe("withViews", () => {
  it("never puts a caller id (a rejoin token) in any view", () => {
    const ctx = withViews(start(game(), "secret-1", T0));
    const text = JSON.stringify({ public: ctx.public, private: Object.values(ctx.private) });
    expect(text).not.toContain("secret-");
  });

  it("matches the schemas the screens parse", () => {
    const ctx = withViews(start(game(), "secret-1", T0));
    expect(PublicViewSchema.safeParse(ctx.public).success).toBe(true);
    for (const view of Object.values(ctx.private)) {
      expect(PrivateViewSchema.safeParse(view).success).toBe(true);
    }
  });

  it("gives the TV its role and each phone its seat, host flag and pick", () => {
    let s = advance(start(game(), "secret-1", T0), T0 + TIMING.showMs);
    s = pick(s, "secret-2", "lime", T0 + 6000);
    const ctx = withViews(s);
    expect(ctx.private["tv-secret"]).toEqual({ role: "tv" });
    expect(ctx.private["secret-1"]).toEqual({ role: "player", seat: "p1", host: true, pick: null });
    expect(ctx.private["secret-2"]).toEqual({ role: "player", seat: "p2", host: false, pick: "lime" });
  });

  it("shows the kites only while the TV shows them", () => {
    const show = start(game(), "secret-1", T0);
    expect(withViews(show).public.shapes.length).toBeGreaterThan(0);
    const answer = advance(show, T0 + TIMING.showMs);
    expect(withViews(answer).public.shapes).toEqual([]);
  });

  it("keeps the answer and other players' picks hidden until the reveal", () => {
    let s = advance(start(game(), "secret-1", T0), T0 + TIMING.showMs);
    s = pick(s, "secret-1", "gold", T0 + 6000);
    const during = withViews(s).public;
    expect(during.reveal).toBeNull();
    expect(during.players.map((p) => p.answered)).toEqual([true, false]);
    expect(JSON.stringify(during)).not.toContain("gold");
    const after = withViews(advance(s, T0 + 99_000)).public;
    expect(after.reveal?.answer).toBe(s.current?.answer);
  });

  it("names the winners only at the end", () => {
    const s = game();
    expect(withViews(s).public.winners).toEqual([]);
    const over = { ...s, phase: "over" as const, seats: s.seats.map((x, i) => ({ ...x, score: i })) };
    expect(withViews(over).public.winners).toEqual(["Bo"]);
  });
});
