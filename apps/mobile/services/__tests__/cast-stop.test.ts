import { createCastStop, tvTabShows } from "../cast-stop";

/**
 * Stop casting is confirmed: the TV tab says "Stopped casting on <TV>" at once, not after the stop
 * finishes its round trip (the receiver closes at once; its reply can take seconds).
 */
function deferred<T>() {
  let resolve: (v: T) => void = () => {};
  let reject: (e: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("the TV tab while Stop casting runs", () => {
  it("shows the remote while cast, and the Cast screen once a stop is asked for", () => {
    expect(tvTabShows({ ogsCast: true, stopping: false })).toBe("remote");
    expect(tvTabShows({ ogsCast: true, stopping: true })).toBe("not-cast");
    expect(tvTabShows({ ogsCast: false, stopping: false })).toBe("not-cast");
    expect(tvTabShows({ ogsCast: false, stopping: true })).toBe("not-cast");
  });

  it("is stopping the moment Stop casting is confirmed, before the stop finishes", () => {
    let cast = true;
    const stop = createCastStop({ isCast: () => cast });
    const run = deferred<"stopped" | "failed">();
    const seen: boolean[] = [];
    stop.subscribe(() => seen.push(stop.isStopping()));
    void stop.stop(() => run.promise);
    expect(stop.isStopping()).toBe(true);
    expect(seen).toEqual([true]);
    cast = false;
    stop.castChanged();
    expect(stop.isStopping()).toBe(false);
  });

  it("stays stopping after the stop if the cast has not caught up yet (no flash of the remote)", async () => {
    let cast = true;
    const stop = createCastStop({ isCast: () => cast });
    await stop.stop(async () => "stopped");
    expect(stop.isStopping()).toBe(true);
    stop.castChanged();
    expect(stop.isStopping()).toBe(true);
    cast = false;
    stop.castChanged();
    expect(stop.isStopping()).toBe(false);
  });

  it("is done once the stop finishes with the cast already gone", async () => {
    let cast = true;
    const stop = createCastStop({ isCast: () => cast });
    await stop.stop(async () => {
      cast = false;
      return "stopped";
    });
    expect(stop.isStopping()).toBe(false);
  });

  it("brings the remote back when the stop fails (the TV is still cast)", async () => {
    const stop = createCastStop({ isCast: () => true });
    await stop.stop(async () => "failed");
    expect(stop.isStopping()).toBe(false);
  });

  it("brings the remote back when the stop throws", async () => {
    const stop = createCastStop({ isCast: () => true });
    await expect(
      stop.stop(async () => {
        throw new Error("offline");
      }),
    ).resolves.toBe("failed");
    expect(stop.isStopping()).toBe(false);
  });

  it("a second confirm while stopping does not stop twice", async () => {
    const stop = createCastStop({ isCast: () => true });
    const run = deferred<"stopped" | "failed">();
    const runs = jest.fn(() => run.promise);
    void stop.stop(runs);
    void stop.stop(runs);
    expect(runs).toHaveBeenCalledTimes(1);
  });

  it("casting again clears it", async () => {
    const stop = createCastStop({ isCast: () => true });
    await stop.stop(async () => "stopped");
    const seen: boolean[] = [];
    stop.subscribe(() => seen.push(stop.isStopping()));
    stop.reset();
    expect(stop.isStopping()).toBe(false);
    expect(seen).toEqual([false]);
    stop.reset();
    expect(seen).toEqual([false]);
  });

  it("unsubscribes", () => {
    const stop = createCastStop({ isCast: () => true });
    const l = jest.fn();
    const off = stop.subscribe(l);
    off();
    void stop.stop(async () => "stopped");
    expect(l).not.toHaveBeenCalled();
  });
});
