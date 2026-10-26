/**
 * Every page has a Copy markdown button that copies the page's Markdown twin (/<slug>.md) whole.
 * The button is hidden until its script runs, so without JavaScript the Markdown link stays the way.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildSite } from "../src/build";
// @ts-expect-error: a plain browser module, served as /copy.js
import { LABEL, wireCopy } from "../src/copy.js";
import { PAGES } from "../src/pages";

const out = mkdtempSync(join(tmpdir(), "ogs-docs-copy-"));
const built = buildSite(out);

describe("the Copy markdown button in the built pages", () => {
  it("is on every page, pointing at that page's Markdown twin, with a live status", () => {
    for (const p of PAGES) {
      const html = readFileSync(resolve(out, `${p.slug}.html`), "utf8");
      expect(html).toContain(
        `<button class="raw copy" type="button" data-copy-md="/${p.slug}.md" hidden>Copy markdown</button>`,
      );
      expect(html).toMatch(/<span class="sr-only" id="copy-status" role="status" aria-live="polite"><\/span>/);
      expect(html).toContain(`href="/${p.slug}.md"`);
    }
  });

  it("ships its script", () => {
    expect(readFileSync(resolve(out, "copy.js"), "utf8")).toContain("export function wireCopy");
    expect(built.length).toBe(PAGES.length);
  });
});

type Listener = () => Promise<void>;
function fakeButton(url: string) {
  let click: Listener = async () => {};
  return {
    dataset: { copyMd: url },
    hidden: true,
    textContent: LABEL,
    addEventListener: (_: string, fn: Listener) => {
      click = fn;
    },
    click: () => click(),
  };
}

describe("wireCopy", () => {
  it("shows the button, prefetches the Markdown and copies it whole on click", async () => {
    const button = fakeButton("/faq.md");
    const status = { textContent: "" };
    const fetchText = vi.fn(async () => "# FAQ\n\nwhole page\n");
    const clipboard = { writeText: vi.fn(async () => {}) };
    const timers: Array<() => void> = [];
    await wireCopy(button, status, { fetchText, clipboard, setTimer: (fn: () => void) => timers.push(fn) });
    expect(button.hidden).toBe(false);
    expect(fetchText).toHaveBeenCalledWith("/faq.md");
    await button.click();
    expect(clipboard.writeText).toHaveBeenCalledWith("# FAQ\n\nwhole page\n");
    expect(button.textContent).toBe("Copied");
    expect(status.textContent).toBe("Copied");
    for (const t of timers) t();
    expect(button.textContent).toBe(LABEL);
  });

  it("clicked before the prefetch lands, copies through a ClipboardItem promise (Safari keeps the gesture)", async () => {
    const button = fakeButton("/faq.md");
    let land: (t: string) => void = () => {};
    const fetchText = () => new Promise<string>((r) => (land = r));
    const written: unknown[] = [];
    class Item {
      constructor(public data: Record<string, Promise<Blob>>) {}
    }
    const clipboard = {
      writeText: vi.fn(async () => {}),
      write: vi.fn(async (items: Item[]) => {
        written.push(await (await items[0]?.data["text/plain"])?.text());
      }),
    };
    void wireCopy(button, { textContent: "" }, { fetchText, clipboard, ClipboardItem: Item, setTimer: () => {} });
    const clicked = button.click();
    land("# Page\n");
    await clicked;
    expect(written).toEqual(["# Page\n"]);
    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(button.textContent).toBe("Copied");
  });

  it("says so when it can't copy", async () => {
    const button = fakeButton("/faq.md");
    const status = { textContent: "" };
    const clipboard = { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) };
    await wireCopy(button, status, { fetchText: async () => "# x\n", clipboard, setTimer: () => {} });
    await button.click();
    expect(status.textContent).toBe("Couldn't copy. Use the Markdown link.");
    expect(button.textContent).toBe("Not copied");
  });
});
