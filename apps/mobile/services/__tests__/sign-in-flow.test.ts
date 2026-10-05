import type { Credential } from "../ogs-api";
import { createSignInFlow, type SignInMode } from "../sign-in-flow";

type R = { ok: true } | { ok: false; reason: string; message: string };

function setup(
  mode: SignInMode,
  over: Partial<Record<"backUp" | "signIn", (c: Credential) => Promise<R>>> = {},
) {
  const app = {
    startEmail: jest.fn(async (_e: string): Promise<R> => ({ ok: true })),
    backUp: jest.fn(over.backUp ?? (async (_c: Credential): Promise<R> => ({ ok: true }))),
    signIn: jest.fn(over.signIn ?? (async (_c: Credential): Promise<R> => ({ ok: true }))),
  };
  const flow = createSignInFlow({ mode, app });
  return { flow, app };
}

/** Email and code in, ready for the result. */
async function throughCode(flow: ReturnType<typeof setup>["flow"], email = "j@example.com") {
  await flow.sendCode(email);
  await flow.verify("123456");
}

describe("Back up your profile", () => {
  it("email: enter the address, get a code, enter the 6 digits", async () => {
    const { flow, app } = setup("backup");
    expect(flow.getSnapshot().step).toBe("email");
    await flow.sendCode(" jonathan@example.com ");
    expect(app.startEmail).toHaveBeenCalledWith("jonathan@example.com");
    expect(flow.getSnapshot()).toMatchObject({ step: "code", email: "jonathan@example.com" });
    await flow.verify("123 456");
    expect(app.backUp).toHaveBeenCalledWith({
      provider: "email",
      email: "jonathan@example.com",
      code: "123456",
    });
    expect(flow.getSnapshot().step).toBe("done");
  });

  it("refuses an address that isn't one, and a code that isn't 6 digits, without calling OGS", async () => {
    const { flow, app } = setup("backup");
    await flow.sendCode("jonathan");
    expect(flow.getSnapshot()).toMatchObject({
      step: "email",
      error: "That isn't an email address.",
    });
    await flow.sendCode("j@example.com");
    await flow.verify("123");
    expect(flow.getSnapshot().error).toBe("The code is 6 digits.");
    expect(app.backUp).not.toHaveBeenCalled();
    expect(app.startEmail).toHaveBeenCalledTimes(1);
  });

  it("a wrong code is refused and the code can be typed again", async () => {
    const { flow } = setup("backup", {
      backUp: async () => ({
        ok: false,
        reason: "invalid_code",
        message: "That code didn't work. Check it or send a new one.",
      }),
    });
    await flow.sendCode("j@example.com");
    await flow.verify("000000");
    expect(flow.getSnapshot()).toMatchObject({
      step: "code",
      error: "That code didn't work. Check it or send a new one.",
    });
  });

  it("a login that backs up another profile is refused (login_in_use)", async () => {
    const { flow } = setup("backup", {
      backUp: async () => ({
        ok: false,
        reason: "login_in_use",
        message: "That account already backs up another profile.",
      }),
    });
    await throughCode(flow);
    expect(flow.getSnapshot()).toMatchObject({
      step: "code",
      error: "That account already backs up another profile.",
    });
  });

  it("back goes from the code to the email, which is where it starts", async () => {
    const { flow } = setup("backup");
    await flow.sendCode("j@example.com");
    flow.back();
    expect(flow.getSnapshot()).toMatchObject({ step: "email", error: null });
  });
});

describe("I already have a profile: sign in", () => {
  it("signs in (no token) and is done", async () => {
    const { flow, app } = setup("signin");
    await throughCode(flow);
    expect(app.signIn).toHaveBeenCalledWith({
      provider: "email",
      email: "j@example.com",
      code: "123456",
    });
    expect(app.backUp).not.toHaveBeenCalled();
    expect(flow.getSnapshot().step).toBe("done");
  });

  it("a login no profile has offers to make a profile", async () => {
    const { flow } = setup("signin", {
      signIn: async () => ({ ok: false, reason: "login_not_found", message: "none" }),
    });
    await flow.sendCode("new@example.com");
    await flow.verify("123456");
    expect(flow.getSnapshot()).toMatchObject({ step: "not_found", error: null });
  });
});

describe("sign-in flow: busy and the edges", () => {
  /** Records `busy` each time the screen is told to re-read. */
  function busyTrail(flow: ReturnType<typeof setup>["flow"]) {
    const trail: boolean[] = [];
    flow.subscribe(() => trail.push(flow.getSnapshot().busy));
    return trail;
  }
  const fail = (reason: string, message: string) => async (): Promise<R> => ({
    ok: false,
    reason,
    message,
  });

  it("starts on the email address (email is the only way in), idle", () => {
    const { flow } = setup("signin");
    expect(flow.getSnapshot()).toEqual({ step: "email", email: "", busy: false, error: null });
  });

  it("is idle again after not_found and after a failure", async () => {
    const notFound = setup("signin", { signIn: fail("login_not_found", "x") });
    await throughCode(notFound.flow);
    expect(notFound.flow.getSnapshot()).toMatchObject({ step: "not_found", busy: false });
    const failed = setup("signin", { signIn: fail("network", "You're offline.") });
    await throughCode(failed.flow);
    expect(failed.flow.getSnapshot()).toMatchObject({
      step: "code",
      busy: false,
      error: "You're offline.",
    });
  });

  it("is busy while the code is sent; a failed send stays on the address with the reason", async () => {
    const { flow, app } = setup("backup");
    const trail = busyTrail(flow);
    await flow.sendCode("me@example.com");
    expect(trail).toEqual([true, false]);
    expect(flow.getSnapshot()).toMatchObject({ step: "code", email: "me@example.com" });
    app.startEmail.mockImplementationOnce(fail("rate_limited", "Wait a minute."));
    flow.back();
    await flow.sendCode("me@example.com");
    expect(flow.getSnapshot()).toMatchObject({
      step: "email",
      busy: false,
      error: "Wait a minute.",
    });
  });

  it("only takes a whole email address", async () => {
    const { flow, app } = setup("backup");
    await flow.sendCode("x y@example.com");
    await flow.sendCode("me@example.com z");
    expect(app.startEmail).not.toHaveBeenCalled();
    expect(flow.getSnapshot().error).toBe("That isn't an email address.");
  });

  it("only takes exactly six digits, and is busy while verifying", async () => {
    const { flow, app } = setup("backup");
    await flow.sendCode("me@example.com");
    await flow.verify("1234567");
    await flow.verify("x123456");
    expect(app.backUp).not.toHaveBeenCalled();
    expect(flow.getSnapshot().error).toBe("The code is 6 digits.");
    const trail = busyTrail(flow);
    await flow.verify("123 456");
    expect(trail).toEqual([true, false]);
    expect(app.backUp).toHaveBeenCalledWith({
      provider: "email",
      email: "me@example.com",
      code: "123456",
    });
  });

  it("stops notifying a screen that unsubscribed", () => {
    const { flow } = setup("backup");
    const listener = jest.fn();
    const off = flow.subscribe(listener);
    off();
    flow.back();
    expect(listener).not.toHaveBeenCalled();
  });
});
