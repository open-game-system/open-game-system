// The TV launcher against the real local API and couch session (acceptance:
// docs/acceptance/2026-10-03-cast-first-app.feature). The phone is a WebSocket client; the
// launcher is the surface under test. Deterministic: no model.
import { test } from "@e2e-dev/web";
import { describe, expect } from "e2e";
import { couch, household, tvPage } from "./household";

const focused = '[data-focused]';

describe("TV launcher, live session", { tags: ["launcher"], requires: ["browser"] }, () => {
  test("cast: the launcher joins the household's couch, once", async ({ app, screen, browser }) => {
    const hh = await household();
    const phone = await couch(hh.phoneToken);
    await app.open(hh.launcherPath);
    await expect(screen.getByTestId("home")).toBeVisible();
    await expect(screen.getByTestId("couch")).toContainText(["Jonathan"]);
    await expect(screen.getByTestId("couch")).toContainText("Juneau");
    await expect(screen.getByTestId("remote-chip")).toContainText("Jonathan has the remote");
    await phone.until(() => phone.state()?.cast, "launcher connected");
    expect(phone.state()?.casts).toBe(1);
    await expect(browser.locator('[data-row="library"]')).toBeVisible();
    await app.screenshot("home-live");
    phone.close();
  });

  test("remote: a move on the phone moves the TV focus ring", async ({ app, screen, browser }) => {
    const hh = await household();
    const phone = await couch(hh.phoneToken);
    await app.open(hh.launcherPath);
    await expect(screen.getByTestId("home")).toBeVisible();
    const first = await phone.until(() => phone.state()?.focus, "initial focus");
    const before = await browser.locator(focused).getAttribute("data-item");
    expect(before).toBe(first);
    phone.send({ type: "focus.move", dir: "right" });
    const after = await phone.until(() => (phone.state()?.focus !== first ? phone.state()?.focus : null), "focus moved");
    await expect(browser.locator(focused)).toHaveAttribute("data-item", after);
    await app.screenshot("focus-moved");
    phone.close();
  });

  test("select opens the game page; back returns home", async ({ app, screen }) => {
    const hh = await household();
    const phone = await couch(hh.phoneToken);
    await app.open(hh.launcherPath);
    await expect(screen.getByTestId("home")).toBeVisible();
    await phone.until(() => phone.state()?.focus, "initial focus");
    phone.send({ type: "select", deviceId: "phone" });
    await expect(screen.getByTestId("game-page")).toBeVisible();
    await app.screenshot("game-page");
    phone.send({ type: "back" });
    await expect(screen.getByTestId("game-page")).not.toBeVisible();
    await expect(screen.getByTestId("home")).toBeVisible();
    phone.close();
  });

  test("a game launched from the phone is framed; swipe back parks it with its resume point; a swap never recasts", async ({ app, screen, browser }) => {
    const hh = await household();
    const phone = await couch(hh.phoneToken);
    await app.open(hh.launcherPath);
    await expect(screen.getByTestId("home")).toBeVisible();
    await phone.until(() => phone.state()?.cast, "launcher connected");

    phone.send({ type: "game.start", appId: "rocket-crew", mode: "continue" });
    await expect(screen.getByTestId("starting")).toBeVisible();
    phone.send({ type: "game.view", appId: "rocket-crew", url: tvPage("Rocket Crew", "Mission 6") });
    await expect(screen.getByTestId("game-frame")).toBeVisible();
    await expect(browser.frameLocator('[data-testid="game-frame"]').getByText("Rocket Crew · Mission 6")).toBeVisible();
    await phone.until(() => phone.state()?.current?.label === "Mission 6", "resume point from the framed game");
    await app.screenshot("rocket-crew-framed");

    phone.send({ type: "home" });
    await expect(screen.getByTestId("home")).toBeVisible();
    await expect(browser.locator('[data-row="continue"] [data-item="game:rocket-crew"]')).toContainText("Mission 6");
    await expect(screen.getByTestId("player")).toHaveAttribute("data-phase", "hidden");
    await app.screenshot("home-with-paused-box");

    phone.send({ type: "game.start", appId: "bake-shop", mode: "continue" });
    phone.send({ type: "game.view", appId: "bake-shop", url: tvPage("Bake Shop", "Day 4") });
    await expect(browser.frameLocator('[data-testid="game-frame"]').getByText("Bake Shop · Day 4")).toBeVisible();
    expect(phone.state()?.casts).toBe(1);

    phone.send({ type: "game.start", appId: "rocket-crew", mode: "continue" });
    await expect(browser.frameLocator('[data-testid="game-frame"]').getByText("Rocket Crew · Mission 6")).toBeVisible();
    expect(phone.state()?.casts).toBe(1);
    await app.screenshot("rocket-crew-continued");
    phone.close();
  });
});
