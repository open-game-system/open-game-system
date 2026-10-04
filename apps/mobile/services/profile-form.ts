import type { HandleCheck, ProfilePatch } from "./ogs-api";

/**
 * "Make your OGS profile" (onboarding) and Edit (Profile tab): a typed name, an @id pre-filled from
 * it by GET /handles (editable, checked as typed) and a pre-picked sticker. A small external store;
 * screens read it with useSyncExternalStore.
 */

export type HandleStatus = "idle" | "checking" | "free" | "taken" | "unknown";

export interface ProfileFormState {
  name: string;
  handle: string;
  sticker: string;
  status: HandleStatus;
  /** A free @id to offer when the typed one is taken. */
  suggestion: string | null;
}

type CheckHandle = (q: { name: string } | { handle: string }) => Promise<HandleCheck>;

/** What an @id may contain: no "@", lowercase a-z, 0-9, "." and "_". */
export function normaliseHandle(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9._]/g, "");
}

export function handleStatusText(s: Pick<ProfileFormState, "status" | "suggestion">): string {
  switch (s.status) {
    case "free":
      return "free";
    case "taken":
      return s.suggestion ? `taken · try @${s.suggestion}` : "taken";
    case "checking":
      return "checking…";
    default:
      return "";
  }
}

export const DEFAULT_STICKER = "bear";

export function createProfileForm(opts: {
  checkHandle: CheckHandle;
  /** Edit: the current profile (its @id counts as the user's own choice). */
  initial?: { name: string; handle: string; sticker: string };
  debounceMs?: number;
}) {
  const initial = opts.initial;
  const debounceMs = opts.debounceMs ?? 300;
  let state: ProfileFormState = initial
    ? { ...initial, status: "free", suggestion: null }
    : { name: "", handle: "", sticker: DEFAULT_STICKER, status: "idle", suggestion: null };
  /** True once the @id is the user's (typed, or the profile's own): the name no longer fills it. */
  let handleEdited = !!initial;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  const listeners = new Set<() => void>();
  const set = (patch: Partial<ProfileFormState>) => {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  };

  function schedule(q: { name: string } | { handle: string }) {
    if (timer) clearTimeout(timer);
    const mine = ++seq;
    set({ status: "checking", suggestion: null });
    timer = setTimeout(() => {
      timer = null;
      opts.checkHandle(q).then(
        (r) => {
          if (mine !== seq) return;
          if ("name" in q)
            set({ handle: r.available ? r.handle : r.suggestion, status: "free", suggestion: null });
          else if (r.available) set({ status: "free", suggestion: null });
          else set({ status: "taken", suggestion: r.suggestion });
        },
        () => {
          if (mine === seq) set({ status: "unknown", suggestion: null });
        },
      );
    }, debounceMs);
  }

  function cancel(status: HandleStatus) {
    if (timer) clearTimeout(timer);
    timer = null;
    seq++;
    set({ status, suggestion: null });
  }

  return {
    getSnapshot: (): ProfileFormState => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setName(name: string) {
      set({ name });
      if (handleEdited) return;
      if (name.trim()) schedule({ name: name.trim() });
      else {
        set({ handle: "" });
        cancel("idle");
      }
    },
    setHandle(text: string) {
      const handle = normaliseHandle(text);
      handleEdited = true;
      set({ handle });
      if (initial && handle === initial.handle) cancel("free");
      else if (handle) schedule({ handle });
      else cancel("idle");
    },
    useSuggestion() {
      if (!state.suggestion) return;
      handleEdited = true;
      set({ handle: state.suggestion });
      cancel("free");
    },
    setSticker(sticker: string) {
      set({ sticker });
    },
    /** The server said the @id is taken (someone got it first): offer its suggestion. */
    taken(suggestion: string) {
      cancel("taken");
      set({ suggestion });
    },
    canSubmit(): boolean {
      return !!state.name.trim() && state.status !== "checking" && state.status !== "taken";
    },
    /** What POST /profiles takes (no @id yet: the server makes one from the name). */
    values(): { name: string; handle?: string; sticker: string } {
      const name = state.name.trim();
      return state.handle
        ? { name, handle: state.handle, sticker: state.sticker }
        : { name, sticker: state.sticker };
    },
    /** Edit: only what changed, for PATCH /me. */
    changes(): ProfilePatch {
      const patch: ProfilePatch = {};
      const v = this.values();
      if (!initial) return v;
      if (v.name !== initial.name) patch.name = v.name;
      if (v.handle && v.handle !== initial.handle) patch.handle = v.handle;
      if (v.sticker !== initial.sticker) patch.sticker = v.sticker;
      return patch;
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      seq++;
    },
  };
}

export type ProfileForm = ReturnType<typeof createProfileForm>;
