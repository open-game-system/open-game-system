// The TV receiver never plays to an empty room (acceptance:
// docs/acceptance/2026-10-04-cast-receiver-e2e.feature): a cast ends when (a) no phone has been
// connected for 20 minutes, or (b) 3 hours pass. Playwright's virtual clock runs the hours.
import { test } from "@e2e-dev/web";
import { describe, expect } from "e2e";
import { API, MIN, openReceiver, type Receiver } from "./receiver-kit";

const VIEW = "https://launcher.ogs.test/?token=t";
const HOUR = 60 * MIN;
const ENDED = "This TV session has ended";

/** A phone casts the launcher. */
async function casting(rx: Receiver) {
  await rx.connect("phone");
  await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, apiUrl: API }, "phone");
}

/** Moves the page's clock on a minute at a time (each due timer fires once per step). */
async function run(rx: Receiver, ms: number) {
  for (let left = ms; left > 0; left -= MIN) await rx.page.clock.fastForward(Math.min(left, MIN));
  await new Promise((r) => setTimeout(r, 150));
}

describe("TV receiver stops (idle, no phone, 3 hours)", {
  tags: ["receiver"],
  requires: ["browser"],
}, () => {
  test("no phone for 20 minutes: stops the cast; a phone coming back resets it", async ({
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    await casting(rx);
    await rx.connect("ipad");
    await rx.disconnect("phone");
    await run(rx, 25 * MIN); // the iPad is still here
    expect(await rx.stops()).toBe(0);
    await rx.disconnect("ipad");
    await run(rx, 19 * MIN);
    expect(await rx.stops()).toBe(0);
    await rx.connect("phone"); // back in time
    await rx.disconnect("phone");
    await run(rx, 19 * MIN);
    expect(await rx.stops()).toBe(0);
    await run(rx, 2 * MIN);
    expect(await rx.stops()).toBe(1);
    await expect(screen.getByText(ENDED)).toBeVisible();
    expect(rx.blocked).toEqual([]);
  });

  test("3 hours: stops the cast even with phones connected", async ({ browser, screen }) => {
    const rx = await openReceiver(browser, { clock: true });
    await casting(rx);
    await run(rx, 3 * HOUR - 1 * MIN);
    expect(await rx.stops()).toBe(0);
    await run(rx, 2 * MIN);
    expect(await rx.stops()).toBe(1);
    await expect(screen.getByText(ENDED)).toBeVisible();
    expect(rx.blocked).toEqual([]);
  });

  test("tells Cast not to idle out (it plays a laptop's WebRTC picture, not Cast media)", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser);
    expect(await rx.page.evaluate(() => window.__cast.idleTimeoutDisabled)).toBe(true);
  });
});
