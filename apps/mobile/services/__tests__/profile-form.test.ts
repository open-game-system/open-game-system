import { createProfileForm, handleStatusText, normaliseHandle } from "../profile-form";

type Q = { name: string } | { handle: string };

function setup(
  answer: (q: Q) => { handle: string; available: boolean; suggestion: string } = (q) =>
    "name" in q
      ? { handle: "jonathan.m", available: true, suggestion: "jonathan.m" }
      : { handle: q.handle, available: q.handle !== "taken", suggestion: `${q.handle}2` },
  initial?: { name: string; handle: string; sticker: string },
) {
  const checkHandle = jest.fn(async (q: Q) => answer(q));
  const form = createProfileForm({ checkHandle, initial, debounceMs: 200 });
  return { form, checkHandle };
}

const settle = async () => {
  jest.advanceTimersByTime(250);
  for (let i = 0; i < 3; i++) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("Make your OGS profile: the form", () => {
  it("starts empty with the bear sticker pre-picked", () => {
    const { form } = setup();
    expect(form.getSnapshot()).toMatchObject({ name: "", handle: "", sticker: "bear" });
    expect(form.canSubmit()).toBe(false);
  });

  it("pre-fills the @id from the typed name, once typing pauses", async () => {
    const { form, checkHandle } = setup();
    form.setName("J");
    form.setName("Jonathan Mumm");
    await settle();
    expect(checkHandle).toHaveBeenCalledTimes(1);
    expect(checkHandle).toHaveBeenCalledWith({ name: "Jonathan Mumm" });
    expect(form.getSnapshot()).toMatchObject({ handle: "jonathan.m", status: "free" });
    expect(form.canSubmit()).toBe(true);
  });

  it("a name whose @id is taken pre-fills the free suggestion", async () => {
    const { form } = setup(() => ({
      handle: "jonathan.m",
      available: false,
      suggestion: "jonathan.m2",
    }));
    form.setName("Jonathan Mumm");
    await settle();
    expect(form.getSnapshot()).toMatchObject({ handle: "jonathan.m2", status: "free" });
  });

  it("an edited @id is checked, and stays the user's even when the name changes", async () => {
    const { form, checkHandle } = setup();
    form.setName("Jonathan");
    await settle();
    form.setHandle("@Jonny");
    await settle();
    expect(checkHandle).toHaveBeenLastCalledWith({ handle: "jonny" });
    expect(form.getSnapshot()).toMatchObject({ handle: "jonny", status: "free" });
    form.setName("Jon");
    await settle();
    expect(form.getSnapshot().handle).toBe("jonny");
  });

  it("a taken @id says so, offers the suggestion and blocks Next until changed", async () => {
    const { form } = setup();
    form.setName("Jonathan");
    form.setHandle("taken");
    await settle();
    expect(form.getSnapshot()).toMatchObject({ status: "taken", suggestion: "taken2" });
    expect(form.canSubmit()).toBe(false);
    form.useSuggestion();
    expect(form.getSnapshot()).toMatchObject({ handle: "taken2", status: "free" });
    expect(form.canSubmit()).toBe(true);
  });

  it("a server answer of handle_taken (a race) marks it taken with the suggestion", () => {
    const { form } = setup();
    form.setName("Jonathan");
    form.taken("jonathan.m3");
    expect(form.getSnapshot()).toMatchObject({ status: "taken", suggestion: "jonathan.m3" });
  });

  it("ignores a stale answer for an older name", async () => {
    let resolveFirst: (v: { handle: string; available: boolean; suggestion: string }) => void =
      () => {};
    const checkHandle = jest
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockImplementationOnce(async () => ({
        handle: "juneau",
        available: true,
        suggestion: "juneau",
      }));
    const form = createProfileForm({ checkHandle, debounceMs: 200 });
    form.setName("Jonathan");
    await settle();
    form.setName("Juneau");
    await settle();
    resolveFirst({ handle: "jonathan", available: true, suggestion: "jonathan" });
    await settle();
    expect(form.getSnapshot().handle).toBe("juneau");
  });

  it("the sticker can be changed", () => {
    const { form } = setup();
    form.setSticker("owl");
    expect(form.getSnapshot().sticker).toBe("owl");
  });

  it("can't check the @id (offline): Next still works, the server decides", async () => {
    const checkHandle = jest.fn(async () => {
      throw new Error("offline");
    });
    const form = createProfileForm({ checkHandle, debounceMs: 200 });
    form.setName("Juneau");
    await settle();
    expect(form.getSnapshot().status).toBe("unknown");
    expect(form.canSubmit()).toBe(true);
    expect(form.values()).toEqual({ name: "Juneau", sticker: "bear" });
  });

  it("submits the trimmed name, the @id and the sticker", async () => {
    const { form } = setup();
    form.setName("  Jonathan Mumm ");
    await settle();
    form.setSticker("owl");
    expect(form.values()).toEqual({ name: "Jonathan Mumm", handle: "jonathan.m", sticker: "owl" });
  });
});

describe("Edit: the form starts from the profile", () => {
  const initial = { name: "Jonathan", handle: "jonathan.m", sticker: "bear" };

  it("keeps the @id when only the name changes", async () => {
    const { form, checkHandle } = setup(undefined, initial);
    expect(form.getSnapshot()).toMatchObject({ ...initial, status: "free" });
    form.setName("Jon");
    await settle();
    expect(checkHandle).not.toHaveBeenCalled();
    expect(form.changes()).toEqual({ name: "Jon" });
  });

  it("returns only what changed", async () => {
    const { form } = setup(undefined, initial);
    form.setHandle("jonny");
    await settle();
    form.setSticker("owl");
    expect(form.changes()).toEqual({ handle: "jonny", sticker: "owl" });
  });

  it("going back to the profile's own @id needs no check", async () => {
    const { form, checkHandle } = setup(undefined, initial);
    form.setHandle("jonny");
    form.setHandle("jonathan.m");
    await settle();
    expect(checkHandle).not.toHaveBeenCalled();
    expect(form.getSnapshot().status).toBe("free");
  });
});

describe("@id text", () => {
  it("normalises what's typed: no @, lowercase, only a-z 0-9 . _", () => {
    expect(normaliseHandle("@Jonny B!")).toBe("jonnyb");
    expect(normaliseHandle("juneau.m_2")).toBe("juneau.m_2");
  });

  it("says free, taken (with the suggestion) or checking", () => {
    expect(handleStatusText({ status: "free", suggestion: null })).toBe("free");
    expect(handleStatusText({ status: "taken", suggestion: "jonathan.m2" })).toBe(
      "taken · try @jonathan.m2",
    );
    expect(handleStatusText({ status: "checking", suggestion: null })).toBe("checking…");
    expect(handleStatusText({ status: "idle", suggestion: null })).toBe("");
    expect(handleStatusText({ status: "unknown", suggestion: null })).toBe("");
  });
});
