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
  const providers = {
    apple: jest.fn(async (): Promise<string | null> => "apple-id-token"),
    google: jest.fn(async (): Promise<string | null> => "google-id-token"),
  };
  const flow = createSignInFlow({ mode, app, providers });
  return { flow, app, providers };
}

describe("Back up your profile", () => {
  it("Continue with Google links the Google login to this profile", async () => {
    const { flow, app } = setup("backup");
    await flow.continueWith("google");
    expect(app.backUp).toHaveBeenCalledWith({ provider: "google", idToken: "google-id-token" });
    expect(app.signIn).not.toHaveBeenCalled();
    expect(flow.getSnapshot().step).toBe("done");
  });

  it("Continue with Apple links the Apple login", async () => {
    const { flow, app } = setup("backup");
    await flow.continueWith("apple");
    expect(app.backUp).toHaveBeenCalledWith({ provider: "apple", idToken: "apple-id-token" });
  });

  it("a cancelled provider sheet changes nothing", async () => {
    const { flow, app, providers } = setup("backup");
    providers.google.mockResolvedValueOnce(null);
    await flow.continueWith("google");
    expect(app.backUp).not.toHaveBeenCalled();
    expect(flow.getSnapshot()).toMatchObject({ step: "choose", error: null, busy: false });
  });

  it("a provider that fails says so in plain words (its error is only logged)", async () => {
    const { flow, providers } = setup("backup");
    jest.spyOn(console, "warn").mockImplementation(() => {});
    providers.google.mockRejectedValueOnce(new Error("com.apple.AuthenticationServices 1000"));
    await flow.continueWith("google");
    expect(flow.getSnapshot()).toMatchObject({
      step: "choose",
      error: "That sign-in didn't go through. Try again.",
    });
  });

  it("email: enter the address, get a code, enter the 6 digits", async () => {
    const { flow, app } = setup("backup");
    flow.chooseEmail();
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
    flow.chooseEmail();
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
    flow.chooseEmail();
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
    await flow.continueWith("google");
    expect(flow.getSnapshot()).toMatchObject({
      step: "choose",
      error: "That account already backs up another profile.",
    });
  });

  it("back goes from the code to the email, and from the email to the choices", async () => {
    const { flow } = setup("backup");
    flow.chooseEmail();
    await flow.sendCode("j@example.com");
    flow.back();
    expect(flow.getSnapshot().step).toBe("email");
    flow.back();
    expect(flow.getSnapshot().step).toBe("choose");
  });
});

describe("I already have a profile: sign in", () => {
  it("signs in (no token) and is done", async () => {
    const { flow, app } = setup("signin");
    await flow.continueWith("google");
    expect(app.signIn).toHaveBeenCalledWith({ provider: "google", idToken: "google-id-token" });
    expect(app.backUp).not.toHaveBeenCalled();
    expect(flow.getSnapshot().step).toBe("done");
  });

  it("a login no profile has offers to make a profile", async () => {
    const { flow } = setup("signin", {
      signIn: async () => ({ ok: false, reason: "login_not_found", message: "none" }),
    });
    flow.chooseEmail();
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

  it("starts on the choices, idle", () => {
    const { flow } = setup("signin");
    expect(flow.getSnapshot()).toEqual({ step: "choose", email: "", busy: false, error: null });
  });

  it("is busy while a provider sheet is up, and idle once done", async () => {
    const { flow } = setup("backup");
    const trail = busyTrail(flow);
    await flow.continueWith("apple");
    expect(trail).toEqual([true, false]);
    expect(flow.getSnapshot()).toMatchObject({ step: "done", busy: false, error: null });
  });

  it("is idle again after not_found and after a failure", async () => {
    const notFound = setup("signin", { signIn: fail("login_not_found", "x") });
    await notFound.flow.continueWith("google");
    expect(notFound.flow.getSnapshot()).toMatchObject({ step: "not_found", busy: false });
    const failed = setup("signin", { signIn: fail("network", "You're offline.") });
    await failed.flow.continueWith("google");
    expect(failed.flow.getSnapshot()).toMatchObject({
      step: "choose",
      busy: false,
      error: "You're offline.",
    });
  });

  it("a failing provider sheet is logged by name and leaves the screen idle", async () => {
    const { flow, providers } = setup("backup");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    providers.apple.mockRejectedValueOnce(new Error("boom"));
    await flow.continueWith("apple");
    expect(warn).toHaveBeenCalledWith("[ogs] apple sign-in failed: Error: boom");
    expect(flow.getSnapshot().busy).toBe(false);
    warn.mockRestore();
  });

  it("is busy while the code is sent; a failed send stays on the address with the reason", async () => {
    const { flow, app } = setup("backup");
    flow.chooseEmail();
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
    flow.chooseEmail();
    await flow.sendCode("x y@example.com");
    await flow.sendCode("me@example.com z");
    expect(app.startEmail).not.toHaveBeenCalled();
    expect(flow.getSnapshot().error).toBe("That isn't an email address.");
  });

  it("only takes exactly six digits, and is busy while verifying", async () => {
    const { flow, app } = setup("backup");
    flow.chooseEmail();
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
    flow.chooseEmail();
    expect(listener).not.toHaveBeenCalled();
  });
});
