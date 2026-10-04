import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { googleIdToken } from "../google-sign-in";
import { appleAvailable, appleIdToken, googleSignIn, providers } from "../sign-in-providers";

jest.mock("expo-apple-authentication", () => ({
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  CryptoEncoding: { BASE64: "base64" },
}));
jest.mock("expo-web-browser", () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock("../google-sign-in", () => ({ googleIdToken: jest.fn() }));

const signInAsync = jest.mocked(AppleAuthentication.signInAsync);
const isAvailableAsync = jest.mocked(AppleAuthentication.isAvailableAsync);

describe("appleIdToken", () => {
  beforeEach(() => jest.clearAllMocks());

  it("asks for email and name and resolves the identity token", async () => {
    signInAsync.mockResolvedValue({
      identityToken: "apple.jwt",
      user: "u",
      state: null,
      fullName: null,
      email: null,
      realUserStatus: 1,
      authorizationCode: null,
    });
    await expect(appleIdToken()).resolves.toBe("apple.jwt");
    expect(signInAsync).toHaveBeenCalledWith({ requestedScopes: [1, 0] });
  });

  it("resolves null when the person closes the sheet", async () => {
    signInAsync.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_REQUEST_CANCELED" }),
    );
    await expect(appleIdToken()).resolves.toBeNull();
  });

  it.each([
    ["another coded error", Object.assign(new Error("boom"), { code: "ERR_INVALID_RESPONSE" })],
    ["an error without a code", new Error("boom")],
    ["a thrown string", "boom"],
    ["a thrown null", null],
  ])("rethrows %s", async (_label, err) => {
    signInAsync.mockRejectedValue(err);
    await expect(appleIdToken()).rejects.toBe(err);
  });
});

describe("appleAvailable", () => {
  const realOS = Platform.OS;
  afterEach(() => {
    Platform.OS = realOS;
  });

  it("asks the system on iOS, treating a failure as unavailable", async () => {
    Platform.OS = "ios";
    isAvailableAsync.mockResolvedValueOnce(true);
    await expect(appleAvailable()).resolves.toBe(true);
    isAvailableAsync.mockRejectedValueOnce(new Error("no"));
    await expect(appleAvailable()).resolves.toBe(false);
  });

  it("is unavailable off iOS without asking", async () => {
    Platform.OS = "android";
    isAvailableAsync.mockClear();
    await expect(appleAvailable()).resolves.toBe(false);
    expect(isAvailableAsync).not.toHaveBeenCalled();
  });
});

describe("googleSignIn", () => {
  it("wires the ephemeral browser, fetch, a dashless nonce and a base64url SHA-256", async () => {
    jest.mocked(googleIdToken).mockResolvedValue("google.jwt");
    await expect(googleSignIn()).resolves.toBe("google.jwt");
    const deps = jest.mocked(googleIdToken).mock.calls[0][1];

    deps.openAuthSession("https://auth", "opengame:/cb");
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith("https://auth", "opengame:/cb", {
      preferEphemeralSession: true,
    });

    jest.mocked(Crypto.randomUUID).mockReturnValue("ab-cd-ef");
    expect(deps.random()).toBe("abcdef");

    jest.mocked(Crypto.digestStringAsync).mockResolvedValue("a+b/c==");
    await expect(deps.sha256Base64Url("verifier")).resolves.toBe("a-b_c");
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith("SHA-256", "verifier", {
      encoding: "base64",
    });

    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    await deps.fetch("https://token", { method: "POST" });
    expect(fetchSpy).toHaveBeenCalledWith("https://token", { method: "POST" });
    fetchSpy.mockRestore();
  });

  it("is the google provider", () => {
    expect(providers).toEqual({ apple: appleIdToken, google: googleSignIn });
  });
});
