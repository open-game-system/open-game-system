import { applyWaitingUpdate, type OtaDeps } from "../ota";

/** docs/acceptance/2026-10-07-beta-distribution.feature: over-the-air updates on resume. */
function deps(over: Partial<OtaDeps> = {}) {
  const calls: string[] = [];
  const d: OtaDeps = {
    isEnabled: true,
    check: async () => {
      calls.push("check");
      return { isAvailable: true };
    },
    fetch: async () => {
      calls.push("fetch");
      return { isNew: true };
    },
    reload: async () => {
      calls.push("reload");
    },
    isCasting: () => false,
    ...over,
  };
  return { d, calls };
}

describe("applyWaitingUpdate", () => {
  it("downloads a new update and restarts on it", async () => {
    const { d, calls } = deps();
    expect(await applyWaitingUpdate(d)).toBe("reloaded");
    expect(calls).toEqual(["check", "fetch", "reload"]);
  });

  it("does nothing when there is no update", async () => {
    const { d, calls } = deps({
      check: async () => {
        calls.push("check");
        return { isAvailable: false };
      },
    });
    expect(await applyWaitingUpdate(d)).toBe("none");
    expect(calls).toEqual(["check"]);
  });

  it("does not restart when the download turns out not to be new", async () => {
    const { d, calls } = deps({
      fetch: async () => {
        calls.push("fetch");
        return { isNew: false };
      },
    });
    expect(await applyWaitingUpdate(d)).toBe("none");
    expect(calls).toEqual(["check", "fetch"]);
  });

  it("keeps the update for the next launch while a cast is connected", async () => {
    const { d, calls } = deps({ isCasting: () => true });
    expect(await applyWaitingUpdate(d)).toBe("deferred");
    expect(calls).toEqual(["check", "fetch"]);
  });

  it("asks whether a cast is connected after the download, not before", async () => {
    let casting = false;
    const { d, calls } = deps({
      fetch: async () => {
        calls.push("fetch");
        casting = true;
        return { isNew: true };
      },
      isCasting: () => casting,
    });
    expect(await applyWaitingUpdate(d)).toBe("deferred");
    expect(calls).not.toContain("reload");
  });

  it("does nothing where updates are off (development builds)", async () => {
    const { d, calls } = deps({ isEnabled: false });
    expect(await applyWaitingUpdate(d)).toBe("disabled");
    expect(calls).toEqual([]);
  });

  it("never throws: a failed check, download or restart is 'none'", async () => {
    const fail = async () => {
      throw new Error("offline");
    };
    expect(await applyWaitingUpdate(deps({ check: fail }).d)).toBe("none");
    expect(await applyWaitingUpdate(deps({ fetch: fail }).d)).toBe("none");
    expect(await applyWaitingUpdate(deps({ reload: fail }).d)).toBe("none");
  });
});
