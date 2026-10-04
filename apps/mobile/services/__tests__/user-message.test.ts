import { OgsApiError } from "../ogs-api";
import { userMessage } from "../user-message";

const api = (code: string, status: number) =>
  new OgsApiError(code, `raw ${code} ${status}`, status);

beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe("userMessage: what people read when something fails", () => {
  it("unreachable OGS: check the Wi-Fi, Try again", () => {
    expect(userMessage(api("OFFLINE", 0), "cast")).toEqual({
      text: "Can't reach OGS. Check your Wi-Fi and try again.",
      action: "retry",
    });
    expect(userMessage(new TypeError("Network request failed"), "load").action).toBe("retry");
  });

  it("a token OGS no longer takes: signed out, Sign in again", () => {
    for (const code of [
      "invalid_token",
      "invalid_auth",
      "missing_auth",
      "profile_not_found",
      "NO_PROFILE",
    ])
      expect(userMessage(api(code, 401), "load")).toEqual({
        text: "You've been signed out. Sign in again.",
        action: "sign-in",
      });
  });

  it("an unknown route or answer (app older than OGS): update the app", () => {
    const update = {
      text: "This version of OGS is out of date. Update the app.",
      action: "update",
    };
    expect(userMessage(api("HTTP_404", 404), "cast")).toEqual(update);
    expect(userMessage(api("not_found", 404), "cast")).toEqual(update);
    expect(userMessage(api("BAD_RESPONSE", 0), "load")).toEqual(update);
  });

  it("OGS failing: try again in a minute", () => {
    expect(userMessage(api("HTTP_502", 502), "cast")).toEqual({
      text: "OGS is having trouble. Try again in a minute.",
      action: "retry",
    });
    expect(userMessage(api("internal", 500), "load").action).toBe("retry");
  });

  it("form answers get their own words", () => {
    expect(userMessage(api("handle_taken", 409), "profile")).toEqual({
      text: "That id is taken.",
      action: "use-suggestion",
    });
    expect(userMessage(api("invalid_code", 401), "sign-in")).toEqual({
      text: "That code didn't work. Check it or send a new one.",
      action: null,
    });
    expect(userMessage(api("login_not_found", 404), "sign-in")).toEqual({
      text: "No OGS profile has that login yet.",
      action: "make-profile",
    });
    expect(userMessage(api("login_in_use", 409), "back-up")).toEqual({
      text: "That account already backs up another profile.",
      action: null,
    });
    expect(userMessage(api("session_not_found", 404), "join")).toEqual({
      text: "No TV has that code.",
      action: null,
    });
    expect(userMessage(api("invalid_id_token", 401), "sign-in")).toEqual({
      text: "That sign-in didn't go through. Try again.",
      action: "retry",
    });
  });

  it("never shows a status code or an internal code, and logs them", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { text } = userMessage(api("weird_thing", 418), "cast");
    expect(text).toBe("Something went wrong. Try again.");
    expect(text).not.toMatch(/418|weird/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("weird_thing"));
  });

  it("a plain error that isn't the network is still human", () => {
    expect(userMessage(new Error("boom"), "cast").text).toBe("Something went wrong. Try again.");
  });
});
