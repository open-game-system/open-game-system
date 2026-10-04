import type { Credential } from "../ogs-api";
import { createSignInFlow, type SignInMode } from "../sign-in-flow";

type R = { ok: true } | { ok: false; reason: string; message: string };

function setup(mode: SignInMode, over: Partial<Record<"backUp" | "signIn", (c: Credential) => Promise<R>>> = {}) {
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

  it("a provider that fails says why", async () => {
    const { flow, providers } = setup("backup");
    providers.google.mockRejectedValueOnce(new Error("Google said no"));
    await flow.continueWith("google");
    expect(flow.getSnapshot()).toMatchObject({ step: "choose", error: "Google said no" });
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
    expect(flow.getSnapshot()).toMatchObject({ step: "email", error: "That isn't an email address." });
    await flow.sendCode("j@example.com");
    await flow.verify("123");
    expect(flow.getSnapshot().error).toBe("The code is 6 digits.");
    expect(app.backUp).not.toHaveBeenCalled();
    expect(app.startEmail).toHaveBeenCalledTimes(1);
  });

  it("a wrong code is refused and the code can be typed again", async () => {
    const { flow } = setup("backup", {
      backUp: async () => ({ ok: false, reason: "invalid_code", message: "bad" }),
    });
    flow.chooseEmail();
    await flow.sendCode("j@example.com");
    await flow.verify("000000");
    expect(flow.getSnapshot()).toMatchObject({
      step: "code",
      error: "That code didn't work. Check the email, or send a new one.",
    });
  });

  it("a login that backs up another profile is refused (login_in_use)", async () => {
    const { flow } = setup("backup", {
      backUp: async () => ({ ok: false, reason: "login_in_use", message: "in use" }),
    });
    await flow.continueWith("google");
    expect(flow.getSnapshot()).toMatchObject({
      step: "choose",
      error: "That login already backs up another OGS profile.",
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
