import { describe, expect, it } from "vitest";
import { deployedUrl, withDeploy } from "./deploy-output";

describe("deployedUrl", () => {
  it("finds the https target of the deploy line", () => {
    const out = [
      JSON.stringify({ version: 1, type: "wrangler-session" }),
      JSON.stringify({ type: "deploy", targets: ["https://my-game-preview.someone.workers.dev/"] }),
    ].join("\n");
    expect(deployedUrl(out)).toBe("https://my-game-preview.someone.workers.dev");
  });

  it("is null without a deploy line or a URL", () => {
    expect(deployedUrl("")).toBeNull();
    expect(deployedUrl("garbage\n{}")).toBeNull();
    expect(deployedUrl(JSON.stringify({ type: "deploy", targets: [] }))).toBeNull();
  });
});

describe("withDeploy", () => {
  it("records an env's URL and keeps the other", () => {
    expect(withDeploy({ production: "https://a.dev" }, "preview", "https://b.dev")).toEqual({
      production: "https://a.dev",
      preview: "https://b.dev",
    });
  });
  it("starts over from a broken file", () => {
    expect(withDeploy("nope", "production", "https://a.dev")).toEqual({ production: "https://a.dev" });
  });
});
