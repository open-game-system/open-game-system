import { describe, expect, it } from "vitest";
import { createAudioPause, type PausableContext } from "./audio-pause";

function fakeCtx(state: AudioContextState = "running"): PausableContext {
  const ctx: PausableContext = {
    state,
    suspend: async () => {
      ctx.state = "suspended";
    },
    resume: async () => {
      ctx.state = "running";
    },
  };
  return ctx;
}

describe("createAudioPause (parked by the OGS launcher means silent)", () => {
  it("suspends a playing context when parked and resumes it on Continue", () => {
    const ctx = fakeCtx();
    const gate = createAudioPause(() => ctx);
    gate.setPaused(true);
    expect(ctx.state).toBe("suspended");
    gate.setPaused(false);
    expect(ctx.state).toBe("running");
  });

  it("never starts a context that was not playing before it was parked", () => {
    const ctx = fakeCtx("suspended");
    const gate = createAudioPause(() => ctx);
    gate.setPaused(true);
    gate.setPaused(false);
    expect(ctx.state).toBe("suspended");
  });

  it("an unlock while parked stays silent until Continue", () => {
    const ctx = fakeCtx();
    const gate = createAudioPause(() => null);
    gate.setPaused(true);
    expect(gate.unlocked(ctx)).toBe(false);
    expect(ctx.state).toBe("suspended");
    gate.setPaused(false);
    expect(ctx.state).toBe("running");
    expect(gate.unlocked(ctx)).toBe(true);
  });
});
