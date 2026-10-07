/**
 * The capture extension's streaming page (chrome-extension://…/streaming.html) is where the
 * publisher runs: it needs its script (INITIALIZE_PUBLISHER) and its extension APIs (chrome.tabs,
 * chrome.tabCapture). Right after Chrome is relaunched (the next cast on a warm instance, after an
 * idle or lifetime stop) Chrome sometimes loads that page without its extension APIs — measured on
 * 12 of 40 local relaunches — and every prepare then failed with "Cannot read properties of
 * undefined (reading 'query')". Reloading the page gives it its APIs.
 */

/** A puppeteer Page, as far as this needs it. */
export interface ExtensionPage {
  evaluate(expression: string): Promise<unknown>;
  reload(): Promise<unknown>;
}

/** Evaluated in the streaming page (a string: tsx's __name helpers don't exist there). */
export const EXTENSION_PAGE_PROBE = `({
  initializePublisher: typeof globalThis.INITIALIZE_PUBLISHER === "function",
  tabs: typeof chrome === "object" && !!chrome.tabs,
  tabCapture: typeof chrome === "object" && !!chrome.tabCapture,
})`;

interface ProbeResult {
  initializePublisher: boolean;
  tabs: boolean;
  tabCapture: boolean;
}

function isProbeResult(value: unknown): value is ProbeResult {
  if (typeof value !== "object" || value === null) return false;
  const v: Record<string, unknown> = { ...value };
  return (
    typeof v.initializePublisher === "boolean" &&
    typeof v.tabs === "boolean" &&
    typeof v.tabCapture === "boolean"
  );
}

/**
 * Resolves once the streaming page has its script and its extension APIs, reloading it when it has
 * the script but not the APIs (at most `maxReloads` times). Returns how many reloads it took.
 */
export async function ensureExtensionApis(
  page: ExtensionPage,
  {
    maxReloads = 3,
    maxPolls = 100,
    pollMs = 100,
    wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  }: {
    maxReloads?: number;
    maxPolls?: number;
    pollMs?: number;
    wait?: (ms: number) => Promise<void>;
  } = {},
): Promise<number> {
  let reloads = 0;
  for (let polls = 0; ; ) {
    const state = await page.evaluate(EXTENSION_PAGE_PROBE).catch(() => null);
    const probe = isProbeResult(state) ? state : null;
    if (probe?.initializePublisher && probe.tabs && probe.tabCapture) return reloads;
    if (probe?.initializePublisher) {
      if (reloads >= maxReloads)
        throw new Error(
          `The extension page has no chrome.tabs / chrome.tabCapture after ${reloads} reloads`,
        );
      reloads++;
      console.warn(`Extension page loaded without its extension APIs; reloading it (${reloads})`);
      await page.reload();
      continue;
    }
    if (++polls > maxPolls)
      throw new Error(
        "Could not find INITIALIZE_PUBLISHER function in the browser context after retries",
      );
    await wait(pollMs);
  }
}
