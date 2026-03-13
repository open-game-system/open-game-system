import {
  setGameUrl,
  consumePendingGameUrl,
  subscribeToGameUrl,
} from "../game-url-store";

// Reset module state between tests
beforeEach(() => {
  // Consume any leftover pending URL
  consumePendingGameUrl();
  // We can't easily reset listeners, but each test manages its own
});

describe("game-url-store", () => {
  describe("setGameUrl", () => {
    it("stores the URL as pending and logs it", () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation();
      setGameUrl("https://triviajam.tv/games/abc123");
      expect(consumePendingGameUrl()).toBe("https://triviajam.tv/games/abc123");
      expect(logSpy).toHaveBeenCalledWith(
        "[GameUrlStore] Setting game URL:",
        "https://triviajam.tv/games/abc123"
      );
      logSpy.mockRestore();
    });

    it("notifies all subscribers", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const unsub1 = subscribeToGameUrl(listener1);
      const unsub2 = subscribeToGameUrl(listener2);

      setGameUrl("https://triviajam.tv/games/xyz");

      expect(listener1).toHaveBeenCalledWith("https://triviajam.tv/games/xyz");
      expect(listener2).toHaveBeenCalledWith("https://triviajam.tv/games/xyz");

      unsub1();
      unsub2();
    });

    it("overwrites previous pending URL", () => {
      setGameUrl("https://first.com");
      setGameUrl("https://second.com");
      expect(consumePendingGameUrl()).toBe("https://second.com");
    });
  });

  describe("consumePendingGameUrl", () => {
    it("returns null when no URL is pending", () => {
      expect(consumePendingGameUrl()).toBeNull();
    });

    it("clears the pending URL after consumption", () => {
      setGameUrl("https://triviajam.tv/games/abc123");
      consumePendingGameUrl();
      expect(consumePendingGameUrl()).toBeNull();
    });
  });

  describe("subscribeToGameUrl", () => {
    it("returns an unsubscribe function", () => {
      const listener = jest.fn();
      const unsubscribe = subscribeToGameUrl(listener);

      setGameUrl("https://triviajam.tv/games/before");
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      setGameUrl("https://triviajam.tv/games/after");
      expect(listener).toHaveBeenCalledTimes(1); // not called again
    });

    it("does not affect other subscribers when one unsubscribes", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const unsub1 = subscribeToGameUrl(listener1);
      const unsub2 = subscribeToGameUrl(listener2);

      unsub1();

      setGameUrl("https://triviajam.tv/games/test");
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith("https://triviajam.tv/games/test");

      unsub2();
    });
  });
});
