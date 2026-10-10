import type { CastOutcome } from "../../../../services/cast-flow";
import type { CastDevice } from "../../../../services/cast-store";
import { hashId } from "../../../../services/client-log";
import { castAndPlay, confirmCast, createCastPrompt, type PromptLog } from "../play-action";

/**
 * The cast prompt's outcomes (owner, 2026-10-10: "<TV> didn't answer. Is it on?" while casting
 * worked). Only a real failure (the TV unreachable, nothing connecting in time) says "didn't
 * answer"; a start Cast refused because another cast is up says so; each error is logged.
 */

const tv = (id: string, name = id): CastDevice => ({ id, name, type: "chromecast" });

function recorder() {
  const logged: { name: string; data: Record<string, unknown>; level?: string }[] = [];
  const log: PromptLog = (name, data, level) => void logged.push({ name, data, level });
  return { logged, log, names: () => logged.map((l) => l.name) };
}

async function confirmWith(
  outcome: CastOutcome,
  opts: { launcherUp?: boolean; throws?: Error } = {},
) {
  const r = recorder();
  const play = jest.fn();
  const castNow = jest.fn(async (_tv: CastDevice, _data: { promptId: string }) => {
    if (opts.throws) throw opts.throws;
    return outcome;
  });
  const error = await confirmCast(tv("den", "Den TV"), {
    promptId: "p-1",
    castNow,
    waitForCast: async () => opts.launcherUp ?? true,
    play,
    log: r.log,
    errorText: (err) => `oops: ${err instanceof Error ? err.message : "?"}`,
  });
  return { ...r, error, play, castNow };
}

describe("confirmCast: the prompt's Cast, its outcome and its log", () => {
  it("started and the launcher came up: plays, no error; confirmed is logged with the prompt id", async () => {
    const t = await confirmWith("started");
    expect(t.error).toBeNull();
    expect(t.play).toHaveBeenCalledTimes(1);
    expect(t.castNow).toHaveBeenCalledWith(tv("den", "Den TV"), { promptId: "p-1" });
    expect(t.names()).toEqual(["prompt.confirmed"]);
    expect(t.logged[0].data).toEqual({ promptId: "p-1", tv: hashId("den") });
  });

  it("the TV can't be reached (no-tv): 'didn't answer', logged with its reason and copy", async () => {
    const t = await confirmWith("no-tv");
    expect(t.error).toBe("Den TV didn't answer. Is it on?");
    expect(t.play).not.toHaveBeenCalled();
    expect(t.logged[1]).toEqual({
      name: "prompt.error",
      level: "warn",
      data: { promptId: "p-1", tv: hashId("den"), reason: "no-tv", copyKey: "no-answer" },
    });
  });

  it("a session on its way never connected (timeout): the same 'didn't answer' copy", async () => {
    const t = await confirmWith("timeout");
    expect(t.error).toBe("Den TV didn't answer. Is it on?");
    expect(t.logged[1].data).toMatchObject({ reason: "timeout", copyKey: "no-answer" });
  });

  it("cast, but the launcher never came up: 'didn't answer', reason launcher-timeout", async () => {
    const t = await confirmWith("started", { launcherUp: false });
    expect(t.error).toBe("Den TV didn't answer. Is it on?");
    expect(t.logged[1].data).toMatchObject({ reason: "launcher-timeout", copyKey: "no-answer" });
  });

  it("Cast refused because another cast is up: not 'didn't answer'", async () => {
    const t = await confirmWith("refused-session-active");
    expect(t.error).toBe("Another cast is still running. Try again in a moment.");
    expect(t.error).not.toContain("didn't answer");
    expect(t.logged[1].data).toMatchObject({
      reason: "refused-session-active",
      copyKey: "busy",
    });
  });

  it("the cast throws (offline): the user message, logged as reason error", async () => {
    const t = await confirmWith("started", { throws: new Error("offline") });
    expect(t.error).toBe("oops: offline");
    expect(t.logged[1].data).toMatchObject({ reason: "error", copyKey: "user-message" });
  });
});

describe("castAndPlay: a refused start is not a TV that didn't answer", () => {
  it("refused-session-active is busy, not no-answer", async () => {
    const play = jest.fn();
    await expect(
      castAndPlay(tv("a"), {
        castNow: async () => "refused-session-active",
        waitForCast: async () => true,
        play,
      }),
    ).resolves.toBe("busy");
    expect(play).not.toHaveBeenCalled();
  });

  it("a timeout is no-answer", async () => {
    await expect(
      castAndPlay(tv("a"), {
        castNow: async () => "timeout",
        waitForCast: async () => true,
        play: () => {},
      }),
    ).resolves.toBe("no-answer");
  });
});

describe("createCastPrompt: one Cast at a time", () => {
  it("two taps on Cast at once run one cast and play once; both get its outcome", async () => {
    const prompt = createCastPrompt();
    prompt.ask({ game: { name: "Rocket Crew" }, phone: false, play: () => {} });
    const play = jest.fn();
    const castNow = jest.fn(async () => "started" as const);
    const tap = () =>
      prompt.confirm(() =>
        confirmCast(tv("den", "Den TV"), {
          promptId: prompt.promptId() ?? "",
          castNow,
          waitForCast: async () => true,
          play,
          log: prompt.log,
          errorText: () => "?",
        }),
      );
    await expect(Promise.all([tap(), tap()])).resolves.toEqual([null, null]);
    expect(castNow).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
  });
});

describe("createCastPrompt: shown and dismissed are logged", () => {
  const request = (name: string) => ({ game: { name }, phone: true, play: () => {} });

  it("ask logs shown with a prompt id; Not now logs dismissed with how", () => {
    const r = recorder();
    const prompt = createCastPrompt({ log: r.log });
    prompt.ask(request("Rocket Crew"));
    const id = prompt.promptId();
    expect(id).toEqual(expect.any(String));
    prompt.dismiss("not-now");
    expect(r.logged).toEqual([
      { name: "prompt.shown", data: { promptId: id, phone: true }, level: undefined },
      { name: "prompt.dismissed", data: { promptId: id, how: "not-now" }, level: undefined },
    ]);
    expect(prompt.promptId()).toBeNull();
  });

  it("each prompt has its own id", () => {
    const prompt = createCastPrompt();
    prompt.ask(request("A"));
    const first = prompt.promptId();
    prompt.dismiss();
    prompt.ask(request("B"));
    expect(prompt.promptId()).not.toBe(first);
  });

  it("closing it to play logs how (phone, played); closing a closed prompt logs nothing", () => {
    const r = recorder();
    const prompt = createCastPrompt({ log: r.log });
    prompt.ask(request("A"));
    prompt.dismiss("played");
    prompt.dismiss("not-now");
    expect(r.logged.map((l) => l.data.how)).toEqual([undefined, "played"]);
  });

  it("dismiss with no how (or a press event) counts as not-now", () => {
    const r = recorder();
    const prompt = createCastPrompt({ log: r.log });
    prompt.ask(request("A"));
    prompt.dismiss();
    expect(r.logged[1].data.how).toBe("not-now");
  });
});
