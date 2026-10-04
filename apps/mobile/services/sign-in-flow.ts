import type { Credential } from "./ogs-api";

/**
 * The "Back up your profile" / "Sign in" screen (spec ogs-profiles, 1 · 04): Continue with Apple,
 * Google or email (address → 6-digit code). Back up links the login to this device's profile;
 * sign in takes the profile that has it (onboarding's "I already have a profile").
 */

export type SignInMode = "backup" | "signin";
export type SignInStep = "choose" | "email" | "code" | "done" | "not_found";

export interface SignInState {
  step: SignInStep;
  email: string;
  busy: boolean;
  error: string | null;
}

/** app-state's answers: `message` is already the human copy (services/user-message). */
type Result = { ok: true } | { ok: false; reason: string; message: string };

export interface SignInDeps {
  mode: SignInMode;
  app: {
    startEmail(email: string): Promise<Result>;
    backUp(c: Credential): Promise<Result>;
    signIn(c: Credential): Promise<Result>;
  };
  /** Each opens the provider's sheet and resolves its ID token, or null when cancelled. */
  providers: { apple(): Promise<string | null>; google(): Promise<string | null> };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A provider sheet that failed (not cancelled): its own error is logged, not shown. */
const PROVIDER_FAILED = "That sign-in didn't go through. Try again.";

export function createSignInFlow(deps: SignInDeps) {
  let state: SignInState = { step: "choose", email: "", busy: false, error: null };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<SignInState>) => {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  };

  async function finish(credential: Credential, from: SignInStep) {
    const result =
      deps.mode === "backup"
        ? await deps.app.backUp(credential)
        : await deps.app.signIn(credential);
    if (result.ok) set({ step: "done", busy: false, error: null });
    else if (result.reason === "login_not_found")
      set({ step: "not_found", busy: false, error: null });
    else set({ step: from, busy: false, error: result.message });
  }

  return {
    getSnapshot: (): SignInState => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async continueWith(provider: "apple" | "google") {
      set({ busy: true, error: null });
      let idToken: string | null;
      try {
        idToken = await deps.providers[provider]();
      } catch (err) {
        console.warn(`[ogs] ${provider} sign-in failed: ${String(err)}`);
        set({ busy: false, error: PROVIDER_FAILED });
        return;
      }
      if (!idToken) {
        set({ busy: false });
        return;
      }
      await finish({ provider, idToken }, "choose");
    },
    chooseEmail() {
      set({ step: "email", error: null });
    },
    async sendCode(text: string) {
      const email = text.trim();
      if (!EMAIL.test(email)) {
        set({ error: "That isn't an email address." });
        return;
      }
      set({ busy: true, error: null, email });
      const result = await deps.app.startEmail(email);
      if (result.ok) set({ step: "code", busy: false });
      else set({ busy: false, error: result.message });
    },
    async verify(text: string) {
      const code = text.replace(/\s/g, "");
      if (!/^\d{6}$/.test(code)) {
        set({ error: "The code is 6 digits." });
        return;
      }
      set({ busy: true, error: null });
      await finish({ provider: "email", email: state.email, code }, "code");
    },
    back() {
      if (state.step === "code") set({ step: "email", error: null });
      else set({ step: "choose", error: null });
    },
  };
}

export type SignInFlow = ReturnType<typeof createSignInFlow>;
